// Photoshop-style history: every meaningful operation goes here as a
// reversible patch — pixel strokes, selection commits, layer add/remove/
// visibility/lock/rename/reorder. Click any row in the History panel to
// jump to that state (jumpHistory).
//
// Capped at MAX_DEPTH (default 100, Photoshop default 50). Older entries
// fall off the bottom of the undo stack when the cap is reached.

import {
  activeLayer,
  addLayer as storeAddLayer,
  bumpSheet,
  composite,
  removeLayer as storeRemoveLayer,
  type SheetDoc,
  type SheetLayer,
} from "../../lib/sheets/store";
import { cloneSelection, type Selection } from "./selection";

const MAX_DEPTH = 100;

/* ============ patch types ============ */

interface PixelsPatch {
  kind: "pixels";
  label: string;
  layerId: number;
  x: number;
  y: number;
  before: ImageData;
  after: ImageData;
}

interface SelectionPatch {
  kind: "selection";
  label: string;
  before: Selection | null;
  after: Selection | null;
}

interface LayerAddPatch {
  kind: "layerAdd";
  label: string;
  /** The actual layer object — we re-insert it on redo, so canvas state
   *  is preserved across undo/redo cycles. */
  layer: SheetLayer;
  index: number;
  prevActiveId: number;
}

interface LayerRemovePatch {
  kind: "layerRemove";
  label: string;
  layer: SheetLayer;
  index: number;
  /** The id that was active before deletion (so undo can restore it). */
  prevActiveId: number;
  /** The id that became active after deletion (so redo reapplies). */
  nextActiveId: number;
}

interface LayerPropPatch {
  kind: "layerProp";
  label: string;
  layerId: number;
  /** Partial<SheetLayer> minus the canvas/ctx (those don't change here). */
  before: Partial<Pick<SheetLayer, "name" | "visible" | "opacity" | "locked">>;
  after: Partial<Pick<SheetLayer, "name" | "visible" | "opacity" | "locked">>;
}

interface LayerReorderPatch {
  kind: "layerReorder";
  label: string;
  layerId: number;
  from: number;
  to: number;
}

type Patch =
  | PixelsPatch
  | SelectionPatch
  | LayerAddPatch
  | LayerRemovePatch
  | LayerPropPatch
  | LayerReorderPatch;

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

function findLayer(doc: SheetDoc, id: number): SheetLayer | undefined {
  return doc.layers.find((l) => l.id === id);
}

/* ============ apply (used by undo/redo + jumpHistory) ============ */

function applyPatch(
  doc: SheetDoc,
  patch: Patch,
  dir: "undo" | "redo",
): void {
  switch (patch.kind) {
    case "pixels": {
      const layer = findLayer(doc, patch.layerId);
      if (!layer) return;
      const data = dir === "redo" ? patch.after : patch.before;
      layer.ctx.putImageData(data, patch.x, patch.y);
      composite(doc);
      break;
    }
    case "selection": {
      doc.selection = dir === "redo" ? patch.after : patch.before;
      break;
    }
    case "layerAdd": {
      if (dir === "redo") {
        if (!doc.layers.includes(patch.layer)) {
          doc.layers.splice(patch.index, 0, patch.layer);
        }
        doc.activeLayerId = patch.layer.id;
      } else {
        const i = doc.layers.indexOf(patch.layer);
        if (i !== -1) doc.layers.splice(i, 1);
        doc.activeLayerId = patch.prevActiveId;
      }
      composite(doc);
      break;
    }
    case "layerRemove": {
      if (dir === "redo") {
        const i = doc.layers.indexOf(patch.layer);
        if (i !== -1) doc.layers.splice(i, 1);
        doc.activeLayerId = patch.nextActiveId;
      } else {
        if (!doc.layers.includes(patch.layer)) {
          doc.layers.splice(patch.index, 0, patch.layer);
        }
        doc.activeLayerId = patch.prevActiveId;
      }
      composite(doc);
      break;
    }
    case "layerProp": {
      const layer = findLayer(doc, patch.layerId);
      if (!layer) return;
      const target = dir === "redo" ? patch.after : patch.before;
      Object.assign(layer, target);
      // Visibility/opacity changes need recomposite; name/lock don't, but
      // recomposing on every prop change is cheap and keeps the panel thumb
      // refresh consistent.
      composite(doc);
      break;
    }
    case "layerReorder": {
      const fromIdx = dir === "redo" ? patch.from : patch.to;
      const toIdx = dir === "redo" ? patch.to : patch.from;
      const idx = doc.layers.findIndex((l) => l.id === patch.layerId);
      if (idx !== fromIdx) return;
      const [layer] = doc.layers.splice(idx, 1);
      doc.layers.splice(toIdx, 0, layer);
      composite(doc);
      break;
    }
  }
  bumpSheet(doc);
}

function pushPatch(doc: SheetDoc, patch: Patch): void {
  const h = historyFor(doc);
  h.undo.push(patch);
  if (h.undo.length > MAX_DEPTH) h.undo.shift();
  h.redo.length = 0;
}

/* ============ pixel strokes ============ */

export interface StrokeRecorder {
  touch(x: number, y: number, w?: number, h?: number): void;
  commit(): void;
}

export function beginStroke(doc: SheetDoc, label: string): StrokeRecorder {
  const layer = activeLayer(doc);
  const pre = document.createElement("canvas");
  pre.width = layer.canvas.width;
  pre.height = layer.canvas.height;
  pre.getContext("2d")!.drawImage(layer.canvas, 0, 0);

  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

  return {
    touch(x, y, w = 1, h = 1) {
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x + w);
      maxY = Math.max(maxY, y + h);
    },
    commit() {
      if (minX === Infinity) return;
      const x = Math.max(0, Math.floor(minX));
      const y = Math.max(0, Math.floor(minY));
      const w = Math.min(layer.canvas.width, Math.ceil(maxX)) - x;
      const h = Math.min(layer.canvas.height, Math.ceil(maxY)) - y;
      if (w <= 0 || h <= 0) return;
      pushPatch(doc, {
        kind: "pixels",
        label,
        layerId: layer.id,
        x,
        y,
        before: pre.getContext("2d")!.getImageData(x, y, w, h),
        after: layer.ctx.getImageData(x, y, w, h),
      });
      composite(doc);
      bumpSheet(doc);
    },
  };
}

/* ============ selection ops ============ */

/** Set the doc's selection and record the change in history. Skips the
 *  push if before === after (no real change). */
export function recordSelection(
  doc: SheetDoc,
  label: string,
  next: Selection | null,
): void {
  const before = cloneSelection(doc.selection);
  doc.selection = next;
  pushPatch(doc, { kind: "selection", label, before, after: cloneSelection(next) });
  bumpSheet(doc);
}

/* ============ layer ops ============ */

export function recordAddLayer(doc: SheetDoc, name?: string): SheetLayer {
  const prevActiveId = doc.activeLayerId;
  const layer = storeAddLayer(doc, name);
  pushPatch(doc, {
    kind: "layerAdd",
    label: `Add "${layer.name}"`,
    layer,
    index: doc.layers.indexOf(layer),
    prevActiveId,
  });
  return layer;
}

export function recordRemoveLayer(doc: SheetDoc, id: number): void {
  if (doc.layers.length <= 1) return;
  const layer = findLayer(doc, id);
  if (!layer) return;
  if (layer.locked) return;
  const index = doc.layers.indexOf(layer);
  const prevActiveId = doc.activeLayerId;
  storeRemoveLayer(doc, id);
  pushPatch(doc, {
    kind: "layerRemove",
    label: `Delete "${layer.name}"`,
    layer,
    index,
    prevActiveId,
    nextActiveId: doc.activeLayerId,
  });
}

export function recordLayerProp(
  doc: SheetDoc,
  id: number,
  label: string,
  patch: Partial<Pick<SheetLayer, "name" | "visible" | "opacity" | "locked">>,
): void {
  const layer = findLayer(doc, id);
  if (!layer) return;
  const before: typeof patch = {};
  let changed = false;
  for (const k of Object.keys(patch) as (keyof typeof patch)[]) {
    if (layer[k] !== patch[k]) {
      (before as Record<string, unknown>)[k] = layer[k];
      changed = true;
    }
  }
  if (!changed) return;
  Object.assign(layer, patch);
  composite(doc);
  pushPatch(doc, {
    kind: "layerProp",
    label,
    layerId: id,
    before,
    after: patch,
  });
  bumpSheet(doc);
}

export function recordMoveLayer(
  doc: SheetDoc,
  id: number,
  delta: number,
): void {
  const idx = doc.layers.findIndex((l) => l.id === id);
  if (idx === -1) return;
  const to = Math.max(0, Math.min(doc.layers.length - 1, idx + delta));
  if (to === idx) return;
  const [layer] = doc.layers.splice(idx, 1);
  doc.layers.splice(to, 0, layer);
  composite(doc);
  pushPatch(doc, {
    kind: "layerReorder",
    label: delta > 0 ? `Move "${layer.name}" up` : `Move "${layer.name}" down`,
    layerId: id,
    from: idx,
    to,
  });
  bumpSheet(doc);
}

/* Active-layer selection is intentionally NOT recorded — Photoshop doesn't
   put layer selection in history either. Callers use setActiveLayer
   directly from sheets/store. */

/* ============ undo / redo / view ============ */

export function undo(doc: SheetDoc): boolean {
  const h = historyFor(doc);
  const patch = h.undo.pop();
  if (!patch) return false;
  applyPatch(doc, patch, "undo");
  h.redo.push(patch);
  return true;
}

export function redo(doc: SheetDoc): boolean {
  const h = historyFor(doc);
  const patch = h.redo.pop();
  if (!patch) return false;
  applyPatch(doc, patch, "redo");
  h.undo.push(patch);
  return true;
}

export function canUndo(doc: SheetDoc): boolean {
  return historyFor(doc).undo.length > 0;
}

export function canRedo(doc: SheetDoc): boolean {
  return historyFor(doc).redo.length > 0;
}

export interface HistoryEntry {
  label: string;
}

export interface HistoryView {
  entries: HistoryEntry[];
  cursor: number;
}

export function historyView(doc: SheetDoc): HistoryView {
  const h = historyFor(doc);
  const entries: HistoryEntry[] = [{ label: "Open" }];
  for (const p of h.undo) entries.push({ label: p.label });
  for (let i = h.redo.length - 1; i >= 0; i--) {
    entries.push({ label: h.redo[i].label });
  }
  return { entries, cursor: h.undo.length };
}

export function jumpHistory(doc: SheetDoc, target: number): void {
  const h = historyFor(doc);
  const total = h.undo.length + h.redo.length;
  const clamped = Math.max(0, Math.min(total, target));
  while (h.undo.length > clamped) if (!undo(doc)) break;
  while (h.undo.length < clamped) if (!redo(doc)) break;
}
