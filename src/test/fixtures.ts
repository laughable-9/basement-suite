// Test-time loader for REAL game files (PLAN §7): reads bs.config.json from
// the repo root and serves files from extractedResourcesPath. Nothing
// copyrighted is committed — suites that need the game skip when it's absent.
//
// Node-only module: import it from tests, never from app code.

import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

interface BsConfig {
  extractedResourcesPath?: string;
}

function findRoots(): { gfx: string; resources: string } | null {
  try {
    const raw = readFileSync(join(process.cwd(), "bs.config.json"), "utf-8");
    const config = JSON.parse(raw) as BsConfig;
    if (!config.extractedResourcesPath) return null;
    const gfx = join(config.extractedResourcesPath, "gfx");
    return existsSync(gfx)
      ? { gfx, resources: config.extractedResourcesPath }
      : null;
  } catch {
    return null;
  }
}

const roots = findRoots();
export const gfxRoot = roots?.gfx ?? null;
export const resourcesRoot = roots?.resources ?? null;
export const hasGameFixtures = roots !== null;

/** Read an XML index (entities2.xml, items.xml, …) from the resources root. */
export function readResourceText(relPath: string): string {
  if (!resourcesRoot) throw new Error("game fixtures unavailable");
  return readFileSync(join(resourcesRoot, relPath), "utf-8");
}

/** All png/anm2 under gfx/ as gfx-relative forward-slash paths. */
export function listGfxRelative(): string[] {
  if (!gfxRoot) return [];
  const out: string[] = [];
  const walk = (dir: string, prefix: string) => {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      const rel = prefix ? `${prefix}/${e.name}` : e.name;
      if (e.isDirectory()) walk(join(dir, e.name), rel);
      else {
        const lower = e.name.toLowerCase();
        if (lower.endsWith(".png") || lower.endsWith(".anm2")) out.push(rel);
      }
    }
  };
  walk(gfxRoot, "");
  return out;
}

/** Read an anm2/file by path relative to the game's gfx/ root. */
export function readGfx(relPath: string): string {
  if (!gfxRoot) throw new Error("game fixtures unavailable");
  return readFileSync(join(gfxRoot, relPath), "utf-8");
}

/** Recursively list every .anm2 under gfx/ (corpus smoke test). */
export function listAllAnm2(): string[] {
  if (!gfxRoot) return [];
  const out: string[] = [];
  const walk = (dir: string) => {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      const p = join(dir, e.name);
      if (e.isDirectory()) walk(p);
      else if (e.name.toLowerCase().endsWith(".anm2")) out.push(p);
    }
  };
  walk(gfxRoot);
  return out;
}
