// THE single write path of the app. Every disk write goes through here, and
// here enforces the hard rule from CLAUDE.md: writes land under modsPath,
// nowhere else — the game tree stays read-only by construction.

import { exists, mkdir, writeFile, writeTextFile } from "@tauri-apps/plugin-fs";

function normalize(p: string): string {
  return p.replace(/\\/g, "/").replace(/\/+$/, "").toLowerCase();
}

export function assertUnderModsPath(target: string, modsPath: string): void {
  const t = normalize(target);
  const m = normalize(modsPath) + "/";
  if (!t.startsWith(m)) {
    throw new Error(
      `refusing to write outside modsPath: ${target} (modsPath: ${modsPath})`,
    );
  }
}

export async function writeModFile(
  target: string,
  modsPath: string,
  data: Uint8Array,
): Promise<void> {
  assertUnderModsPath(target, modsPath);
  await ensureDir(target, modsPath);
  await writeFile(target, data);
}

export async function writeModTextFile(
  target: string,
  modsPath: string,
  text: string,
): Promise<void> {
  assertUnderModsPath(target, modsPath);
  await ensureDir(target, modsPath);
  await writeTextFile(target, text);
}

export { exists as modPathExists };

async function ensureDir(filePath: string, modsPath: string): Promise<void> {
  const dir = filePath.replace(/\\/g, "/").split("/").slice(0, -1).join("/");
  assertUnderModsPath(dir, modsPath);
  if (!(await exists(dir))) {
    await mkdir(dir, { recursive: true });
  }
}
