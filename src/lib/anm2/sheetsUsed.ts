// Which spritesheets does an animation reference?
// Pure — drives the "Sheets" line on anim cards and the multi-character
// warning when the user edits a shared sheet.

import type { Anm2, Anm2Animation } from "./types";

/**
 * Spritesheet ids referenced by the visible layers of an animation, in
 * declaration order (first appearance wins). Hidden layer tracks are
 * skipped — they don't render so they don't "use" a sheet visually.
 */
export function sheetIdsUsedByAnim(
  anm2: Anm2,
  anim: Anm2Animation,
): number[] {
  const layerIds = new Set<number>();
  for (const track of anim.layers) {
    if (track.visible) layerIds.add(track.layerId);
  }
  const seen = new Set<number>();
  const out: number[] = [];
  for (const l of anm2.content.layers) {
    if (!layerIds.has(l.id)) continue;
    if (seen.has(l.spritesheetId)) continue;
    seen.add(l.spritesheetId);
    out.push(l.spritesheetId);
  }
  return out;
}

/** Resolve to sheet basenames (display labels); falls back to "sheet N". */
export function sheetNamesUsedByAnim(
  anm2: Anm2,
  anim: Anm2Animation,
): string[] {
  return sheetIdsUsedByAnim(anm2, anim).map((id) => {
    const s = anm2.content.spritesheets.find((sp) => sp.id === id);
    if (!s) return `sheet ${id}`;
    const raw = s.rawPath.replace(/\\/g, "/");
    return raw.split("/").pop() ?? raw;
  });
}
