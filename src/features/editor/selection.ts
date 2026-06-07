// Editor selection — the "marching ants" region paint ops are clipped to.
// Two flavors share one type:
//
//   rect-only selection:  { bounds, mask: null }       (marquee)
//   masked selection:     { bounds, mask: <canvas> }   (magic wand)
//
// `bounds` is the bbox of the mask in doc pixels — always set, so callers
// can iterate or render a quick outline without scanning the mask.

import {
  activeLayer,
  type SelectionState,
  type SheetDoc,
  type SheetLayer,
} from "../../lib/sheets/store";

export interface SelectionBounds {
  x: number;
  y: number;
  w: number;
  h: number;
}

// Single source of truth — the doc owns selection state, this module just
// has the helpers that build / read / clear it.
export type Selection = SelectionState;

/** Translate selection (bounds + mask) by (dx, dy). Used by marquee
 *  inside-drag — Photoshop's "move the dashed outline only" gesture. */
export function translateSelection(
  sel: Selection,
  dx: number,
  dy: number,
): Selection {
  const bounds = {
    x: sel.bounds.x + dx,
    y: sel.bounds.y + dy,
    w: sel.bounds.w,
    h: sel.bounds.h,
  };
  if (!sel.mask) return { bounds, mask: null };
  const newMask = document.createElement("canvas");
  newMask.width = sel.mask.width;
  newMask.height = sel.mask.height;
  newMask.getContext("2d")!.drawImage(sel.mask, dx, dy);
  return { bounds, mask: newMask };
}

/** Clone a selection (used by history snapshots so the mask canvas can't
 *  be mutated later through aliasing). */
export function cloneSelection(sel: Selection | null): Selection | null {
  if (!sel) return null;
  if (!sel.mask) return { bounds: { ...sel.bounds }, mask: null };
  const c = document.createElement("canvas");
  c.width = sel.mask.width;
  c.height = sel.mask.height;
  c.getContext("2d")!.drawImage(sel.mask, 0, 0);
  return { bounds: { ...sel.bounds }, mask: c };
}

/** Does the selection contain the doc-space pixel (x, y)? */
export function inSelection(sel: Selection | null, x: number, y: number): boolean {
  if (!sel) return true; // no selection → no clipping
  const b = sel.bounds;
  if (x < b.x || y < b.y || x >= b.x + b.w || y >= b.y + b.h) return false;
  if (!sel.mask) return true;
  const ctx = sel.mask.getContext("2d", { willReadFrequently: true })!;
  const d = ctx.getImageData(x, y, 1, 1).data;
  return d[3] > 0;
}

/** Build a rect-only selection (used by the marquee tool on drag end). */
export function rectSelection(b: SelectionBounds): Selection | null {
  if (b.w <= 0 || b.h <= 0) return null;
  return { bounds: b, mask: null };
}

/**
 * Magic wand: pick all pixels connected to (x, y) within colour distance
 * `tolerance` (Euclidean RGBA, 0–255 scale) on the active layer. Returns
 * a masked selection or null if the click missed.
 */
export function magicWand(
  layer: SheetLayer,
  x: number,
  y: number,
  tolerance: number,
): Selection | null {
  const w = layer.canvas.width;
  const h = layer.canvas.height;
  if (x < 0 || y < 0 || x >= w || y >= h) return null;
  const img = layer.ctx.getImageData(0, 0, w, h).data;
  const startIdx = (y * w + x) * 4;
  const tr = img[startIdx];
  const tg = img[startIdx + 1];
  const tb = img[startIdx + 2];
  const ta = img[startIdx + 3];
  const tol2 = tolerance * tolerance * 4; // distance squared, RGBA channels

  const mask = document.createElement("canvas");
  mask.width = w;
  mask.height = h;
  const maskCtx = mask.getContext("2d", { willReadFrequently: true })!;
  const maskImg = maskCtx.createImageData(w, h);
  const md = maskImg.data;

  // Stack-based 4-way flood fill. Avoids the recursion cap on large regions.
  const visited = new Uint8Array(w * h);
  const stack: number[] = [y * w + x];
  let minX = x, minY = y, maxX = x, maxY = y;
  let any = false;

  while (stack.length) {
    const p = stack.pop()!;
    if (visited[p]) continue;
    visited[p] = 1;
    const i4 = p * 4;
    const dr = img[i4] - tr;
    const dg = img[i4 + 1] - tg;
    const db = img[i4 + 2] - tb;
    const da = img[i4 + 3] - ta;
    if (dr * dr + dg * dg + db * db + da * da > tol2) continue;

    md[i4] = 255;
    md[i4 + 1] = 255;
    md[i4 + 2] = 255;
    md[i4 + 3] = 255;
    any = true;

    const px = p % w;
    const py = (p - px) / w;
    if (px < minX) minX = px;
    if (py < minY) minY = py;
    if (px > maxX) maxX = px;
    if (py > maxY) maxY = py;
    if (px > 0) stack.push(p - 1);
    if (px < w - 1) stack.push(p + 1);
    if (py > 0) stack.push(p - w);
    if (py < h - 1) stack.push(p + w);
  }

  if (!any) return null;
  maskCtx.putImageData(maskImg, 0, 0);
  return {
    bounds: { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 },
    mask,
  };
}

/**
 * Build an HTMLCanvasElement of the selection bbox, copying only the masked
 * pixels of the active layer. Used by Ctrl+T (transform) and Alt+drag
 * (duplicate). If `cutFromLayer` is true, the source pixels are cleared.
 */
export function extractSelection(
  doc: SheetDoc,
  sel: Selection,
  cutFromLayer: boolean,
): HTMLCanvasElement {
  const layer = activeLayer(doc);
  const out = document.createElement("canvas");
  out.width = sel.bounds.w;
  out.height = sel.bounds.h;
  const outCtx = out.getContext("2d", { willReadFrequently: true })!;
  outCtx.imageSmoothingEnabled = false;

  // Crop layer pixels into the output.
  outCtx.drawImage(
    layer.canvas,
    sel.bounds.x, sel.bounds.y, sel.bounds.w, sel.bounds.h,
    0, 0, sel.bounds.w, sel.bounds.h,
  );

  // If masked, intersect the output with the mask (keep selected pixels only).
  if (sel.mask) {
    outCtx.globalCompositeOperation = "destination-in";
    outCtx.drawImage(
      sel.mask,
      sel.bounds.x, sel.bounds.y, sel.bounds.w, sel.bounds.h,
      0, 0, sel.bounds.w, sel.bounds.h,
    );
    outCtx.globalCompositeOperation = "source-over";
  }

  if (cutFromLayer) clearSelection(doc, sel);
  return out;
}

/**
 * Tight bbox of an entire layer's non-transparent pixels. Used by Ctrl+T /
 * Ctrl+X when no selection is active — Photoshop transforms / clears the
 * layer contents, not the full sheet canvas. Returns null for a fully
 * transparent layer.
 */
export function layerContentBounds(layer: SheetLayer): SelectionBounds | null {
  const w = layer.canvas.width;
  const h = layer.canvas.height;
  const data = layer.ctx.getImageData(0, 0, w, h).data;
  let minX = w, minY = h, maxX = -1, maxY = -1;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (data[(y * w + x) * 4 + 3] !== 0) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (maxX < 0) return null;
  return { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 };
}

/** Clear the masked pixels on the active layer (Ctrl+X / Delete). */
export function clearSelection(doc: SheetDoc, sel: Selection): void {
  const layer = activeLayer(doc);
  const ctx = layer.ctx;
  if (!sel.mask) {
    ctx.clearRect(sel.bounds.x, sel.bounds.y, sel.bounds.w, sel.bounds.h);
    return;
  }
  // destination-out: existing pixels removed where the mask is opaque.
  ctx.save();
  ctx.globalCompositeOperation = "destination-out";
  ctx.drawImage(sel.mask, 0, 0);
  ctx.restore();
}
