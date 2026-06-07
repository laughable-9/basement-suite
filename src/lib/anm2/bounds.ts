// Bounding box of an animation frame in entity space — used to auto-fit
// thumbnails. Pure math, mirrors the renderer's transform order.

import {
  sampleLayerTrack,
  sampleTransformTrack,
  type ResolvedTransform,
} from "./timeline";
import type { Anm2Animation } from "./types";

const DEG = Math.PI / 180;

const IDENTITY: ResolvedTransform = {
  x: 0, y: 0, xScale: 100, yScale: 100, rotation: 0,
  visible: true,
  tint: { r: 255, g: 255, b: 255, a: 255 },
  offset: { r: 0, g: 0, b: 0 },
};

export interface Bounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

export function unionBounds(
  a: Bounds | null,
  b: Bounds | null,
): Bounds | null {
  if (!a) return b;
  if (!b) return a;
  return {
    minX: Math.min(a.minX, b.minX),
    minY: Math.min(a.minY, b.minY),
    maxX: Math.max(a.maxX, b.maxX),
    maxY: Math.max(a.maxY, b.maxY),
  };
}

export function frameBounds(anim: Anm2Animation, t: number): Bounds | null {
  const root = sampleTransformTrack(anim.rootFrames, t) ?? IDENTITY;
  if (!root.visible) return null;
  const rc = Math.cos(root.rotation * DEG);
  const rs = Math.sin(root.rotation * DEG);

  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

  for (const track of anim.layers) {
    if (!track.visible) continue;
    const f = sampleLayerTrack(track.frames, t);
    if (!f || !f.visible || f.width <= 0 || f.height <= 0) continue;
    const fc = Math.cos(f.rotation * DEG);
    const fs = Math.sin(f.rotation * DEG);
    const corners: [number, number][] = [
      [-f.xPivot, -f.yPivot],
      [f.width - f.xPivot, -f.yPivot],
      [-f.xPivot, f.height - f.yPivot],
      [f.width - f.xPivot, f.height - f.yPivot],
    ];
    for (const [cx, cy] of corners) {
      // layer frame transform: scale → rotate → translate
      let x = cx * (f.xScale / 100);
      let y = cy * (f.yScale / 100);
      [x, y] = [x * fc - y * fs, x * fs + y * fc];
      x += f.x;
      y += f.y;
      // root transform on top
      x *= root.xScale / 100;
      y *= root.yScale / 100;
      [x, y] = [x * rc - y * rs, x * rs + y * rc];
      x += root.x;
      y += root.y;
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    }
  }
  return minX === Infinity ? null : { minX, minY, maxX, maxY };
}
