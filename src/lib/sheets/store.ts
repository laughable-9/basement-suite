// In-memory editable spritesheet documents. The editor mutates doc.canvas;
// subscribers (the player, in M3's live link) re-read it on version bumps.
// Nothing here touches disk after load — saving is M3's mod export.

import { readFile } from "@tauri-apps/plugin-fs";

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

export function bumpSheet(doc: SheetDoc): void {
  doc.version++;
  doc.dirty = true;
  listeners.get(doc.path)?.forEach((cb) => cb());
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
