// Display names derived from gfx filenames — items.xml/players.xml only carry
// localization keys (UI_PLAN §6), but the filenames encode readable names:
// "Collectibles_001_TheSadOnion.png" → "The Sad Onion".

/** Tokens kept fully uppercase when decoding keys (Monstro II, Gemini, …) */
const ROMAN_RE = /^(I{1,3}|IV|V|VI{0,3}|IX|X)$/;

/**
 * entities2.xml names are mostly localization keys: "#FROWNING_GAPER".
 * The key itself is readable — decode instead of resolving stringtable.sta.
 */
export function nameFromLocKey(raw: string): string {
  if (!raw.startsWith("#")) return raw;
  return raw
    .slice(1)
    .split("_")
    .filter(Boolean)
    .map((w) =>
      ROMAN_RE.test(w) ? w : w[0].toUpperCase() + w.slice(1).toLowerCase(),
    )
    .join(" ");
}

const EXT_RE = /\.(png|anm2)$/i;
/** "Collectibles_001_", "Character_002_", "Trinket_005_" style prefixes */
const KIND_PREFIX_RE = /^[a-z]+_\d+[a-z]?_/i;
/** "003.022_" entity-id prefixes */
const ID_PREFIX_RE = /^\d+\.\d+_/;

export function prettifyGfxName(fileOrPath: string): string {
  let base = fileOrPath.replace(/\\/g, "/").split("/").pop() ?? fileOrPath;
  base = base.replace(EXT_RE, "");
  base = base.replace(KIND_PREFIX_RE, "").replace(ID_PREFIX_RE, "");
  const spaced = base
    .replace(/_/g, " ")
    // camelCase boundaries: "TheSadOnion" → "The Sad Onion"
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    // letter→digit boundaries: "Onion2" → "Onion 2"
    .replace(/([A-Za-z])(\d)/g, "$1 $2")
    .replace(/\s+/g, " ")
    .trim();
  // Title-case plain lowercase words; leave mixed-case and dotted tokens as-is
  return spaced
    .split(" ")
    .map((w) => (/^[a-z]/.test(w) ? w[0].toUpperCase() + w.slice(1) : w))
    .join(" ");
}
