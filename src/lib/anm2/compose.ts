// Engine compositing helpers: the player anm2 splits body and head into
// separate same-tick animations (WalkDown body + HeadDown head).

import type { Anm2, Anm2Animation } from "./types";

/**
 * Matching head animation for a body state, or null. Guarded to Walk* —
 * a blind name replace would "match" the animation itself for non-Walk
 * states and draw it twice.
 */
export function headAnimFor(
  anm2: Anm2,
  bodyAnim: Anm2Animation,
): Anm2Animation | null {
  if (!bodyAnim.name.startsWith("Walk")) return null;
  const headName = bodyAnim.name.replace(/^Walk/, "Head");
  return anm2.animations.find((a) => a.name === headName) ?? null;
}
