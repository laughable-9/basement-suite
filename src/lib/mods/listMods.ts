// Mod folder listing + metadata.xml + gfx file walk, surfaced as a single
// ModSummary per folder so the UI list can render counts without N+1
// individual fetches later.

import { exists, readTextFile } from "@tauri-apps/plugin-fs";
import { listDir } from "../fsx/fs";
import { listModGfxFiles, type ModFile } from "./fileTree";
import { parseMetadataXml, type ModMetadata } from "./metadata";

export interface ModSummary {
  folderName: string;
  /** Absolute path to the mod folder, forward slashes */
  path: string;
  /** Display name from metadata.xml <name>, or folderName if missing */
  displayName: string;
  metadata: ModMetadata;
  files: ModFile[];
  totalBytes: number;
}

const EMPTY_META: ModMetadata = {
  name: null,
  description: null,
  version: null,
  directory: null,
  id: null,
};

async function readMetadata(folder: string): Promise<ModMetadata> {
  const file = `${folder}/metadata.xml`;
  try {
    if (!(await exists(file))) return EMPTY_META;
    return parseMetadataXml(await readTextFile(file));
  } catch {
    return EMPTY_META;
  }
}

export async function listMods(modsPath: string): Promise<ModSummary[]> {
  let entries;
  try {
    entries = await listDir(modsPath);
  } catch {
    return [];
  }
  const folders = entries.filter(
    (e) => e.kind === "dir" && !e.name.startsWith("."),
  );
  return Promise.all(
    folders.map(async (e) => {
      const [metadata, files] = await Promise.all([
        readMetadata(e.path),
        listModGfxFiles(e.path),
      ]);
      return {
        folderName: e.name,
        path: e.path,
        displayName: metadata.name ?? e.name,
        metadata,
        files,
        totalBytes: files.reduce((a, f) => a + f.bytes, 0),
      };
    }),
  );
}
