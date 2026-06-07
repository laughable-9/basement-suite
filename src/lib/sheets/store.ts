// In-memory editable spritesheet documents. Now multi-layer:
//
//   doc.layers      = list of SheetLayer (bottom-to-top render order)
//   doc.canvas      = composite — what the player/thumbs/diff/save all read
//   doc.activeLayerId = which layer receives strokes
//
// Drawing tools target the active layer via `activeLayer(doc).ctx`. After any
// layer change (visibility, opacity, pixels, reorder, add/delete) callers
// run `composite(doc)` so the public `doc.canvas` stays in sync, then
// `bumpSheet(doc)` so subscribers (player live link, sheet thumb) repaint.

import { readFile } from "@tauri-apps/plugin-fs";
import type { Anm2 } from "../anm2/types";
import { overlayPath } from "../fsx/modOverlay";
import { dirname, resolveRelative } from "../fsx/resolve";
import { registerSheetPath } from "./dirty";

/** Spritesheet pixel sources by spritesheet id; null = file missing. */
export type SheetMap = Map<number, HTMLCanvasElement | null>;

export interface SheetLayer {
  id: number;
  name: string;
  visible: boolean;
  /** 0..1 */
  opacity: number;
  /** Locked layers reject paint, transform, clear, and delete. */
  locked: boolean;
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
}

/** Selection lives on the doc so undo/redo can flip it through history. */
export interface SelectionState {
  bounds: { x: number; y: number; w: number; h: number };
  /** Optional doc-sized binary alpha mask; null = the bounds rect itself. */
  mask: HTMLCanvasElement | null;
}

export interface SheetDoc {
  path: string;
  /** Composite of all visible layers — read by player/thumb/diff/save. */
  canvas: HTMLCanvasElement;
  /** Composite context. For reads (palette, eyedropper). Drawing tools must
   *  target the active layer instead via `activeLayer(doc).ctx`. */
  ctx: CanvasRenderingContext2D;
  layers: SheetLayer[];
  activeLayerId: number;
  selection: SelectionState | null;
  version: number;
  dirty: boolean;
}

const docs = new Map<string, SheetDoc>();
const listeners = new Map<string, Set<() => void>>();

async function decode(path: string): Promise<HTMLCanvasElement> {
  const bytes = await readFile(path);
  const bitmap = await createImageBitmap(
    new Blob([bytes], { type: "image/png" }),
  );
  const canvas = document.createElement("canvas");
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0);
  bitmap.close();
  return canvas;
}

function mkCanvas(w: number, h: number): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  return c;
}

/** Redraw `doc.canvas` from all visible layers bottom-to-top. */
export function composite(doc: SheetDoc): void {
  const ctx = doc.ctx;
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.imageSmoothingEnabled = false;
  ctx.globalAlpha = 1;
  ctx.clearRect(0, 0, doc.canvas.width, doc.canvas.height);
  for (const layer of doc.layers) {
    if (!layer.visible || layer.opacity <= 0) continue;
    ctx.globalAlpha = layer.opacity;
    ctx.drawImage(layer.canvas, 0, 0);
  }
  ctx.restore();
}

/** Mid-drag selection updates that shouldn't be in history. The recorded
 *  commit goes through `recordSelection` in history.ts. */
export function previewSelection(
  doc: SheetDoc,
  sel: SelectionState | null,
): void {
  doc.selection = sel;
  listeners.get(doc.path)?.forEach((cb) => cb());
}

export function activeLayer(doc: SheetDoc): SheetLayer {
  // Active layer is guaranteed to exist (we never let the list go empty).
  return (
    doc.layers.find((l) => l.id === doc.activeLayerId) ?? doc.layers[0]
  );
}

export async function getSheetDoc(path: string): Promise<SheetDoc> {
  const existing = docs.get(path);
  if (existing) return existing;
  const decoded = await decode(path);

  // Single background layer holds the original pixels.
  const bgLayer: SheetLayer = {
    id: 1,
    name: "Background",
    visible: true,
    opacity: 1,
    locked: false,
    canvas: decoded,
    ctx: decoded.getContext("2d", { willReadFrequently: true })!,
  };
  const compositeCanvas = mkCanvas(decoded.width, decoded.height);
  const doc: SheetDoc = {
    path,
    canvas: compositeCanvas,
    ctx: compositeCanvas.getContext("2d", { willReadFrequently: true })!,
    layers: [bgLayer],
    activeLayerId: bgLayer.id,
    selection: null,
    version: 0,
    dirty: false,
  };
  composite(doc);
  docs.set(path, doc);
  registerSheetPath(path);
  return doc;
}

/** Synchronous lookup for already-loaded docs (player live link). */
export function peekSheetDoc(path: string): SheetDoc | undefined {
  return docs.get(path);
}

export function clearAllSheets(): void {
  docs.clear();
  for (const set of listeners.values()) {
    for (const cb of set) cb();
  }
}

export function bumpSheet(doc: SheetDoc): void {
  doc.version++;
  doc.dirty = true;
  listeners.get(doc.path)?.forEach((cb) => cb());
}

/** After a successful save: clear dirty and notify subscribers. */
export function markSheetClean(doc: SheetDoc): void {
  doc.version++;
  doc.dirty = false;
  listeners.get(doc.path)?.forEach((cb) => cb());
}

/* ---------- layer mutations ---------- */

function nextLayerId(doc: SheetDoc): number {
  return Math.max(0, ...doc.layers.map((l) => l.id)) + 1;
}

/** Add a transparent layer above the active one and make it active. */
export function addLayer(doc: SheetDoc, name?: string): SheetLayer {
  const id = nextLayerId(doc);
  const c = mkCanvas(doc.canvas.width, doc.canvas.height);
  const layer: SheetLayer = {
    id,
    name: name ?? `Layer ${doc.layers.length + 1}`,
    visible: true,
    opacity: 1,
    locked: false,
    canvas: c,
    ctx: c.getContext("2d", { willReadFrequently: true })!,
  };
  // Insert just above the current active layer so the new pixels paint
  // on top of what the user was looking at.
  const idx = doc.layers.findIndex((l) => l.id === doc.activeLayerId);
  doc.layers.splice(idx + 1, 0, layer);
  doc.activeLayerId = id;
  composite(doc);
  bumpSheet(doc);
  return layer;
}

/** Remove a layer. Never empties the doc — the last layer can't be deleted. */
export function removeLayer(doc: SheetDoc, id: number): void {
  if (doc.layers.length <= 1) return;
  const idx = doc.layers.findIndex((l) => l.id === id);
  if (idx === -1) return;
  doc.layers.splice(idx, 1);
  if (doc.activeLayerId === id) {
    doc.activeLayerId =
      doc.layers[Math.min(idx, doc.layers.length - 1)].id;
  }
  composite(doc);
  bumpSheet(doc);
}

export function setActiveLayer(doc: SheetDoc, id: number): void {
  if (!doc.layers.some((l) => l.id === id)) return;
  doc.activeLayerId = id;
  // No composite or bump — selection alone doesn't change pixels, but
  // subscribers may want to know (panel re-render).
  listeners.get(doc.path)?.forEach((cb) => cb());
}

export function setLayerVisible(
  doc: SheetDoc,
  id: number,
  visible: boolean,
): void {
  const layer = doc.layers.find((l) => l.id === id);
  if (!layer || layer.visible === visible) return;
  layer.visible = visible;
  composite(doc);
  bumpSheet(doc);
}

export function setLayerOpacity(
  doc: SheetDoc,
  id: number,
  opacity: number,
): void {
  const layer = doc.layers.find((l) => l.id === id);
  if (!layer) return;
  const clamped = Math.max(0, Math.min(1, opacity));
  if (layer.opacity === clamped) return;
  layer.opacity = clamped;
  composite(doc);
  bumpSheet(doc);
}

export function setLayerName(doc: SheetDoc, id: number, name: string): void {
  const layer = doc.layers.find((l) => l.id === id);
  if (!layer) return;
  layer.name = name;
  listeners.get(doc.path)?.forEach((cb) => cb());
}

/** Shift a layer up (toward top of stack) or down by `delta` slots. */
export function moveLayer(doc: SheetDoc, id: number, delta: number): void {
  const idx = doc.layers.findIndex((l) => l.id === id);
  if (idx === -1) return;
  const newIdx = Math.max(0, Math.min(doc.layers.length - 1, idx + delta));
  if (newIdx === idx) return;
  const [layer] = doc.layers.splice(idx, 1);
  doc.layers.splice(newIdx, 0, layer);
  composite(doc);
  bumpSheet(doc);
}

/* ---------- loaders unchanged ---------- */

export interface LoadedAnm2Sheets {
  sheets: SheetMap;
  /** Resolved absolute paths that loaded (live-link subscription hooks) */
  paths: string[];
  /** Spritesheet id → resolved absolute path (editor entry points) */
  byId: Map<number, string>;
  /** Raw XML paths that failed to load (broken refs like raglich) */
  missing: string[];
}

/**
 * Load every spritesheet an anm2 references as shared sheet docs.
 * `skinPath` substitutes sheet id 0 (character skins share the player layout).
 */
export async function loadAnm2Sheets(
  anm2: Anm2,
  anm2Path: string,
  skinPath?: string | null,
): Promise<LoadedAnm2Sheets> {
  const dir = dirname(anm2Path);
  const result: LoadedAnm2Sheets = {
    sheets: new Map(),
    paths: [],
    byId: new Map(),
    missing: [],
  };
  await Promise.all(
    anm2.content.spritesheets.map(async (s) => {
      const candidate =
        skinPath && s.id === 0 ? skinPath : resolveRelative(dir, s.rawPath);
      // Active-mod overlay: if the user's mod overrides this file, swap to
      // the modded path so the preview reflects their edits.
      const resolved = await overlayPath(candidate);
      result.byId.set(s.id, resolved);
      try {
        result.sheets.set(s.id, (await getSheetDoc(resolved)).canvas);
        result.paths.push(resolved);
      } catch {
        result.sheets.set(s.id, null);
        result.missing.push(s.rawPath);
      }
    }),
  );
  return result;
}

export function subscribeSheet(path: string, cb: () => void): () => void {
  let set = listeners.get(path);
  if (!set) {
    set = new Set();
    listeners.set(path, set);
  }
  set.add(cb);
  return () => {
    set.delete(cb);
  };
}
