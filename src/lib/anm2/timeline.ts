// Timeline evaluation: continuous tick t → resolved frame state per track.
// Pure functions, no DOM/Tauri.

import type { LayerFrame, Rgb, Rgba, TransformFrame } from "./types";

export interface ResolvedTransform {
  x: number;
  y: number;
  xScale: number;
  yScale: number;
  rotation: number;
  visible: boolean;
  tint: Rgba;
  offset: Rgb;
}

export interface ResolvedLayerFrame extends ResolvedTransform {
  xCrop: number;
  yCrop: number;
  width: number;
  height: number;
  xPivot: number;
  yPivot: number;
}

function lerp(a: number, b: number, f: number): number {
  return a + (b - a) * f;
}

/**
 * Locate the keyframe active at tick t (cumulative-delay walk) and the lerp
 * factor into it. Past the end of the track, the last keyframe holds —
 * tracks are often shorter than the animation's FrameNum.
 */
function locate<F extends TransformFrame>(
  frames: F[],
  t: number,
): { frame: F; next: F | null; factor: number } | null {
  if (frames.length === 0) return null;
  let start = 0;
  for (let i = 0; i < frames.length; i++) {
    const f = frames[i];
    // Delay=0 keyframes occur in game data: zero-duration, skip over them.
    if (t < start + f.delay) {
      const next = i + 1 < frames.length ? frames[i + 1] : null;
      const factor = f.delay > 0 ? (t - start) / f.delay : 0;
      return { frame: f, next, factor };
    }
    start += f.delay;
  }
  return { frame: frames[frames.length - 1], next: null, factor: 0 };
}

function resolveTransform(
  f: TransformFrame,
  next: TransformFrame | null,
  factor: number,
): ResolvedTransform {
  if (!f.interpolated || next === null || factor <= 0) {
    return {
      x: f.x,
      y: f.y,
      xScale: f.xScale,
      yScale: f.yScale,
      rotation: f.rotation,
      visible: f.visible,
      tint: f.tint,
      offset: f.offset,
    };
  }
  return {
    x: lerp(f.x, next.x, factor),
    y: lerp(f.y, next.y, factor),
    xScale: lerp(f.xScale, next.xScale, factor),
    yScale: lerp(f.yScale, next.yScale, factor),
    rotation: lerp(f.rotation, next.rotation, factor),
    visible: f.visible,
    tint: {
      r: lerp(f.tint.r, next.tint.r, factor),
      g: lerp(f.tint.g, next.tint.g, factor),
      b: lerp(f.tint.b, next.tint.b, factor),
      a: lerp(f.tint.a, next.tint.a, factor),
    },
    offset: {
      r: lerp(f.offset.r, next.offset.r, factor),
      g: lerp(f.offset.g, next.offset.g, factor),
      b: lerp(f.offset.b, next.offset.b, factor),
    },
  };
}

export function sampleTransformTrack(
  frames: TransformFrame[],
  t: number,
): ResolvedTransform | null {
  const hit = locate(frames, t);
  return hit && resolveTransform(hit.frame, hit.next, hit.factor);
}

export function sampleLayerTrack(
  frames: LayerFrame[],
  t: number,
): ResolvedLayerFrame | null {
  const hit = locate(frames, t);
  if (!hit) return null;
  const { frame, next, factor } = hit;
  return {
    ...resolveTransform(frame, next, factor),
    // Source rect and pivot are NOT interpolated — crop jumps are frame swaps.
    xCrop: frame.xCrop,
    yCrop: frame.yCrop,
    width: frame.width,
    height: frame.height,
    xPivot: frame.xPivot,
    yPivot: frame.yPivot,
  };
}

/** Wrap/clamp a continuous playhead into an animation's [0, frameNum) range. */
export function normalizeTime(
  t: number,
  frameNum: number,
  loop: boolean,
): number {
  if (frameNum <= 0) return 0;
  if (loop) return ((t % frameNum) + frameNum) % frameNum;
  // Hold just inside the final tick so the last keyframe stays resolved.
  return Math.min(t, frameNum - 1e-6);
}
