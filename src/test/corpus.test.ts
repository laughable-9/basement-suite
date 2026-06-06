// Corpus smoke test (PLAN §7): the parser must never throw on ANY of the
// game's 2,199 shipped anm2 files. Skipped without the game installed.

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parseAnm2 } from "../lib/anm2/parse";
import { hasGameFixtures, listAllAnm2 } from "./fixtures";

describe.skipIf(!hasGameFixtures)("corpus smoke test", () => {
  it("parses every shipped anm2 without throwing", () => {
    const files = listAllAnm2();
    expect(files.length).toBeGreaterThan(2000);

    const failures: string[] = [];
    for (const file of files) {
      try {
        const parsed = parseAnm2(readFileSync(file, "utf-8"));
        if (parsed.animations.length === 0) failures.push(`${file}: 0 animations`);
      } catch (err) {
        failures.push(`${file}: ${err}`);
      }
    }
    expect(failures).toEqual([]);
  }, 60_000);
});
