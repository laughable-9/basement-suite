// Create a fresh local mod folder + metadata.xml so the user can start a
// new project without having to save into the editor first.

import { writeModTextFile } from "../fsx/modWrite";
import { isValidModName } from "../../features/export/modExport";

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/**
 * Writes `<modsPath>/<name>/metadata.xml` with the supplied display name and
 * description. Returns the absolute path of the new mod folder.
 *
 * Local mods leave `<id>` empty so isWorkshopMod() returns false (the badge
 * stays off until Steam fills it in on upload, which is out of scope here).
 */
export async function createMod(
  modsPath: string,
  name: string,
  description: string,
): Promise<string> {
  if (!isValidModName(name)) {
    throw new Error(`invalid mod folder name: "${name}"`);
  }
  const folder = `${modsPath.replace(/\\/g, "/").replace(/\/+$/, "")}/${name}`;
  const xml = `<metadata>
\t<name>${escapeXml(name)}</name>
\t<directory>${escapeXml(name)}</directory>
\t<description>${escapeXml(description.trim() || "Created with Basement Suite")}</description>
\t<version>1.0</version>
\t<visibility/>
</metadata>
`;
  await writeModTextFile(`${folder}/metadata.xml`, modsPath, xml);
  return folder;
}
