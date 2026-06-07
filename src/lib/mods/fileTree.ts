// Walk a mod's resources/gfx/ tree and list every overridden file with sizes.
// Files outside resources/gfx/ are skipped per the v1 scope (sprite-focused).

import { stat } from "@tauri-apps/plugin-fs";
import { listDir } from "../fsx/fs";

export interface ModFile {
  /** Absolute path, forward slashes */
  abs: string;
  /** Path under resources/gfx/, forward slashes (the overlay key) */
  rel: string;
  bytes: number;
}

const GFX_PREFIX = "resources/gfx/";

async function walk(
  root: string,
  prefix: string,
  out: ModFile[],
): Promise<void> {
  let entries;
  try {
    entries = await listDir(root);
  } catch {
    return;
  }
  for (const e of entries) {
    if (e.kind === "dir") {
      await walk(e.path, `${prefix}${e.name}/`, out);
    } else {
      let bytes = 0;
      try {
        bytes = Number((await stat(e.path)).size) || 0;
      } catch {
        // ignore stat failure — file appears with 0 bytes
      }
      out.push({ abs: e.path, rel: `${prefix}${e.name}`, bytes });
    }
  }
}

/** Lists everything under `<modFolder>/resources/gfx/`, recursively. */
export async function listModGfxFiles(modFolder: string): Promise<ModFile[]> {
  const out: ModFile[] = [];
  await walk(`${modFolder}/${GFX_PREFIX}`.replace(/\/+$/, ""), "", out);
  return out;
}
