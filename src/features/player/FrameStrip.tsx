// Film-strip view of every frame in the active animation. Each thumbnail
// is the composited sprite rendered at that integer tick, lazily drawn as
// it scrolls into view. Click a frame → seek the player + (if the editor
// is open on a sheet that participates in this animation) ask the editor
// to pan to that frame's crop rect.
//
// Uses the WHOLE-animation bounds for fit zoom so thumbnails are at a
// consistent scale instead of jumping per-frame as bounds tighten/widen.

import { useEffect, useRef } from "react";
import { frameBounds, unionBounds, type Bounds } from "../../lib/anm2/bounds";
import type { Anm2, Anm2Animation } from "../../lib/anm2/types";
import { renderFrame, type SheetMap } from "./render";

const THUMB_W = 64;
const THUMB_H = 64;
const FIT_PAD = 6;

interface Props {
  anm2: Anm2;
  anim: Anm2Animation;
  sheets: SheetMap;
  /** Optional paired head animation (character composite) */
  headAnim: Anm2Animation | null;
  /** Costume composite — body then head overlay anims by name */
  costume: {
    anm2: Anm2;
    sheets: SheetMap;
  } | null;
  /** Whole-animation bounds (passed by parent so it's computed once) */
  bounds: Bounds | null;
  currentFrame: number;
  onSeek: (frame: number) => void;
}

export function FrameStrip({
  anm2,
  anim,
  sheets,
  headAnim,
  costume,
  bounds,
  currentFrame,
  onSeek,
}: Props) {
  if (anim.frameNum <= 0) return null;
  return (
    <div className="frame-strip" role="list">
      {Array.from({ length: anim.frameNum }).map((_, i) => (
        <FrameThumb
          key={i}
          anm2={anm2}
          anim={anim}
          sheets={sheets}
          headAnim={headAnim}
          costume={costume}
          bounds={bounds}
          frame={i}
          active={i === currentFrame}
          onClick={() => onSeek(i)}
        />
      ))}
    </div>
  );
}

interface ThumbProps {
  anm2: Anm2;
  anim: Anm2Animation;
  sheets: SheetMap;
  headAnim: Anm2Animation | null;
  costume: Props["costume"];
  bounds: Bounds | null;
  frame: number;
  active: boolean;
  onClick: () => void;
}

function FrameThumb({
  anm2,
  anim,
  sheets,
  headAnim,
  costume,
  bounds,
  frame,
  active,
  onClick,
}: ThumbProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let disposed = false;
    const observer = new IntersectionObserver(([hit]) => {
      if (!hit.isIntersecting) return;
      observer.disconnect();
      if (disposed) return;
      paint(canvas, anm2, anim, sheets, headAnim, costume, bounds, frame);
    });
    observer.observe(canvas);
    return () => {
      disposed = true;
      observer.disconnect();
    };
  }, [anm2, anim, sheets, headAnim, costume, bounds, frame]);

  return (
    <button
      className={`frame-thumb${active ? " active" : ""}`}
      title={`Frame ${frame + 1}`}
      onClick={onClick}
    >
      <span className="frame-thumb-canvas-wrap checkerboard">
        <canvas ref={canvasRef} />
      </span>
      <span className="frame-thumb-index">{frame + 1}</span>
    </button>
  );
}

function paint(
  canvas: HTMLCanvasElement,
  anm2: Anm2,
  anim: Anm2Animation,
  sheets: SheetMap,
  headAnim: Anm2Animation | null,
  costume: Props["costume"],
  bounds: Bounds | null,
  frame: number,
) {
  const dpr = window.devicePixelRatio || 1;
  canvas.width = THUMB_W * dpr;
  canvas.height = THUMB_H * dpr;
  const ctx = canvas.getContext("2d")!;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, THUMB_W, THUMB_H);
  ctx.imageSmoothingEnabled = false;

  // Pick a fit zoom: prefer animation-wide bounds for stable scale, then
  // union with this frame's head so we don't crop tall poses (the head
  // anim is shorter than the body so we don't combine timelines here).
  const headBounds =
    headAnim && headAnim.frameNum > 0
      ? frameBounds(headAnim, frame % headAnim.frameNum)
      : null;
  const b = unionBounds(bounds, headBounds);
  if (!b) return;
  const bw = Math.max(1, b.maxX - b.minX);
  const bh = Math.max(1, b.maxY - b.minY);
  const scale = Math.max(
    0.1,
    Math.min((THUMB_W - FIT_PAD * 2) / bw, (THUMB_H - FIT_PAD * 2) / bh),
  );
  const cx = (b.minX + b.maxX) / 2;
  const cy = (b.minY + b.maxY) / 2;
  ctx.translate(THUMB_W / 2 - cx * scale, THUMB_H / 2 - cy * scale);
  ctx.scale(scale, scale);

  // Same engine ordering as the main preview: costume body → body →
  // head → costume head overlay. Costume anims paired by NAME.
  const at = (a: Anm2Animation) => frame % Math.max(1, a.frameNum);
  const cBody = costume?.anm2.animations.find((a) => a.name === anim.name);
  const cHead =
    headAnim && costume?.anm2.animations.find((a) => a.name === headAnim.name);
  if (costume && cBody) {
    renderFrame(ctx, costume.anm2, cBody, at(cBody), costume.sheets);
  }
  renderFrame(ctx, anm2, anim, frame, sheets);
  if (headAnim && headAnim.frameNum > 0) {
    renderFrame(ctx, anm2, headAnim, at(headAnim), sheets);
  }
  if (costume && cHead) {
    renderFrame(ctx, costume.anm2, cHead, at(cHead), costume.sheets);
  }
}
