// Spritesheet path resolution (SCAN_REPORT §1.4): paths are relative to the
// anm2's own directory, use mixed / and \ separators, and ../ climbs.
// Pure string logic — case-insensitive matching is delegated to Windows' fs.

export function dirname(path: string): string {
  const normalized = path.replace(/\\/g, "/");
  const i = normalized.lastIndexOf("/");
  return i === -1 ? "" : normalized.slice(0, i);
}

export function resolveRelative(baseDir: string, rel: string): string {
  const joined = `${baseDir.replace(/\\/g, "/")}/${rel.replace(/\\/g, "/")}`;
  const out: string[] = [];
  for (const part of joined.split("/")) {
    if (part === "" && out.length > 0) continue;
    if (part === ".") continue;
    if (part === "..") out.pop();
    else out.push(part);
  }
  return out.join("/");
}
