// "Save to mod": mirror the edited sheet's gfx-relative path into
// modsPath/<mod>/resources/gfx/... and generate metadata.xml on first save.
// Pure helpers up top (unit-tested); IO at the bottom via the guarded writer.

import {
  modPathExists,
  writeModFile,
  writeModTextFile,
} from "../../lib/fsx/modWrite";
import { markSheetClean, type SheetDoc } from "../../lib/sheets/store";

/* ---------- pure ---------- */

/** Sheet's path relative to the game's gfx root, or null if outside it. */
export function relUnderGfx(sheetPath: string, gfxRoot: string): string | null {
  const sheet = sheetPath.replace(/\\/g, "/");
  const root = gfxRoot.replace(/\\/g, "/").replace(/\/+$/, "") + "/";
  if (!sheet.toLowerCase().startsWith(root.toLowerCase())) return null;
  return sheet.slice(root.length);
}

export interface ExportPaths {
  modDir: string;
  pngPath: string;
  metadataPath: string;
}

export function buildExportPaths(
  modsPath: string,
  modName: string,
  relGfxPath: string,
): ExportPaths {
  const modDir = `${modsPath.replace(/\\/g, "/").replace(/\/+$/, "")}/${modName}`;
  return {
    modDir,
    pngPath: `${modDir}/resources/gfx/${relGfxPath}`,
    metadataPath: `${modDir}/metadata.xml`,
  };
}

const NAME_RE = /^[^<>:"/\\|?*]+$/;

/** Windows-safe folder name, no path separators or reserved characters. */
export function isValidModName(name: string): boolean {
  const t = name.trim();
  return t.length > 0 && t === name && !t.endsWith(".") && NAME_RE.test(t);
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export function metadataXml(modName: string): string {
  const name = escapeXml(modName);
  return `<metadata>
\t<name>${name}</name>
\t<directory>${name}</directory>
\t<description>Sprites edited with Basement Suite</description>
\t<version>1.0</version>
\t<visibility/>
</metadata>
`;
}

/* ---------- IO ---------- */

function encodePng(canvas: HTMLCanvasElement): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(async (blob) => {
      if (!blob) return reject(new Error("PNG encode failed"));
      resolve(new Uint8Array(await blob.arrayBuffer()));
    }, "image/png");
  });
}

export interface ExportResult {
  pngPath: string;
  wroteMetadata: boolean;
}

export async function exportToMod(
  doc: SheetDoc,
  gfxRoot: string,
  modsPath: string,
  modName: string,
): Promise<ExportResult> {
  const rel = relUnderGfx(doc.path, gfxRoot);
  if (rel === null) {
    throw new Error(`sheet is not under the game's gfx root: ${doc.path}`);
  }
  if (!isValidModName(modName)) {
    throw new Error(`invalid mod folder name: "${modName}"`);
  }
  const paths = buildExportPaths(modsPath, modName, rel);

  await writeModFile(paths.pngPath, modsPath, await encodePng(doc.canvas));

  let wroteMetadata = false;
  if (!(await modPathExists(paths.metadataPath))) {
    await writeModTextFile(paths.metadataPath, modsPath, metadataXml(modName));
    wroteMetadata = true;
  }

  markSheetClean(doc);
  return { pngPath: paths.pngPath, wroteMetadata };
}
