// Config loader. Reads bs.config.json from %APPDATA%/dev.kyle.basement-suite/
// at runtime so the packaged installer can ship without a baked-in config —
// users set their paths through the Settings panel on first launch.
//
// Dev fallback: Vite resolves the project-root bs.config.json at build time
// so the existing `npm run tauri dev` flow keeps working without anyone
// having to copy the file to AppData.

import {
  exists,
  mkdir,
  readTextFile,
  writeTextFile,
} from "@tauri-apps/plugin-fs";
import { appConfigDir, join } from "@tauri-apps/api/path";

export interface BsConfig {
  isaacPath: string;
  modsPath: string;
  extractedResourcesPath: string;
}

export type ConfigState =
  /** All three paths exist on disk and the gfx tree was extracted. */
  | { status: "ok"; config: BsConfig; gfxRoot: string }
  /** No bs.config.json found anywhere — show the guided first-run setup. */
  | { status: "missing" }
  /** File present but values reference paths that don't exist — pre-fill
   *  the setup form with what they had so the user can correct it. */
  | {
      status: "error";
      config: Partial<BsConfig>;
      problems: string[];
    };

// Dev-only fallback. import.meta.glob runs at build time; in a packaged
// build there's no bs.config.json on the runner so this map is empty,
// and we rely entirely on the runtime appConfigDir() lookup.
const devConfigModules = import.meta.glob<{ default: Partial<BsConfig> }>(
  "/bs.config.json",
);

const REQUIRED_KEYS = [
  "isaacPath",
  "modsPath",
  "extractedResourcesPath",
] as const;

async function configFilePath(): Promise<string> {
  const dir = await appConfigDir();
  return await join(dir, "bs.config.json");
}

/** Absolute path to the config file (for the Settings popover to show). */
export async function configLocation(): Promise<string> {
  return await configFilePath();
}

async function readRaw(): Promise<Partial<BsConfig> | null> {
  // Prefer the runtime file — works in both dev and packaged builds once
  // the user has saved through Settings at least once.
  try {
    const p = await configFilePath();
    if (await exists(p)) {
      return JSON.parse(await readTextFile(p)) as Partial<BsConfig>;
    }
  } catch {
    // fall through
  }
  // Dev-only repo-root fallback so existing `npm run tauri dev` flows
  // don't have to migrate their config file.
  if (import.meta.env.DEV) {
    const loader = devConfigModules["/bs.config.json"];
    if (loader) return (await loader()).default ?? {};
  }
  return null;
}

export async function loadConfig(): Promise<ConfigState> {
  const raw = await readRaw();
  if (raw === null) return { status: "missing" };

  const problems: string[] = [];
  for (const key of REQUIRED_KEYS) {
    const value = raw[key];
    if (!value) {
      problems.push(`"${key}" is empty.`);
    } else if (!(await exists(value))) {
      problems.push(`"${key}" does not exist on disk: ${value}`);
    }
  }
  if (problems.length > 0) {
    return { status: "error", config: raw, problems };
  }

  const config = raw as BsConfig;
  const gfxRoot = `${config.extractedResourcesPath.replace(/[\\/]+$/, "")}/gfx`;
  if (!(await exists(gfxRoot))) {
    return {
      status: "error",
      config,
      problems: [
        `No gfx folder found at ${gfxRoot}.`,
        "The game's resource extractor hasn't run. Open " +
          `${config.isaacPath}/tools/ResourceExtractor/ResourceExtractor.exe ` +
          "as administrator, click Extract, then reload.",
      ],
    };
  }
  return { status: "ok", config, gfxRoot };
}

export async function saveConfig(config: BsConfig): Promise<string> {
  const p = await configFilePath();
  const dir = await appConfigDir();
  if (!(await exists(dir))) await mkdir(dir, { recursive: true });
  // Forward slashes are what the rest of the app uses internally.
  const normalized: BsConfig = {
    isaacPath: config.isaacPath.replace(/\\/g, "/"),
    modsPath: config.modsPath.replace(/\\/g, "/"),
    extractedResourcesPath: config.extractedResourcesPath.replace(/\\/g, "/"),
  };
  await writeTextFile(p, JSON.stringify(normalized, null, 2));
  return p;
}
