// Active-mod overlay: turns a vanilla gfx path into the modded one when the
// active mod has an override for it. Without this layer "active mod" is just
// a write destination — the preview keeps reading from extracted_resources.
//
// We're called per spritesheet on every anm2 load, so each (mod, rel) lookup
// is cached. Cleared when the active mod changes or when a save lands.

import { exists as tauriExists } from "@tauri-apps/plugin-fs";

interface OverlayConfig {
  gfxRoot: string;
  modsPath: string;
  activeMod: string;
}

let current: OverlayConfig | null = null;
// (mod, rel) → resolved modded path, or null if no override exists. null
// entries are cached too so we don't re-stat the same vanilla path each time.
const cache = new Map<string, string | null>();

export function setOverlay(cfg: OverlayConfig | null): void {
  // Switching activeMod (or unsetting it) invalidates every previous lookup.
  current = cfg;
  cache.clear();
}

/** Call after a Save-to-mod so the just-written file replaces a cached miss. */
export function invalidateOverlay(rel: string): void {
  if (!current) return;
  cache.delete(`${current.activeMod}::${rel.toLowerCase()}`);
}

/** Strip a gfx-rooted absolute path back to its gfx-relative form, or null. */
export function relUnderGfx(abs: string, gfxRoot: string): string | null {
  const norm = abs.replace(/\\/g, "/");
  const root = gfxRoot.replace(/\\/g, "/").replace(/\/+$/, "");
  const lo = norm.toLowerCase();
  const lr = root.toLowerCase();
  if (!lo.startsWith(lr + "/")) return null;
  return norm.slice(root.length + 1);
}

/**
 * Resolve a vanilla candidate path through the active mod. Returns the modded
 * path if the active mod overrides this gfx-relative file, otherwise returns
 * the original candidate unchanged. Always async because we may have to stat.
 */
export async function overlayPath(candidate: string): Promise<string> {
  const cfg = current;
  if (!cfg) return candidate;
  const rel = relUnderGfx(candidate, cfg.gfxRoot);
  if (rel === null) return candidate;
  const key = `${cfg.activeMod}::${rel.toLowerCase()}`;
  const cached = cache.get(key);
  if (cached !== undefined) return cached ?? candidate;
  const modPath = `${cfg.modsPath}/${cfg.activeMod}/resources/gfx/${rel}`;
  let hit = false;
  try {
    hit = await tauriExists(modPath);
  } catch {
    hit = false;
  }
  cache.set(key, hit ? modPath : null);
  return hit ? modPath : candidate;
}
