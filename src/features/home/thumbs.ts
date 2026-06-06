// U2 cheap card thumbnails: for png entries, the png itself; for anm2
// entries, the anm2's first referenced spritesheet. U3 replaces this with
// rendered first-frames of the default animation.

import { pngUrl, readText } from "../../lib/fsx/fs";
import { dirname, resolveRelative } from "../../lib/fsx/resolve";
import type { WorkTab } from "../../app/store";

const cache = new Map<string, Promise<string | null>>();

const SHEET_RE = /<Spritesheet\b[^>]*\bPath="([^"]*)"/;

async function resolveThumb(tab: WorkTab): Promise<string | null> {
  if (tab.sheetPath) {
    return pngUrl(tab.sheetPath).catch(() => null);
  }
  if (tab.anm2Path) {
    try {
      const xml = await readText(tab.anm2Path);
      const raw = SHEET_RE.exec(xml)?.[1];
      if (!raw) return null;
      return await pngUrl(resolveRelative(dirname(tab.anm2Path), raw));
    } catch {
      return null;
    }
  }
  return null;
}

/** Blob URL for a card thumbnail, or null when unavailable. Cached forever. */
export function thumbUrl(tab: WorkTab): Promise<string | null> {
  let p = cache.get(tab.id);
  if (!p) {
    p = resolveThumb(tab);
    cache.set(tab.id, p);
  }
  return p;
}
