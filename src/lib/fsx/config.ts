import { exists } from "@tauri-apps/plugin-fs";

export interface BsConfig {
  isaacPath: string;
  modsPath: string;
  extractedResourcesPath: string;
}

export type ConfigState =
  | { status: "ok"; config: BsConfig; gfxRoot: string }
  | { status: "error"; problems: string[] };

// bs.config.json is gitignored and machine-local; Vite resolves this glob at
// build time, so creating the file requires a dev-server restart.
const configModules = import.meta.glob<{ default: Partial<BsConfig> }>(
  "/bs.config.json",
);

const REQUIRED_KEYS = [
  "isaacPath",
  "modsPath",
  "extractedResourcesPath",
] as const;

export async function loadConfig(): Promise<ConfigState> {
  const loader = configModules["/bs.config.json"];
  if (!loader) {
    return {
      status: "error",
      problems: [
        "bs.config.json was not found in the repo root.",
        'Create it with keys "isaacPath", "modsPath" and "extractedResourcesPath", then restart `npm run tauri dev`.',
      ],
    };
  }

  const raw = (await loader()).default ?? {};
  const problems: string[] = [];

  for (const key of REQUIRED_KEYS) {
    const value = raw[key];
    if (!value) {
      problems.push(`bs.config.json is missing "${key}".`);
    } else if (!(await exists(value))) {
      problems.push(`"${key}" does not exist on disk: ${value}`);
    }
  }
  if (problems.length > 0) return { status: "error", problems };

  const config = raw as BsConfig;
  const gfxRoot = `${config.extractedResourcesPath.replace(/[\\/]+$/, "")}/gfx`;
  if (!(await exists(gfxRoot))) {
    return {
      status: "error",
      problems: [
        `No gfx folder found at ${gfxRoot}.`,
        "The game resources have not been extracted. Run " +
          `${config.isaacPath}/tools/ResourceExtractor/ResourceExtractor.exe ` +
          "(may need administrator rights), then reload.",
      ],
    };
  }

  return { status: "ok", config, gfxRoot };
}
