import { useCallback, useEffect, useRef, useState } from "react";
import { parseAnm2 } from "../../lib/anm2/parse";
import { normalizeTime } from "../../lib/anm2/timeline";
import type { Anm2, Anm2Animation } from "../../lib/anm2/types";
import { readText } from "../../lib/fsx/fs";
import { headAnimFor } from "../../lib/anm2/compose";
import { loadAnm2Sheets, subscribeSheet } from "../../lib/sheets/store";
import { useAppStore } from "../../app/store";
import { PauseIcon, PlayIcon } from "../../app/icons";
import { renderFrame, type SheetMap } from "./render";

const CANVAS_W = 640;
const CANVAS_H = 420;

interface Loaded {
  anm2: Anm2;
  sheets: SheetMap;
  /** id → resolved absolute path (editor entry point) */
  sheetPaths: Map<number, string>;
  /** Spritesheets whose PNG failed to load (broken refs like raglich) */
  missing: string[];
  /** Character costume overlay (hair/wings), composited by state name */
  costume: { anm2: Anm2; sheets: SheetMap } | null;
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
      costume = {
        anm2: cAnm2,
        sheets: (await loadAnm2Sheets(cAnm2, costumePath)).sheets,
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

export function Player({
  path,
  skinPath,
  costumePath,
  tabId,
  active = true,
}: {
  path: string;
  /** Character skin override (replaces spritesheet 0 + composites the head) */
  skinPath?: string;
  /** Character costume anm2 (hair/wings), composited by state name */
  costumePath?: string;
  /** Owning tab — jump requests from the editor are scoped to it */
  tabId?: string;
  /** Hidden tabs stay mounted but pause their playback clock */
  active?: boolean;
}) {
  const setTabEditing = useAppStore((s) => s.setTabEditing);
  const playerJump = useAppStore((s) => s.playerJump);
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [animName, setAnimName] = useState("");
  const [playing, setPlaying] = useState(true);
  const [zoom, setZoom] = useState(4);
  const [onion, setOnion] = useState(false);
  const [tick, setTick] = useState(0); // continuous playhead, in ticks
  // Bumped when the editor mutates a sheet, to repaint while paused.
  const [sheetRev, setSheetRev] = useState(0);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Live link: repaint when any of this anm2's sheets is edited.
  useEffect(() => {
    if (!loaded) return;
    const unsubs = [...loaded.sheetPaths.values()].map((p) =>
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

  const anim: Anm2Animation | undefined = loaded?.anm2.animations.find(
    (a) => a.name === animName,
  );

  // Character context: the engine composites body + head animations; do the
  // same for Walk* so characters aren't headless (SCAN quirk: HeadDown is a
  // separate 4-frame animation, not a layer of WalkDown).
  const headAnim: Anm2Animation | null =
    skinPath && anim && loaded ? headAnimFor(loaded.anm2, anim) : null;

  // Editor crop-grid click → jump to that animation/frame, paused.
  // Each jump seq is consumed once so a stale jump in the store can't re-fire
  // when a different anm2 finishes loading.
  const consumedJumpRef = useRef(0);
  useEffect(() => {
    if (!playerJump || !loaded) return;
    if (tabId !== undefined && playerJump.tabId !== tabId) return;
    if (playerJump.seq === consumedJumpRef.current) return;
    consumedJumpRef.current = playerJump.seq;
    if (!loaded.anm2.animations.some((a) => a.name === playerJump.animName))
      return;
    setAnimName(playerJump.animName);
    setTick(playerJump.tick);
    setPlaying(false);
  }, [playerJump, loaded]);

  const playbackSpeed = useAppStore((s) => s.playbackSpeed);

  // Playback clock: advance the playhead by elapsed wall time × fps × speed.
  // Paused while the owning tab is hidden (stays mounted for state).
  useEffect(() => {
    if (!active || !playing || !loaded || !anim || anim.frameNum <= 0) return;
    let raf = 0;
    let last = performance.now();
    const step = (now: number) => {
      const dt =
        ((now - last) / 1000) * loaded.anm2.info.fps * playbackSpeed;
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
  }, [active, playing, loaded, anim, playbackSpeed]);

  // Repaint on every playhead/zoom/animation change.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !loaded) return;
    const ctx = canvas.getContext("2d")!;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);
    ctx.imageSmoothingEnabled = false;
    // Entity origin at canvas center, slightly below middle (Isaac sprites
    // hang mostly above their root point).
    ctx.translate(CANVAS_W / 2, CANVAS_H * 0.62);
    ctx.scale(zoom, zoom);
    if (anim && anim.frameNum > 0) {
      if (onion && anim.frameNum > 1) {
        // Ghost the neighboring whole frames at low opacity.
        const f = Math.floor(tick);
        const wrap = (t: number) =>
          anim.loop
            ? ((t % anim.frameNum) + anim.frameNum) % anim.frameNum
            : t;
        const prev = wrap(f - 1);
        const next = wrap(f + 1);
        if (prev >= 0 && prev < anim.frameNum && prev !== f) {
          renderFrame(ctx, loaded.anm2, anim, prev, loaded.sheets, 0.25);
        }
        if (next >= 0 && next < anim.frameNum && next !== f) {
          renderFrame(ctx, loaded.anm2, anim, next, loaded.sheets, 0.25);
        }
      }
      // Engine-ish costume ordering: wings behind the body, hair over the head.
      const costume = loaded.costume;
      const cBody = costume?.anm2.animations.find((a) => a.name === anim.name);
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
    }
  }, [loaded, anim, headAnim, tick, zoom, sheetRev, onion]);

  const selectAnim = useCallback((name: string) => {
    setAnimName(name);
    setTick(0);
    setPlaying(true);
  }, []);

  if (error) return <div className="detail-error">{error}</div>;
  if (!loaded) return <div className="detail-empty">Loading…</div>;

  const { anm2, missing } = loaded;
  const frame = Math.floor(tick);

  return (
    <div className="player">
      {missing.length > 0 && (
        <div className="player-warning">
          Missing spritesheet{missing.length > 1 ? "s" : ""}:{" "}
          {missing.join(", ")} (rendered as magenta)
        </div>
      )}
      <div className="player-canvas-wrap checkerboard">
        <canvas ref={canvasRef} width={CANVAS_W} height={CANVAS_H} />
      </div>
      <div className="player-controls">
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
        <label className="player-zoom">
          zoom
          <select value={zoom} onChange={(e) => setZoom(Number(e.target.value))}>
            {[1, 2, 3, 4, 6, 8].map((z) => (
              <option key={z} value={z}>
                {z}×
              </option>
            ))}
          </select>
        </label>
        <label className="player-zoom" title="Ghost the previous/next frame">
          <input
            type="checkbox"
            checked={onion}
            onChange={(e) => setOnion(e.target.checked)}
          />
          onion
        </label>
        <span className="detail-meta">{anm2.info.fps} fps</span>
      </div>
      <table className="anim-table">
        <thead>
          <tr>
            <th>Animation</th>
            <th>Frames</th>
            <th>Loop</th>
          </tr>
        </thead>
        <tbody>
          {anm2.animations.map((a, i) => (
            <tr
              key={`${a.name}-${i}`}
              className={a.name === animName ? "anim-row-active" : "anim-row"}
              onClick={() => selectAnim(a.name)}
            >
              <td>
                {a.name}
                {a.name === anm2.defaultAnimation && (
                  <span className="default-badge">default</span>
                )}
              </td>
              <td>{a.frameNum}</td>
              <td>{a.loop ? "↻" : ""}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <h3>Spritesheets</h3>
      <ul className="sheet-list">
        {anm2.content.spritesheets.map((s) => (
          <li key={s.id}>
            {s.rawPath}{" "}
            {loaded.sheets.get(s.id) && tabId !== undefined && (
              <button
                className="edit-link"
                onClick={() =>
                  setTabEditing(tabId, {
                    sheetPath: loaded.sheetPaths.get(s.id)!,
                    anm2Path: path,
                  })
                }
              >
                edit
              </button>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
