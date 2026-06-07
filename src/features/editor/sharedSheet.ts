// "Who else does this edit affect?" — when the user opens a sheet in the
// editor, figure out whether OTHER characters draw from it too, so they get
// a heads-up before they recolor ghost.png and accidentally re-skin every
// character's Death animation.
//
// The catalog already records each character's skin path + signature costume
// anm2; combined with the editor target (anm2Path + sheetId) that's enough to
// classify the three common cases without parsing extra anm2 files:
//   - sheetId 0 of the universal player anm2 = the per-character SKIN
//     (substituted at load time), so even though all characters technically
//     "use" the player anm2's sheet 0, the resolved path is unique. Safe.
//   - sheetId > 0 of the universal player anm2 = ghost/tears/Isaac's head etc.,
//     declared once in players.xml and pulled in by every character. Shared.
//   - a sheet inside a costume anm2 = shared by every character that uses
//     that same costumes2.xml costume.
// Heuristic and bounded (no recursive parsing). Edge cases of obscure setups
// (handcrafted modded anm2s, etc.) fall through to "unique" — better to
// under-warn than cry wolf.

import type { Catalog, CatalogEntry } from "../../lib/catalog/types";

export interface SharedSheetInfo {
  /** Other character display names that draw from this sheet */
  others: string[];
  /** Short label for the warning headline */
  reason: "player" | "costume";
}

const PLAYER_ANM2 = "001.000_player.anm2";

function lower(s: string): string {
  return s.toLowerCase().replace(/\\/g, "/");
}

/** Catalog entries are characters? */
function chars(catalog: Catalog): CatalogEntry[] {
  return catalog.entries.filter((e) => e.category === "characters");
}

export function findSharedSheetInfo(
  catalog: Catalog | null,
  currentTitle: string | undefined,
  anm2Path: string | null,
  sheetId: number | undefined,
): SharedSheetInfo | null {
  if (!catalog || !anm2Path) return null;
  const path = lower(anm2Path);

  // Universal player anm2 — sheet 0 is the per-character substituted skin.
  if (path.endsWith(`/${PLAYER_ANM2}`) || path.endsWith(PLAYER_ANM2)) {
    if (sheetId === 0) return null;
    const others = chars(catalog)
      .map((e) => e.name)
      .filter((n) => n !== currentTitle);
    if (others.length === 0) return null;
    return { others, reason: "player" };
  }

  // Costume anm2: find every character entry referencing this same anm2.
  const sharers = chars(catalog).filter(
    (e) => e.costumeAnm2Path && path.endsWith(lower(e.costumeAnm2Path)),
  );
  if (sharers.length <= 1) return null;
  const others = sharers.map((e) => e.name).filter((n) => n !== currentTitle);
  if (others.length === 0) return null;
  return { others, reason: "costume" };
}
