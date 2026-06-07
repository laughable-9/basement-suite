import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { parseAnm2 } from "../../lib/anm2/parse";
import {
  frameBounds,
  unionBounds,
  type Bounds,
} from "../../lib/anm2/bounds";
import { normalizeTime } from "../../lib/anm2/timeline";
import type { Anm2, Anm2Animation } from "../../lib/anm2/types";
import { readText } from "../../lib/fsx/fs";
import { headAnimFor } from "../../lib/anm2/compose";
import { loadAnm2Sheets, subscribeSheet } from "../../lib/sheets/store";
import { useAppStore } from "../../app/store";
import { OnionIcon, PauseIcon, PencilIcon, PlayIcon } from "../../app/icons";
import { renderFrame, type SheetMap } from "./render";
import { AnimGrid, type AnimItem } from "./AnimGrid";
import type { ThumbScene } from "../home/renderThumb";

/** Where a selected animation lives — drives the banner render path. */
type AnimSource = "player" | "costume";

const ZOOMS = [1, 2, 3, 4, 6, 8, 12, 16];
/** Breathing room around the sprite in fit mode (px per side) */
const FIT_PAD = 24;
const FIT_MAX = 24;

interface Loaded {
  anm2: Anm2;
  sheets: SheetMap;
  /** id → resolved absolute path (editor entry point) */
  sheetPaths: Map<number, string>;
  /** Spritesheets whose PNG failed to load (broken refs like raglich) */
  missing: string[];
  /** Character costume overlay (hair/wings), composited by state name */
  costume: {
    anm2: Anm2;
    sheets: SheetMap;
    /** id → resolved path (costume sheets are editable too) */
    byId: Map<number, string>;
    path: string;
  } | null;
}

async function load(
  path: string,
  skinPath?: string,
  costumePath?: string,
): Promise<Loaded> {
  const anm2 = parseAnm2(await readText(path));
  // Shared sheet documents: the editor mutates these same canvases,
  // so edits appear in playback immediately (live link).
  const main = await loadAnm2Sheets(anm2, path, skinPath);

  let costume: Loaded["costume"] = null;
  if (costumePath) {
    try {
      const cAnm2 = parseAnm2(await readText(costumePath));
      const cLoaded = await loadAnm2Sheets(cAnm2, costumePath);
      costume = {
        anm2: cAnm2,
        sheets: cLoaded.sheets,
        byId: cLoaded.byId,
        path: costumePath,
      };
    } catch {
      // costume is decoration — never block playback
    }
  }
  return {
    anm2,
    sheets: main.sheets,
    sheetPaths: main.byId,
    missing: main.missing,
    costume,
  };
}

/**
 * Convert the player's Loaded state into a ThumbScene the AnimGrid can derive
 * per-animation scenes from. base.anim/base.headAnim are placeholders —
 * buildAnimScene rebuilds them per card. base.headAnim being non-null is the
 * "this is a character, pair body+head" flag.
 */
function loadedToBaseScene(
  loaded: Loaded,
  isCharacter: boolean,
): ThumbScene | null {
  const def =
    loaded.anm2.animations.find(
      (a) => a.name === loaded.anm2.defaultAnimation,
    ) ?? loaded.anm2.animations[0];
  if (!def) return null;
  const headAnim = isCharacter ? headAnimFor(loaded.anm2, def) : null;
  const sheetPaths = [
    ...loaded.sheetPaths.values(),
    ...(loaded.costume ? [...loaded.costume.byId.values()] : []),
  ];
  return {
    anm2: loaded.anm2,
    anim: def,
    headAnim,
    costume: loaded.costume
      ? {
          anm2: loaded.costume.anm2,
          sheets: loaded.costume.sheets,
          bodyAnim: null,
          headAnim: null,
        }
      : null,
    sheets: loaded.sheets,
    fps: loaded.anm2.info.fps,
    sheetPaths,
  };
}

export function Player({
  path,
  skinPath,
  costumePath,
  tabId,
  active = true,
  title,
  compact = false,
}: {
  path: string;
  skinPath?: string;
  costumePath?: string;
  tabId?: string;
  active?: boolean;
  title?: string;
  /** Split-screen mode: vertical layout with a LIVE PREVIEW header */
  compact?: boolean;
}) {
  const setTabEditing = useAppStore((s) => s.setTabEditing);
  const playerJump = useAppStore((s) => s.playerJump);
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [animName, setAnimName] = useState("");
  const [playing, setPlaying] = useState(true);
  const [zoom, setZoom] = useState<number | "fit">("fit");
  const [onion, setOnion] = useState(false);
  const [tick, setTick] = useState(0);
  const [sheetRev, setSheetRev] = useState(0);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const [stage, setStage] = useState({ w: 0, h: 0 });

  // Re-observe on compact toggle: the wide and stack branches render
  // different DOM trees, so the old observer is attached to a detached node.
  useEffect(() => {
    const el = stageRef.current;
    if (!el || !loaded) return;
    const measure = () =>
      setStage({ w: el.clientWidth, h: el.clientHeight });
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    measure();
    return () => ro.disconnect();
  }, [loaded, compact]);

  // Live link: repaint when any of this anm2's sheets is edited.
  useEffect(() => {
    if (!loaded) return;
    const paths = [
      ...loaded.sheetPaths.values(),
      ...(loaded.costume ? loaded.costume.byId.values() : []),
    ];
    const unsubs = paths.map((p) =>
      subscribeSheet(p, () => setSheetRev((r) => r + 1)),
    );
    return () => unsubs.forEach((u) => u());
  }, [loaded]);

  useEffect(() => {
    let cancelled = false;
    setLoaded(null);
    setError(null);
    load(path, skinPath, costumePath).then(
      (l) => {
        if (cancelled) return;
        setLoaded(l);
        setAnimName(
          l.anm2.animations.some((a) => a.name === l.anm2.defaultAnimation)
            ? l.anm2.defaultAnimation
            : (l.anm2.animations[0]?.name ?? ""),
        );
        setTick(0);
        setPlaying(true);
      },
      (e) => !cancelled && setError(String(e)),
    );
    return () => {
      cancelled = true;
    };
  }, [path, skinPath, costumePath]);

  // Resolve the active animation by searching the player anm2 first, then
  // the costume anm2 (which carries Azazel's HeadDownShoot/Charge etc.).
  // The source decides which anm2/sheets the banner renders against.
  const playerAnim = loaded?.anm2.animations.find((a) => a.name === animName);
  const costumeAnim =
    !playerAnim && loaded?.costume
      ? loaded.costume.anm2.animations.find((a) => a.name === animName)
      : undefined;
  const animSource: AnimSource = playerAnim ? "player" : "costume";
  const anim: Anm2Animation | undefined = playerAnim ?? costumeAnim;
  const renderAnm2 =
    animSource === "costume" && loaded?.costume
      ? loaded.costume.anm2
      : loaded?.anm2;
  const renderSheets =
    animSource === "costume" && loaded?.costume
      ? loaded.costume.sheets
      : loaded?.sheets;

  // Body+head pairing only makes sense for player anims (character compose).
  const headAnim: Anm2Animation | null =
    skinPath && playerAnim && loaded
      ? headAnimFor(loaded.anm2, playerAnim)
      : null;

  // Editor crop-grid click → jump to that animation/frame, paused. The
  // editor's anm2 may be either the player anm2 or the costume anm2 (when
  // the user edits a head/costume sheet), so accept either source.
  const consumedJumpRef = useRef(0);
  useEffect(() => {
    if (!playerJump || !loaded) return;
    if (tabId !== undefined && playerJump.tabId !== tabId) return;
    if (playerJump.seq === consumedJumpRef.current) return;
    const inPlayer = loaded.anm2.animations.some(
      (a) => a.name === playerJump.animName,
    );
    const inCostume = loaded.costume?.anm2.animations.some(
      (a) => a.name === playerJump.animName,
    );
    if (!inPlayer && !inCostume) return;
    consumedJumpRef.current = playerJump.seq;
    setAnimName(playerJump.animName);
    setTick(playerJump.tick);
    setPlaying(false);
  }, [playerJump, loaded]);

  const playbackSpeed = useAppStore((s) => s.playbackSpeed);

  // Whole-timeline bounds → stable fit zoom + centering across playback.
  const bounds: Bounds | null = useMemo(() => {
    if (!anim) return null;
    let b: Bounds | null = null;
    const n = Math.max(1, anim.frameNum);
    const stride = Math.max(1, Math.ceil(n / 48));
    for (let t = 0; t < n; t += stride) {
      b = unionBounds(b, frameBounds(anim, t));
      if (headAnim && headAnim.frameNum > 0) {
        b = unionBounds(b, frameBounds(headAnim, t % headAnim.frameNum));
      }
    }
    return b;
  }, [anim, headAnim]);

  // Playback clock — costume anims use the costume anm2's fps, not the
  // player's, so a 24 fps Charge animation paces correctly.
  useEffect(() => {
    if (!active || !playing || !loaded || !anim || anim.frameNum <= 0) return;
    let raf = 0;
    let last = performance.now();
    const fps =
      animSource === "costume" && loaded.costume
        ? loaded.costume.anm2.info.fps
        : loaded.anm2.info.fps;
    const step = (now: number) => {
      const dt = ((now - last) / 1000) * fps * playbackSpeed;
      last = now;
      setTick((t) => {
        const t2 = t + dt;
        if (!anim.loop && t2 >= anim.frameNum) {
          setPlaying(false);
          return anim.frameNum - 1e-6;
        }
        return normalizeTime(t2, anim.frameNum, anim.loop);
      });
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [active, playing, loaded, anim, animSource, playbackSpeed]);

  // Banner stage repaint
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !loaded || stage.w === 0 || stage.h === 0) return;
    const dpr = window.devicePixelRatio || 1;
    const pw = Math.max(1, Math.round(stage.w * dpr));
    const ph = Math.max(1, Math.round(stage.h * dpr));
    if (canvas.width !== pw) canvas.width = pw;
    if (canvas.height !== ph) canvas.height = ph;
    const ctx = canvas.getContext("2d")!;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, stage.w, stage.h);
    ctx.imageSmoothingEnabled = false;
    let z: number;
    let cx = 0;
    let cy = 0;
    if (bounds) {
      const bw = Math.max(1, bounds.maxX - bounds.minX);
      const bh = Math.max(1, bounds.maxY - bounds.minY);
      if (zoom === "fit") {
        const raw = Math.min(
          (stage.w - FIT_PAD * 2) / bw,
          (stage.h - FIT_PAD * 2) / bh,
        );
        z = raw >= 1 ? Math.min(FIT_MAX, Math.floor(raw)) : Math.max(0.1, raw);
      } else {
        z = zoom;
      }
      cx = (bounds.minX + bounds.maxX) / 2;
      cy = (bounds.minY + bounds.maxY) / 2;
    } else {
      z = zoom === "fit" ? 4 : zoom;
    }
    ctx.translate(stage.w / 2 - cx * z, stage.h / 2 - cy * z);
    ctx.scale(z, z);
    if (anim && anim.frameNum > 0 && renderAnm2 && renderSheets) {
      if (onion && anim.frameNum > 1) {
        const f = Math.floor(tick);
        const wrap = (t: number) =>
          anim.loop
            ? ((t % anim.frameNum) + anim.frameNum) % anim.frameNum
            : t;
        const prev = wrap(f - 1);
        const next = wrap(f + 1);
        if (prev >= 0 && prev < anim.frameNum && prev !== f) {
          renderFrame(ctx, renderAnm2, anim, prev, renderSheets, 0.25);
        }
        if (next >= 0 && next < anim.frameNum && next !== f) {
          renderFrame(ctx, renderAnm2, anim, next, renderSheets, 0.25);
        }
      }
      if (animSource === "player") {
        // Character composite: body anm2 + matching costume + paired head.
        const costume = loaded.costume;
        const cBody = costume?.anm2.animations.find(
          (a) => a.name === anim.name,
        );
        const cHead =
          headAnim &&
          costume?.anm2.animations.find((a) => a.name === headAnim.name);
        const at = (a: Anm2Animation) => tick % Math.max(1, a.frameNum);
        if (costume && cBody) {
          renderFrame(ctx, costume.anm2, cBody, at(cBody), costume.sheets);
        }
        renderFrame(ctx, loaded.anm2, anim, tick, loaded.sheets);
        if (headAnim && headAnim.frameNum > 0) {
          renderFrame(ctx, loaded.anm2, headAnim, at(headAnim), loaded.sheets);
        }
        if (costume && cHead) {
          renderFrame(ctx, costume.anm2, cHead, at(cHead), costume.sheets);
        }
      } else {
        // Costume-exclusive anim (e.g. HeadDownShoot): render it alone, no
        // body — the body anm2 has no matching state to pair with.
        renderFrame(ctx, renderAnm2, anim, tick, renderSheets);
      }
    }
  }, [
    loaded,
    anim,
    animSource,
    headAnim,
    renderAnm2,
    renderSheets,
    tick,
    zoom,
    sheetRev,
    onion,
    stage,
    bounds,
  ]);

  const selectAnim = useCallback((name: string) => {
    setAnimName(name);
    setTick(0);
    setPlaying(true);
  }, []);

  const baseScene = useMemo(
    () => (loaded ? loadedToBaseScene(loaded, !!skinPath) : null),
    [loaded, skinPath],
  );

  // Costume baseScene — only used as the source for costume-exclusive cards
  // (HeadDownShoot etc.). Renders the costume anm2 alone, no body compose.
  const costumeBaseScene: ThumbScene | null = useMemo(() => {
    if (!loaded?.costume) return null;
    const def =
      loaded.costume.anm2.animations.find(
        (a) => a.name === loaded.costume!.anm2.defaultAnimation,
      ) ?? loaded.costume.anm2.animations[0];
    if (!def) return null;
    return {
      anm2: loaded.costume.anm2,
      anim: def,
      headAnim: null,
      costume: null,
      sheets: loaded.costume.sheets,
      fps: loaded.costume.anm2.info.fps,
      sheetPaths: [...loaded.costume.byId.values()],
    };
  }, [loaded]);

  // Merge player + costume-exclusive animations into one grid feed.
  // Costume anims that share a name with player anims would render twice and
  // confuse selection (which one plays?), so dedupe by name with player win.
  const gridItems = useMemo<AnimItem[]>(() => {
    if (!loaded || !baseScene) return [];
    const playerItems: AnimItem[] = loaded.anm2.animations.map((a) => ({
      baseScene,
      animName: a.name,
      frameNum: a.frameNum,
      loops: a.loop,
      isDefault: a.name === loaded.anm2.defaultAnimation,
    }));
    if (!loaded.costume || !costumeBaseScene) return playerItems;
    const playerNames = new Set(loaded.anm2.animations.map((a) => a.name));
    const costumeItems: AnimItem[] = loaded.costume.anm2.animations
      .filter((a) => !playerNames.has(a.name) && a.frameNum > 0)
      .map((a) => ({
        baseScene: costumeBaseScene,
        animName: a.name,
        frameNum: a.frameNum,
        loops: a.loop,
        isDefault: false,
      }));
    return [...playerItems, ...costumeItems];
  }, [loaded, baseScene, costumeBaseScene]);

  if (error) return <div className="detail-error">{error}</div>;
  if (!loaded) return <div className="detail-empty">Loading…</div>;

  const { anm2, missing } = loaded;
  const frame = Math.floor(tick);
  const baseName = (p: string) => p.split(/[\\/]/).pop() ?? p;

  const transport = (
    <div className="player-transport">
      <button
        className="player-btn"
        onClick={() => {
          if (!playing && anim && tick >= anim.frameNum - 1e-6) setTick(0);
          setPlaying(!playing);
        }}
        disabled={!anim || anim.frameNum <= 0}
        title={playing ? "Pause" : "Play"}
      >
        {playing ? <PauseIcon /> : <PlayIcon />}
      </button>
      <input
        type="range"
        min={0}
        max={Math.max(0, (anim?.frameNum ?? 1) - 1)}
        step={1}
        value={Math.min(frame, Math.max(0, (anim?.frameNum ?? 1) - 1))}
        onChange={(e) => {
          setPlaying(false);
          setTick(Number(e.target.value));
        }}
      />
      <span className="player-frame">
        {anim && anim.frameNum > 0
          ? `${Math.min(frame + 1, anim.frameNum)}/${anim.frameNum}`
          : "–"}
      </span>
      <span className="transport-sep" />
      <select
        className="transport-select"
        title="Preview zoom"
        value={zoom === "fit" ? "fit" : String(zoom)}
        onChange={(e) =>
          setZoom(e.target.value === "fit" ? "fit" : Number(e.target.value))
        }
      >
        <option value="fit">Fit</option>
        {ZOOMS.map((z) => (
          <option key={z} value={String(z)}>
            {z}×
          </option>
        ))}
      </select>
      <button
        className={`rail-btn${onion ? " active" : ""}`}
        title="Onion skin — ghost the previous/next frame"
        onClick={() => setOnion(!onion)}
      >
        <OnionIcon />
      </button>
      <span className="transport-sep" />
      <span className="player-fps" title="Animation file frame rate">
        {anm2.info.fps} fps
      </span>
    </div>
  );

  const sheetRow = (
    id: number,
    name: string,
    fullPath: string | undefined,
    source: HTMLCanvasElement | null | undefined,
    anm2Path: string,
  ) => {
    const ok = !!source;
    return (
      <div className="sheet-row" key={`${anm2Path}#${id}`}>
        <SheetThumb source={source} path={fullPath} />
        <span
          className={`sheet-row-name${ok ? "" : " sheet-row-missing"}`}
          title={fullPath ?? name}
        >
          {name}
        </span>
        {ok && tabId !== undefined && fullPath && (
          <button
            className="rail-btn sheet-edit-btn"
            title={`Edit ${name}`}
            onClick={() =>
              setTabEditing(tabId, {
                sheetPath: fullPath,
                anm2Path,
                sheetId: id,
              })
            }
          >
            <PencilIcon />
          </button>
        )}
        {!ok && <span className="sheet-missing-badge">missing</span>}
      </div>
    );
  };

  const sheetsPanel = (
    <aside className="player-sheets">
      <header className="panel-header">Sheets</header>
      <div className="panel-body">
        {anm2.content.spritesheets.map((s) => {
          const resolved = loaded.sheetPaths.get(s.id);
          const source = loaded.sheets.get(s.id);
          return sheetRow(
            s.id,
            baseName(resolved ?? s.rawPath),
            resolved,
            source,
            path,
          );
        })}
        {loaded.costume && (
          <>
            <div className="sheet-group-label">
              Costume (hair / wings / head overlays)
            </div>
            {loaded.costume.anm2.content.spritesheets.map((s) => {
              const resolved = loaded.costume!.byId.get(s.id);
              const source = loaded.costume!.sheets.get(s.id);
              return sheetRow(
                s.id,
                baseName(resolved ?? s.rawPath),
                resolved,
                source,
                loaded.costume!.path,
              );
            })}
          </>
        )}
      </div>
    </aside>
  );

  // Banner: preview stage + transport row + animation info.
  // Header (entity name + live badge in compact) is rendered above the banner.
  const banner = (
    <div className="player-banner">
      <div className="player-stage checkerboard" ref={stageRef}>
        <canvas ref={canvasRef} />
        {missing.length > 0 && (
          <div className="player-warning">
            Missing: {missing.join(", ")}
          </div>
        )}
      </div>
      <div className="player-banner-info">
        <div className="player-banner-title">
          <span className="player-anim-name">{animName || "–"}</span>
          {animName === anm2.defaultAnimation && (
            <span className="default-badge">default</span>
          )}
        </div>
        <div className="player-banner-meta">
          {anim
            ? `${anim.frameNum} frame${anim.frameNum === 1 ? "" : "s"}${anim.loop ? " · loops" : ""}`
            : ""}
        </div>
        {transport}
      </div>
    </div>
  );

  // Compact (live edit) mode: vertical with big preview on top.
  // Animation switcher stays as a compact text list to keep the live edit
  // pane focused on watching the preview.
  if (compact) {
    return (
      <div className="player player-stack">
        <div className="player-header">
          <span
            className="player-title"
            title="Mirrors your edits in real time"
          >
            Live Preview{title ? `: ${title}` : ""}
          </span>
        </div>
        {banner}
        <div className="player-stack-panels">
          <section className="player-anims-list">
            <header className="panel-header">
              Animations{" "}
              <span className="panel-count">{gridItems.length}</span>
            </header>
            <div className="panel-body">
              <table className="anim-table">
                <tbody>
                  {gridItems.map((item, i) => (
                    <tr
                      key={`${item.animName}-${i}`}
                      className={
                        item.animName === animName
                          ? "anim-row-active"
                          : "anim-row"
                      }
                      onClick={() => selectAnim(item.animName)}
                    >
                      <td>
                        {item.animName}
                        {item.isDefault && (
                          <span className="default-badge">default</span>
                        )}
                      </td>
                      <td className="anim-col-num">{item.frameNum}</td>
                      <td className="anim-col-num">
                        {item.loops ? "↻" : ""}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
          {sheetsPanel}
        </div>
      </div>
    );
  }

  // Normal mode: banner top + animation card grid below, sheets docked right.
  return (
    <div className="player player-wide">
      <div className="player-main">
        <div className="player-header">
          {title && <span className="player-title">{title}</span>}
          <span className="toolbar-spacer" />
          <span className="player-meta">
            {gridItems.length} animations
          </span>
        </div>
        {banner}
        <header className="anim-grid-header">
          <span>ANIMATIONS</span>
          <span className="panel-count">{gridItems.length}</span>
        </header>
        {gridItems.length > 0 ? (
          <AnimGrid
            items={gridItems}
            selectedName={animName}
            onSelect={(item) => selectAnim(item.animName)}
          />
        ) : (
          <div className="detail-empty">No animations</div>
        )}
      </div>
      {sheetsPanel}
    </div>
  );
}

/**
 * Small inline thumbnail of a spritesheet PNG (decoded canvas already in
 * memory via SheetDoc). Live-link aware: edits redraw the thumb.
 */
function SheetThumb({
  source,
  path,
}: {
  source: HTMLCanvasElement | null | undefined;
  path: string | undefined;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  const [rev, setRev] = useState(0);

  useEffect(() => {
    if (!path) return;
    return subscribeSheet(path, () => setRev((r) => r + 1));
  }, [path]);

  useEffect(() => {
    const dst = ref.current;
    if (!dst || !source) return;
    const SIZE = 64;
    const dpr = window.devicePixelRatio || 1;
    dst.width = SIZE * dpr;
    dst.height = SIZE * dpr;
    const ctx = dst.getContext("2d")!;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, SIZE, SIZE);
    const scale = Math.min(SIZE / source.width, SIZE / source.height);
    const w = source.width * scale;
    const h = source.height * scale;
    ctx.drawImage(source, (SIZE - w) / 2, (SIZE - h) / 2, w, h);
  }, [source, rev]);

  if (!source) return <span className="sheet-thumb sheet-thumb-blank" />;
  return (
    <span className="sheet-thumb checkerboard">
      <canvas ref={ref} />
    </span>
  );
}
