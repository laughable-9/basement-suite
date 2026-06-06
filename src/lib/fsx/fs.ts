import { readDir, readFile, readTextFile } from "@tauri-apps/plugin-fs";

export type EntryKind = "dir" | "png" | "anm2" | "other";

export interface Entry {
  name: string;
  /** Absolute path, forward slashes */
  path: string;
  kind: EntryKind;
}

function kindOf(name: string, isDir: boolean): EntryKind {
  if (isDir) return "dir";
  const lower = name.toLowerCase();
  if (lower.endsWith(".png")) return "png";
  if (lower.endsWith(".anm2")) return "anm2";
  return "other";
}

/** List a directory: folders first, then files, both name-sorted. */
export async function listDir(path: string): Promise<Entry[]> {
  const entries = await readDir(path);
  return entries
    .map((e) => ({
      name: e.name,
      path: `${path}/${e.name}`,
      kind: kindOf(e.name, e.isDirectory),
    }))
    .sort(
      (a, b) =>
        Number(b.kind === "dir") - Number(a.kind === "dir") ||
        a.name.localeCompare(b.name),
    );
}

export const readText = readTextFile;

// Blob-URL cache for spritesheet/thumbnail rendering. M3's live link will
// invalidate entries here when the editor mutates a sheet.
const pngUrls = new Map<string, string>();

export async function pngUrl(path: string): Promise<string> {
  const cached = pngUrls.get(path);
  if (cached) return cached;
  const bytes = await readFile(path);
  const url = URL.createObjectURL(new Blob([bytes], { type: "image/png" }));
  pngUrls.set(path, url);
  return url;
}

export function invalidatePngUrl(path: string): void {
  const url = pngUrls.get(path);
  if (url) {
    URL.revokeObjectURL(url);
    pngUrls.delete(path);
  }
}
