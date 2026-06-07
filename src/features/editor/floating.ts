// Floating paste: a pasted image hovers over the sheet (still full-res),
// movable and scalable; committing stamps it into the sheet's pixel grid —
// the downscale to sheet resolution is what pixelizes it.

import { beginStroke } from "./history";
import { activeLayer, type SheetDoc } from "../../lib/sheets/store";

export interface Floating {
  source: ImageBitmap;
  /** Doc-space rect (fractional while dragging; rounded at commit) */
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Build a floating object from a pasted image, fit inside the sheet. */
export function makeFloating(source: ImageBitmap, doc: SheetDoc): Floating {
  const fit = Math.min(
    1,
    doc.canvas.width / source.width,
    doc.canvas.height / source.height,
  );
  const w = Math.max(1, source.width * fit);
  const h = Math.max(1, source.height * fit);
  return {
    source,
    x: Math.round((doc.canvas.width - w) / 2),
    y: Math.round((doc.canvas.height - h) / 2),
    w,
    h,
  };
}

/** Stamp the floating image into the sheet (undoable single stroke). */
export function commitFloating(doc: SheetDoc, f: Floating): void {
  const x = Math.round(f.x);
  const y = Math.round(f.y);
  const w = Math.max(1, Math.round(f.w));
  const h = Math.max(1, Math.round(f.h));

  const rec = beginStroke(doc, "Paste");
  const ctx = activeLayer(doc).ctx;
  // High-quality downsample onto the sheet's grid: each target pixel becomes
  // an area average of the source — this IS the pixelization step.
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(f.source, x, y, w, h);
  ctx.imageSmoothingEnabled = false;
  rec.touch(x, y, w, h);
  rec.commit();
  f.source.close();
}
