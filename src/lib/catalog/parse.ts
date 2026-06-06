// Lenient parsers for the game's XML index files. Same posture as the anm2
// parser: never throw on shipped data — skip unmappable rows and report them.

import { XMLParser } from "fast-xml-parser";
import { nameFromLocKey } from "./names";

const xml = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "",
  parseAttributeValue: false,
  parseTagValue: false,
  isArray: (name) =>
    ["entity", "passive", "active", "familiar", "trinket", "player"].includes(
      name,
    ),
});

type Raw = Record<string, unknown>;

function str(v: unknown): string {
  return v === undefined || v === null ? "" : String(v);
}

function int(v: unknown, fallback = 0): number {
  const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : fallback;
}

export interface EntityRow {
  id: number;
  variant: number;
  /** Third discriminator — without it ids collide (laser 7.1 vs 7.1.3) */
  subtype: number;
  name: string;
  /** gfx-relative, normalized to forward slashes */
  anm2Path: string;
  boss: boolean;
}

export function parseEntities2(text: string): {
  rows: EntityRow[];
  warnings: string[];
} {
  const warnings: string[] = [];
  const rows: EntityRow[] = [];
  const doc = xml.parse(text) as Raw;
  const entities =
    (((doc.entities as Raw)?.entity as Raw[]) ?? []) as Raw[];
  for (const e of entities) {
    const anm2 = str(e.anm2path).replace(/\\/g, "/");
    if (!anm2) {
      warnings.push(`entities2: id=${str(e.id)} "${str(e.name)}" has no anm2path`);
      continue;
    }
    rows.push({
      id: int(e.id, -1),
      variant: int(e.variant, 0),
      subtype: int(e.subtype, 0),
      name: nameFromLocKey(str(e.name)) || anm2,
      anm2Path: anm2,
      boss: str(e.boss) === "1",
    });
  }
  return { rows, warnings };
}

export interface ItemRow {
  kind: "collectible" | "trinket";
  id: number;
  /** filename from gfx attribute (no directory) */
  gfx: string;
}

export function parseItems(text: string): {
  rows: ItemRow[];
  warnings: string[];
} {
  const warnings: string[] = [];
  const rows: ItemRow[] = [];
  const doc = xml.parse(text) as Raw;
  const items = (doc.items as Raw) ?? {};
  const collect = (els: Raw[] | undefined, kind: ItemRow["kind"]) => {
    for (const e of els ?? []) {
      const gfx = str(e.gfx);
      if (!gfx) {
        warnings.push(`items: ${kind} id=${str(e.id)} has no gfx`);
        continue;
      }
      rows.push({ kind, id: int(e.id, -1), gfx });
    }
  };
  collect(items.passive as Raw[], "collectible");
  collect(items.active as Raw[], "collectible");
  collect(items.familiar as Raw[], "collectible");
  collect(items.trinket as Raw[], "trinket");
  return { rows, warnings };
}

export interface PlayerRow {
  id: number;
  /** skin filename, e.g. "Character_001_Isaac.png" */
  skin: string;
}

export function parsePlayers(text: string): {
  rows: PlayerRow[];
  warnings: string[];
} {
  const warnings: string[] = [];
  const rows: PlayerRow[] = [];
  const doc = xml.parse(text) as Raw;
  const players = (((doc.players as Raw)?.player as Raw[]) ?? []) as Raw[];
  for (const p of players) {
    const skin = str(p.skin);
    if (!skin) {
      warnings.push(`players: id=${str(p.id)} has no skin`);
      continue;
    }
    rows.push({ id: int(p.id, -1), skin });
  }
  return { rows, warnings };
}
