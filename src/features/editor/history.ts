// Stroke-grained undo/redo per sheet document. Patches store only the
// stroke's bounding box, so depth is cheap even on 2048px sheets.

import { bumpSheet, type SheetDoc } from "../../lib/sheets/store";

const MAX_DEPTH = 200;

interface Patch {
  x: number;
  y: number;
  before: ImageData;
  after: ImageData;
}

interface History {
  undo: Patch[];
  redo: Patch[];
}

const histories = new Map<string, History>();

function historyFor(doc: SheetDoc): History {
  let h = histories.get(doc.path);
  if (!h) {
    h = { undo: [], redo: [] };
    histories.set(doc.path, h);
  }
  return h;
}

export interface StrokeRecorder {
  /** Extend the stroke's dirty region (doc pixel coords). */
  touch(x: number, y: number, w?: number, h?: number): void;
  /** Finalize: diff against the pre-stroke snapshot and push an undo patch. */
  commit(): void;
}

/** Call on pointerdown, before the first paint of a stroke. */
export function beginStroke(doc: SheetDoc): StrokeRecorder {
  const pre = document.createElement("canvas");
  pre.width = doc.canvas.width;
  pre.height = doc.canvas.height;
  pre.getContext("2d")!.drawImage(doc.canvas, 0, 0);

  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

  return {
    touch(x, y, w = 1, h = 1) {
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x + w);
      maxY = Math.max(maxY, y + h);
    },
    commit() {
      if (minX === Infinity) return; // nothing painted
      const x = Math.max(0, Math.floor(minX));
      const y = Math.max(0, Math.floor(minY));
      const w = Math.min(doc.canvas.width, Math.ceil(maxX)) - x;
      const h = Math.min(doc.canvas.height, Math.ceil(maxY)) - y;
      if (w <= 0 || h <= 0) return;

      const h2 = historyFor(doc);
      h2.undo.push({
        x,
        y,
        before: pre.getContext("2d")!.getImageData(x, y, w, h),
        after: doc.ctx.getImageData(x, y, w, h),
      });
      if (h2.undo.length > MAX_DEPTH) h2.undo.shift();
      h2.redo.length = 0;
      bumpSheet(doc);
    },
  };
}

export function undo(doc: SheetDoc): boolean {
  const h = historyFor(doc);
  const patch = h.undo.pop();
  if (!patch) return false;
  doc.ctx.putImageData(patch.before, patch.x, patch.y);
  h.redo.push(patch);
  bumpSheet(doc);
  return true;
}

export function redo(doc: SheetDoc): boolean {
  const h = historyFor(doc);
  const patch = h.redo.pop();
  if (!patch) return false;
  doc.ctx.putImageData(patch.after, patch.x, patch.y);
  h.undo.push(patch);
  bumpSheet(doc);
  return true;
}

export function canUndo(doc: SheetDoc): boolean {
  return historyFor(doc).undo.length > 0;
}

export function canRedo(doc: SheetDoc): boolean {
  return historyFor(doc).redo.length > 0;
}
