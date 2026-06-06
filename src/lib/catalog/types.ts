// Semantic catalog (UI_PLAN §2): the game's XML indexes mapped into
// browsable categories. Everything here is plain data — no DOM, no Tauri.

export type CategoryId =
  | "characters"
  | "tears"
  | "familiars"
  | "pickups"
  | "items"
  | "enemies"
  | "effects"
  | "grid"
  | "backdrops"
  | "ui"
  | "cutscenes";

export const CATEGORY_LABELS: Record<CategoryId, string> = {
  characters: "Characters",
  tears: "Tears & Weapons",
  familiars: "Familiars",
  pickups: "Pickups",
  items: "Items & Trinkets",
  enemies: "Enemies",
  effects: "Effects",
  grid: "Grid & Props",
  backdrops: "Backdrops",
  ui: "UI",
  cutscenes: "Cutscenes",
};

/** Sidebar order */
export const CATEGORY_ORDER: CategoryId[] = [
  "characters",
  "tears",
  "familiars",
  "pickups",
  "items",
  "enemies",
  "effects",
  "grid",
  "backdrops",
  "ui",
  "cutscenes",
];

export interface CatalogEntry {
  /** Unique key, e.g. "entity:10.0" or "item:c1" or "file:ui/hudpickups.anm2" */
  key: string;
  /** Human display name ("Gaper", "The Sad Onion") */
  name: string;
  category: CategoryId;
  /** e.g. "Bosses", "Trinkets", "Main Menu", "Machines"; null = top level */
  subcategory: string | null;
  /** gfx-relative anm2 path, forward slashes; null for png-only entries */
  anm2Path: string | null;
  /** gfx-relative png path for png-only entries (character skins, plain UI art) */
  sheetPath: string | null;
  source: "entities2" | "items" | "players" | "files";
}

export interface Catalog {
  entries: CatalogEntry[];
  /** Rows the parsers skipped, with reasons — surfaced in the debug view */
  warnings: string[];
}
