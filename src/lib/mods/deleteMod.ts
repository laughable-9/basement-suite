// Hard-delete a mod folder. Guarded — refuses to remove anything outside
// modsPath so a bug in the UI can never wipe the wrong directory.

import { remove } from "@tauri-apps/plugin-fs";
import { assertUnderModsPath } from "../fsx/modWrite";

export async function deleteModFolder(
  modFolder: string,
  modsPath: string,
): Promise<void> {
  assertUnderModsPath(modFolder, modsPath);
  await remove(modFolder, { recursive: true });
}
