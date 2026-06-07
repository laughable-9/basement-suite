// Vanilla vs modded sprite diff. Side-by-side renders both canvases
// independently; overlay puts modded on top with a vertical slider that
// reveals vanilla where the slider sweeps left.

import { useEffect, useRef, useState } from "react";
import { useAppStore } from "../../app/store";
import type { ModFile } from "../../lib/mods/fileTree";
import { decodePng } from "./decodePng";

const ZOOMS: (number | "fit")[] = ["fit", 1, 2, 3, 4, 6, 8, 12, 16];

interface Props {
  file: ModFile;
  /** Absolute path to the game's gfx root */
  gfxRoot: string;
}

interface Loaded {
  vanilla: HTMLCanvasElement | null;
  modded: HTMLCanvasElement | null;
}

type Mode = "side" | "overlay";

export function DiffViewer({ file, gfxRoot }: Props) {
  const lastZoom = useAppStore((s) => s.lastEditorZoom);
  const [mode, setMode] = useState<Mode>("side");
  const [zoom, setZoom] = useState<number | "fit">(() => lastZoom);
  const [loaded, setLoaded] = useState<Loaded | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoaded(null);
    const vanillaPath = `${gfxRoot}/${file.rel}`;
    Promise.all([decodePng(vanillaPath), decodePng(file.abs)]).then(
      ([vanilla, modded]) => {
        if (cancelled) return;
        setLoaded({ vanilla, modded });
      },
    );
    return () => {
      cancelled = true;
    };
  }, [file.abs, file.rel, gfxRoot]);

  return (
    <div className="diff-viewer">
      <header className="diff-toolbar">
        <span className="diff-path" title={file.rel}>
          {file.rel}
        </span>
        <span className="toolbar-spacer" />
        <div className="diff-mode">
          <button
            className={`diff-mode-btn${mode === "side" ? " active" : ""}`}
            onClick={() => setMode("side")}
          >
            Side-by-side
          </button>
          <button
            className={`diff-mode-btn${mode === "overlay" ? " active" : ""}`}
            onClick={() => setMode("overlay")}
          >
            Overlay
          </button>
        </div>
        <label className="player-zoom">
          zoom
          <select
            className="transport-select"
            value={zoom === "fit" ? "fit" : String(zoom)}
            onChange={(e) =>
              setZoom(
                e.target.value === "fit" ? "fit" : Number(e.target.value),
              )
            }
          >
            {ZOOMS.map((z) => (
              <option key={String(z)} value={String(z)}>
                {z === "fit" ? "Fit" : `${z}×`}
              </option>
            ))}
          </select>
        </label>
      </header>
      {!loaded ? (
        <div className="detail-empty">Decoding…</div>
      ) : mode === "side" ? (
        <SideBySide
          vanilla={loaded.vanilla}
          modded={loaded.modded}
          zoom={zoom}
        />
      ) : (
        <Overlay
          vanilla={loaded.vanilla}
          modded={loaded.modded}
          zoom={zoom}
        />
      )}
    </div>
  );
}

function imageSize(
  canvas: HTMLCanvasElement | null,
): { w: number; h: number } {
  return canvas ? { w: canvas.width, h: canvas.height } : { w: 0, h: 0 };
}

function fitScale(
  img: { w: number; h: number },
  box: { w: number; h: number },
  pad = 16,
): number {
  if (img.w === 0 || img.h === 0) return 1;
  return Math.max(
    0.05,
    Math.min((box.w - pad * 2) / img.w, (box.h - pad * 2) / img.h),
  );
}

function ImagePane({
  label,
  canvas,
  zoom,
}: {
  label: string;
  canvas: HTMLCanvasElement | null;
  zoom: number | "fit";
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const outRef = useRef<HTMLCanvasElement>(null);
  const [box, setBox] = useState({ w: 0, h: 0 });

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const measure = () =>
      setBox({ w: el.clientWidth, h: el.clientHeight });
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    measure();
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const out = outRef.current;
    if (!out || box.w === 0 || box.h === 0) return;
    const dpr = window.devicePixelRatio || 1;
    out.width = box.w * dpr;
    out.height = box.h * dpr;
    const ctx = out.getContext("2d")!;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, box.w, box.h);
    if (!canvas) return;
    const img = imageSize(canvas);
    const s = zoom === "fit" ? fitScale(img, box) : zoom;
    const x = (box.w - img.w * s) / 2;
    const y = (box.h - img.h * s) / 2;
    ctx.drawImage(canvas, x, y, img.w * s, img.h * s);
  }, [canvas, zoom, box]);

  return (
    <div className="diff-pane">
      <header className="diff-pane-header">
        <span>{label}</span>
        {canvas && (
          <span className="diff-pane-dims">
            {canvas.width}×{canvas.height}
          </span>
        )}
      </header>
      <div ref={wrapRef} className="diff-pane-canvas checkerboard">
        <canvas ref={outRef} />
        {!canvas && (
          <div className="diff-missing">No {label.toLowerCase()} file</div>
        )}
      </div>
    </div>
  );
}

function SideBySide({
  vanilla,
  modded,
  zoom,
}: {
  vanilla: HTMLCanvasElement | null;
  modded: HTMLCanvasElement | null;
  zoom: number | "fit";
}) {
  return (
    <div className="diff-side">
      <ImagePane label="Vanilla" canvas={vanilla} zoom={zoom} />
      <ImagePane label="Modded" canvas={modded} zoom={zoom} />
    </div>
  );
}

function Overlay({
  vanilla,
  modded,
  zoom,
}: {
  vanilla: HTMLCanvasElement | null;
  modded: HTMLCanvasElement | null;
  zoom: number | "fit";
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const outRef = useRef<HTMLCanvasElement>(null);
  const [box, setBox] = useState({ w: 0, h: 0 });
  const [split, setSplit] = useState(0.5);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const measure = () =>
      setBox({ w: el.clientWidth, h: el.clientHeight });
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    measure();
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const out = outRef.current;
    if (!out || box.w === 0 || box.h === 0) return;
    const dpr = window.devicePixelRatio || 1;
    out.width = box.w * dpr;
    out.height = box.h * dpr;
    const ctx = out.getContext("2d")!;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, box.w, box.h);

    // Pick a common scale: fit to the bigger of the two so both fit at the
    // same screen size; centered.
    const v = imageSize(vanilla);
    const m = imageSize(modded);
    const img = {
      w: Math.max(v.w, m.w),
      h: Math.max(v.h, m.h),
    };
    if (img.w === 0 || img.h === 0) return;
    const s = zoom === "fit" ? fitScale(img, box) : zoom;
    const cx = (box.w - img.w * s) / 2;
    const cy = (box.h - img.h * s) / 2;

    // Vanilla fills the whole frame; modded overlays only on the right of
    // the split line so the slider reveals vanilla as it sweeps right.
    if (vanilla) {
      ctx.drawImage(vanilla, cx, cy, v.w * s, v.h * s);
    }
    if (modded) {
      const sliderX = cx + img.w * s * split;
      ctx.save();
      ctx.beginPath();
      ctx.rect(sliderX, 0, box.w - sliderX, box.h);
      ctx.clip();
      ctx.drawImage(modded, cx, cy, m.w * s, m.h * s);
      ctx.restore();
    }

    // Slider line + handle (cosmetic — actual hit area is the bg div).
    const sliderX = cx + img.w * s * split;
    ctx.strokeStyle = "rgba(196,80,56,0.95)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(sliderX + 0.5, 0);
    ctx.lineTo(sliderX + 0.5, box.h);
    ctx.stroke();
    ctx.fillStyle = "rgba(196,80,56,0.95)";
    ctx.fillRect(sliderX - 3, box.h / 2 - 16, 6, 32);
  }, [vanilla, modded, zoom, box, split]);

  return (
    <div className="diff-overlay">
      <div
        ref={wrapRef}
        className="diff-overlay-canvas checkerboard"
        onPointerDown={(e) => {
          (e.target as Element).setPointerCapture(e.pointerId);
          const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
          setSplit(
            Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width)),
          );
        }}
        onPointerMove={(e) => {
          if (e.buttons !== 1) return;
          const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
          setSplit(
            Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width)),
          );
        }}
      >
        <canvas ref={outRef} />
      </div>
      <div className="diff-overlay-hint">
        Drag to sweep — left of the line is vanilla, right is modded.
      </div>
    </div>
  );
}
