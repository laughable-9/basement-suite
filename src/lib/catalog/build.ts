// Assembles the catalog from parsed XML rows + a flat listing of gfx files.
// Pure: callers supply XML text and the file list (app walks via Tauri,
// tests walk via node fs).

import { prettifyGfxName } from "./names";
import {
  parseCostumes2,
  parseEntities2,
  parseItems,
  parsePlayers,
  type EntityRow,
} from "./parse";
import type { Catalog, CatalogEntry, CategoryId } from "./types";

export interface CatalogSources {
  /** XML file contents; missing = that source skipped with a warning */
  entities2Xml?: string;
  itemsXml?: string;
  playersXml?: string;
  costumes2Xml?: string;
  /** Every png/anm2 under gfx/, paths relative to gfx root, forward slashes */
  gfxFiles: string[];
}

/** Entity type id → category/subcategory (Isaac entity taxonomy) */
function entityCategory(
  row: EntityRow,
): { category: CategoryId; subcategory: string | null } | null {
  const { id } = row;
  if (id === 1) return null; // player entity — Characters come from players.xml
  if (id === 2) return { category: "tears", subcategory: "Tears" };
  if (id === 4) return { category: "tears", subcategory: "Bombs" };
  if (id === 7) return { category: "tears", subcategory: "Lasers" };
  if (id === 8) return { category: "tears", subcategory: "Knives" };
  if (id === 9) return { category: "tears", subcategory: "Projectiles" };
  if (id === 3) return { category: "familiars", subcategory: null };
  if (id === 5) return { category: "pickups", subcategory: null };
  if (id === 6) return { category: "pickups", subcategory: "Machines" };
  if (id === 1000) return { category: "effects", subcategory: null };
  if (id >= 10) {
    return row.boss
      ? { category: "enemies", subcategory: "Bosses" }
      : { category: "enemies", subcategory: null };
  }
  return null;
}

/** ui/ subtree → subsection name (UI_PLAN §2); curated, Misc catches the rest */
const UI_SUBSECTIONS: [RegExp, string][] = [
  [/^ui\/main menu\//i, "Main Menu"],
  [/^ui\/giantbook\//i, "Giantbook"],
  [/^ui\/boss\//i, "Boss Intro"],
  [/^ui\/achievement/i, "Achievements"],
  [/^ui\/stage\//i, "Stage"],
  [/^ui\/online\//i, "Online"],
  [/^ui\/loadimages/i, "Loading"],
  [/^ui\/hud|^ui\/ui_hearts|^ui\/ui_chargebar/i, "HUD"],
  [/^ui\/coop/i, "Co-op"],
  [/^ui\/ui_cardfront|^ui\/ui_crafting/i, "Cards & Crafting"],
];

function uiSubsection(rel: string): string {
  for (const [re, name] of UI_SUBSECTIONS) {
    if (re.test(rel)) return name;
  }
  return "Misc";
}

export function buildCatalog(sources: CatalogSources): Catalog {
  const warnings: string[] = [];
  const entries: CatalogEntry[] = [];
  /** anm2 paths already claimed by an XML-driven entry (dedupe) */
  const claimed = new Set<string>();
  const gfxSet = new Set(sources.gfxFiles.map((f) => f.toLowerCase()));
  const hasFile = (rel: string) => gfxSet.has(rel.toLowerCase());

  /* ---- entities2: tears/familiars/pickups/enemies/bosses/effects ---- */
  if (sources.entities2Xml) {
    const { rows, warnings: w } = parseEntities2(sources.entities2Xml);
    warnings.push(...w);
    for (const row of rows) {
      const cat = entityCategory(row);
      if (!cat) continue;
      const key = row.anm2Path.toLowerCase();
      if (claimed.has(key)) continue; // variants sharing one anm2 → one card
      if (!hasFile(row.anm2Path)) {
        warnings.push(`entities2: missing anm2 on disk: ${row.anm2Path}`);
        continue;
      }
      claimed.add(key);
      entries.push({
        key: `entity:${row.id}.${row.variant}.${row.subtype}`,
        name: row.name,
        category: cat.category,
        subcategory: cat.subcategory,
        anm2Path: row.anm2Path,
        sheetPath: null,
        costumeAnm2Path: null,
        source: "entities2",
      });
    }
  } else {
    warnings.push("entities2.xml not provided");
  }

  /* ---- items.xml: collectibles + trinkets ---- */
  if (sources.itemsXml) {
    const { rows, warnings: w } = parseItems(sources.itemsXml);
    warnings.push(...w);
    for (const row of rows) {
      const dir = row.kind === "collectible" ? "items/collectibles" : "items/trinkets";
      const sheetPath = `${dir}/${row.gfx}`;
      if (!hasFile(sheetPath)) {
        warnings.push(`items: missing gfx on disk: ${sheetPath}`);
        continue;
      }
      entries.push({
        key: `item:${row.kind[0]}${row.id}`,
        name: prettifyGfxName(row.gfx),
        category: "items",
        subcategory: row.kind === "collectible" ? "Collectibles" : "Trinkets",
        anm2Path: null,
        sheetPath,
        costumeAnm2Path: null,
        source: "items",
      });
    }
  } else {
    warnings.push("items.xml not provided");
  }

  /* ---- players.xml: characters (all skins share the player anm2 layout) ---- */
  if (sources.playersXml) {
    const { rows, warnings: w } = parsePlayers(sources.playersXml);
    warnings.push(...w);

    // costume id → gfx-relative anm2 path (hair/wings/fez overlays)
    const costumeById = new Map<number, string>();
    if (sources.costumes2Xml) {
      const costumes = parseCostumes2(sources.costumes2Xml);
      warnings.push(...costumes.warnings);
      const root = costumes.anm2Root.replace(/^gfx\//i, "").replace(/\/+$/, "");
      for (const c of costumes.rows) {
        const rel = `${root}/${c.anm2Path}`;
        if (hasFile(rel)) costumeById.set(c.id, rel);
        else warnings.push(`costumes2: missing anm2 on disk: ${rel}`);
      }
    }

    const seenSkins = new Set<string>();
    for (const row of rows) {
      const sheetPath = `characters/costumes/${row.skin}`;
      const skinKey = sheetPath.toLowerCase();
      if (seenSkins.has(skinKey)) continue; // tainted variants reuse skins
      seenSkins.add(skinKey);
      if (!hasFile(sheetPath)) {
        warnings.push(`players: missing skin on disk: ${sheetPath}`);
        continue;
      }
      entries.push({
        key: `player:${row.id}`,
        name: prettifyGfxName(row.skin),
        category: "characters",
        subcategory: null,
        anm2Path: "001.000_player.anm2",
        sheetPath,
        costumeAnm2Path: costumeById.get(row.costume) ?? null,
        source: "players",
      });
    }
  } else {
    warnings.push("players.xml not provided");
  }

  /* ---- folder-driven categories: ui / grid / cutscenes / backdrops ---- */
  const anm2Stems = new Set(
    sources.gfxFiles
      .filter((f) => f.toLowerCase().endsWith(".anm2"))
      .map((f) => f.toLowerCase().replace(/\.anm2$/, "")),
  );

  for (const rel of sources.gfxFiles) {
    const lower = rel.toLowerCase();
    const isAnm2 = lower.endsWith(".anm2");
    const isPng = lower.endsWith(".png");
    if (!isAnm2 && !isPng) continue;
    // pngs that have a same-stem anm2 are reachable through it — skip the dupe
    if (isPng && anm2Stems.has(lower.replace(/\.png$/, ""))) continue;

    let category: CategoryId;
    let subcategory: string | null = null;
    if (lower.startsWith("ui/")) {
      category = "ui";
      subcategory = uiSubsection(rel);
    } else if (lower.startsWith("grid/")) {
      category = "grid";
    } else if (lower.startsWith("cutscenes/")) {
      category = "cutscenes";
    } else if (lower.startsWith("backdrop/")) {
      category = "backdrops";
    } else {
      continue; // everything else is XML-driven or Files-view-only
    }
    if (claimed.has(lower)) continue;
    claimed.add(lower);
    entries.push({
      key: `file:${lower}`,
      name: prettifyGfxName(rel),
      category,
      subcategory,
      anm2Path: isAnm2 ? rel : null,
      sheetPath: isPng ? rel : null,
      costumeAnm2Path: null,
      source: "files",
    });
  }

  return { entries, warnings };
}

/* ---------- search ---------- */

export function searchCatalog(
  entries: CatalogEntry[],
  query: string,
  limit = 50,
): CatalogEntry[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const scored: { entry: CatalogEntry; score: number }[] = [];
  for (const entry of entries) {
    const name = entry.name.toLowerCase();
    const path = (entry.anm2Path ?? entry.sheetPath ?? "").toLowerCase();
    let score = -1;
    if (name.startsWith(q)) score = 3;
    else if (name.includes(q)) score = 2;
    else if (path.includes(q)) score = 1;
    if (score >= 0) scored.push({ entry, score });
  }
  return scored
    .sort(
      (a, b) =>
        b.score - a.score || a.entry.name.localeCompare(b.entry.name),
    )
    .slice(0, limit)
    .map((s) => s.entry);
}
