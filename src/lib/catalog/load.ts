// App-side catalog loading: reads the XML indexes + walks gfx/ via Tauri fs.
// All the logic lives in build.ts (pure); this file is just IO.

import { readDir, readTextFile } from "@tauri-apps/plugin-fs";
import { dirname } from "../fsx/resolve";
import { buildCatalog } from "./build";
import type { Catalog } from "./types";

async function tryReadText(path: string): Promise<string | undefined> {
  try {
    return await readTextFile(path);
  } catch {
    return undefined;
  }
}

/** Recursively list png/anm2 under root, as gfx-relative forward-slash paths. */
async function walkGfx(root: string, prefix = ""): Promise<string[]> {
  const out: string[] = [];
  const entries = await readDir(`${root}${prefix ? `/${prefix}` : ""}`);
  const subdirs: string[] = [];
  for (const e of entries) {
    const rel = prefix ? `${prefix}/${e.name}` : e.name;
    if (e.isDirectory) {
      subdirs.push(rel);
    } else {
      const lower = e.name.toLowerCase();
      if (lower.endsWith(".png") || lower.endsWith(".anm2")) out.push(rel);
    }
  }
  const nested = await Promise.all(subdirs.map((d) => walkGfx(root, d)));
  for (const n of nested) out.push(...n);
  return out;
}

export async function loadCatalog(gfxRoot: string): Promise<Catalog> {
  const resourcesRoot = dirname(gfxRoot);
  const [entities2Xml, itemsXml, playersXml, gfxFiles] = await Promise.all([
    tryReadText(`${resourcesRoot}/entities2.xml`),
    tryReadText(`${resourcesRoot}/items.xml`),
    tryReadText(`${resourcesRoot}/players.xml`),
    walkGfx(gfxRoot),
  ]);
  return buildCatalog({ entities2Xml, itemsXml, playersXml, gfxFiles });
}
