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

function findGfxRoot(): string | null {
  try {
    const raw = readFileSync(join(process.cwd(), "bs.config.json"), "utf-8");
    const config = JSON.parse(raw) as BsConfig;
    if (!config.extractedResourcesPath) return null;
    const gfx = join(config.extractedResourcesPath, "gfx");
    return existsSync(gfx) ? gfx : null;
  } catch {
    return null;
  }
}

export const gfxRoot = findGfxRoot();
export const hasGameFixtures = gfxRoot !== null;

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
