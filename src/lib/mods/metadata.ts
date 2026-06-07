// Parse a mod's metadata.xml — a very small, very lenient XML doc per the
// Workshop spec (just <metadata><name/>...</metadata>). Pure & tested.

import { XMLParser } from "fast-xml-parser";

export interface ModMetadata {
  name: string | null;
  description: string | null;
  version: string | null;
  directory: string | null;
  /** Workshop ID — populated by Steam when subscribing. Numeric string. */
  id: string | null;
}

/** Steam Workshop mods have a numeric <id> stamped by the Workshop uploader. */
export function isWorkshopMod(meta: ModMetadata): boolean {
  return meta.id !== null && /^\d{4,}$/.test(meta.id);
}

const xml = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "",
  allowBooleanAttributes: true,
  parseAttributeValue: false,
  parseTagValue: false,
  trimValues: true,
});

type Raw = Record<string, unknown>;

function str(v: unknown): string | null {
  if (typeof v === "string" && v.trim().length > 0) return v.trim();
  if (typeof v === "number") return String(v);
  return null;
}

/** Tolerant of missing fields, unknown extras, mixed case (rare but seen). */
export function parseMetadataXml(text: string): ModMetadata {
  const empty: ModMetadata = {
    name: null,
    description: null,
    version: null,
    directory: null,
    id: null,
  };
  try {
    const doc = xml.parse(text) as Raw;
    const root =
      (doc.metadata as Raw | undefined) ??
      (doc.Metadata as Raw | undefined) ??
      null;
    if (!root) return empty;
    return {
      name: str(root.name) ?? str(root.Name),
      description: str(root.description) ?? str(root.Description),
      version: str(root.version) ?? str(root.Version),
      directory: str(root.directory) ?? str(root.Directory),
      id: str(root.id) ?? str(root.Id) ?? str(root.ID),
    };
  } catch {
    return empty;
  }
}
