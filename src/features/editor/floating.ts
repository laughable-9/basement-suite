// Floating paste: a pasted image hovers over the sheet (still full-res),
// movable and scalable; committing stamps it into the sheet's pixel grid —
// the downscale to sheet resolution is what pixelizes it.

import {
  beginStroke,
  type StrokeRecorder,
} from "./history";
import {
  activeLayer,
  previewSelection,
  type SheetDoc,
} from "../../lib/sheets/store";
import type { Selection } from "./selection";

/** Source can be either an async-decoded ImageBitmap (Ctrl+V paste) or a
 *  synchronous canvas (Move tool, transform). drawImage accepts both. */
export type FloatingSource = ImageBitmap | HTMLCanvasElement;

export interface Floating {
  source: FloatingSource;
  /** Doc-space rect (fractional while dragging; rounded at commit) */
  x: number;
  y: number;
  w: number;
  h: number;
  /** When set, the stroke recorder is committed at stamp time so the cut
   *  (already applied to the layer) and the paste land as one patch. */
  recorder?: StrokeRecorder;
  /** Override the commit's history label. Defaults to "Paste". */
  commitLabel?: string;
  /** Selection at lift time. Cleared via previewSelection (no history) so
   *  Esc-cancel can restore it without leaving an orphan "Deselect" patch. */
  priorSelection?: Selection | null;
}

/** Safely release a FloatingSource — ImageBitmaps need close(), canvases don't. */
export function closeSource(s: FloatingSource): void {
  if ("close" in s && typeof s.close === "function") s.close();
}

/** Cancel a floating object. Restores the selection that was active at lift
 *  time (if any) and aborts the carry-along stroke recorder so pixels go
 *  back to their pre-lift state. */
export function cancelFloating(doc: SheetDoc, f: Floating): void {
  f.recorder?.abort();
  if (f.priorSelection !== undefined) previewSelection(doc, f.priorSelection);
  closeSource(f.source);
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

  // Carry-along recorder: a Move-tool gesture began its stroke at lift time
  // and held it open through the drag so cut+paste collapse to one patch.
  const rec = f.recorder ?? beginStroke(doc, f.commitLabel ?? "Paste");
  const ctx = activeLayer(doc).ctx;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(f.source, x, y, w, h);
  ctx.imageSmoothingEnabled = false;
  rec.touch(x, y, w, h);
  rec.commit();
  closeSource(f.source);
}
