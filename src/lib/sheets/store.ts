// In-memory editable spritesheet documents. The editor mutates doc.canvas;
// subscribers (the player, in M3's live link) re-read it on version bumps.
// Nothing here touches disk after load — saving is M3's mod export.

import { readFile } from "@tauri-apps/plugin-fs";
import type { Anm2 } from "../anm2/types";
import { overlayPath } from "../fsx/modOverlay";
import { dirname, resolveRelative } from "../fsx/resolve";

/** Spritesheet pixel sources by spritesheet id; null = file missing. */
export type SheetMap = Map<number, HTMLCanvasElement | null>;

export interface SheetDoc {
  path: string;
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
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

export async function getSheetDoc(path: string): Promise<SheetDoc> {
  const existing = docs.get(path);
  if (existing) return existing;
  const canvas = await decode(path);
  const doc: SheetDoc = {
    path,
    canvas,
    ctx: canvas.getContext("2d", { willReadFrequently: true })!,
    version: 0,
    dirty: false,
  };
  docs.set(path, doc);
  return doc;
}

/** Synchronous lookup for already-loaded docs (player live link). */
export function peekSheetDoc(path: string): SheetDoc | undefined {
  return docs.get(path);
}

/**
 * Drop every cached SheetDoc — used when the active mod changes, because
 * file resolution moves to a different absolute path and previously-cached
 * vanilla docs would otherwise mask the modded ones. Any in-memory edits
 * on dropped docs are lost: callers must check dirty state first.
 */
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
