// Inspect / drain the dirty SheetDocs across the whole app. Used by the
// close-tab confirm and the active-mod-switch confirm to ask "what would
// you lose?".

import { markSheetClean, peekSheetDoc, type SheetDoc } from "./store";

declare global {
  // The sheets store keeps its `docs` Map private; we walk it via the
  // exported peek/clean helpers and a manually-maintained registry below.
  // Registering the set of known paths is cheaper than exposing the Map.
}

const known = new Set<string>();

/** Sheet docs should register themselves whenever they're loaded. */
export function registerSheetPath(path: string): void {
  known.add(path);
}

export function listAllDirty(): SheetDoc[] {
  const out: SheetDoc[] = [];
  for (const p of known) {
    const doc = peekSheetDoc(p);
    if (doc?.dirty) out.push(doc);
  }
  return out;
}

export function discardAllDirty(): void {
  for (const doc of listAllDirty()) markSheetClean(doc);
}
