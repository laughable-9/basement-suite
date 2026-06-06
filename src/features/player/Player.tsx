import { useCallback, useEffect, useRef, useState } from "react";
import { parseAnm2 } from "../../lib/anm2/parse";
import { normalizeTime } from "../../lib/anm2/timeline";
import type { Anm2, Anm2Animation } from "../../lib/anm2/types";
import { pngUrl, readText } from "../../lib/fsx/fs";
import { dirname, resolveRelative } from "../../lib/fsx/resolve";
import { useAppStore } from "../../app/store";
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
}

async function loadImage(path: string): Promise<HTMLImageElement> {
  const url = await pngUrl(path);
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });
}

async function load(path: string): Promise<Loaded> {
  const anm2 = parseAnm2(await readText(path));
  const dir = dirname(path);
  const sheets: SheetMap = new Map();
  const sheetPaths = new Map<number, string>();
  const missing: string[] = [];
  await Promise.all(
    anm2.content.spritesheets.map(async (s) => {
      const resolved = resolveRelative(dir, s.rawPath);
      sheetPaths.set(s.id, resolved);
      try {
        sheets.set(s.id, await loadImage(resolved));
      } catch {
        sheets.set(s.id, null);
        missing.push(s.rawPath);
      }
    }),
  );
  return { anm2, sheets, sheetPaths, missing };
}

export function Player({ path }: { path: string }) {
  const openEditor = useAppStore((s) => s.openEditor);
  const playerJump = useAppStore((s) => s.playerJump);
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [animName, setAnimName] = useState("");
  const [playing, setPlaying] = useState(true);
  const [zoom, setZoom] = useState(4);
  const [tick, setTick] = useState(0); // continuous playhead, in ticks
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    let cancelled = false;
    setLoaded(null);
    setError(null);
    load(path).then(
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
  }, [path]);

  const anim: Anm2Animation | undefined = loaded?.anm2.animations.find(
    (a) => a.name === animName,
  );

  // Editor crop-grid click → jump to that animation/frame, paused.
  useEffect(() => {
    if (!playerJump || !loaded) return;
    if (!loaded.anm2.animations.some((a) => a.name === playerJump.animName))
      return;
    setAnimName(playerJump.animName);
    setTick(playerJump.tick);
    setPlaying(false);
  }, [playerJump, loaded]);

  // Playback clock: advance the playhead by elapsed wall time × fps.
  useEffect(() => {
    if (!playing || !loaded || !anim || anim.frameNum <= 0) return;
    let raf = 0;
    let last = performance.now();
    const step = (now: number) => {
      const dt = ((now - last) / 1000) * loaded.anm2.info.fps;
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
  }, [playing, loaded, anim]);

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
      renderFrame(ctx, loaded.anm2, anim, tick, loaded.sheets);
    }
  }, [loaded, anim, tick, zoom]);

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
        >
          {playing ? "⏸" : "▶"}
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
            {loaded.sheets.get(s.id) && (
              <button
                className="edit-link"
                onClick={() =>
                  openEditor(loaded.sheetPaths.get(s.id)!, path)
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
