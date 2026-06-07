import { describe, expect, it } from "vitest";
import { findSharedSheetInfo } from "../features/editor/sharedSheet";
import type { Catalog } from "../lib/catalog/types";

function cat(rows: { name: string; costume?: string }[]): Catalog {
  return {
    entries: rows.map((r) => ({
      key: `player:${r.name}`,
      name: r.name,
      category: "characters" as const,
      subcategory: null,
      anm2Path: "001.000_player.anm2",
      sheetPath: `characters/costumes/${r.name.toLowerCase()}.png`,
      costumeAnm2Path: r.costume ?? null,
      source: "players" as const,
    })),
    warnings: [],
  };
}

describe("findSharedSheetInfo", () => {
  it("returns null for the per-character skin (sheet 0 of player anm2)", () => {
    const c = cat([{ name: "Isaac" }, { name: "Maggy" }]);
    expect(
      findSharedSheetInfo(c, "Isaac", "C:/g/001.000_player.anm2", 0),
    ).toBeNull();
  });

  it("warns when a non-skin sheet of the player anm2 is edited (ghost/tears/Isaac's head)", () => {
    const c = cat([
      { name: "Isaac" },
      { name: "Maggy" },
      { name: "Cain" },
    ]);
    const info = findSharedSheetInfo(
      c,
      "Isaac",
      "C:/g/001.000_player.anm2",
      1,
    );
    expect(info?.reason).toBe("player");
    expect(info?.others).toEqual(["Maggy", "Cain"]);
  });

  it("warns when a costume anm2 is shared by multiple characters", () => {
    const c = cat([
      { name: "Azazel", costume: "characters/costumes/lord.anm2" },
      { name: "TaintedAzazel", costume: "characters/costumes/lord.anm2" },
      { name: "Other", costume: "characters/costumes/bandage.anm2" },
    ]);
    const info = findSharedSheetInfo(
      c,
      "Azazel",
      "C:/g/characters/costumes/lord.anm2",
      0,
    );
    expect(info?.reason).toBe("costume");
    expect(info?.others).toEqual(["TaintedAzazel"]);
  });

  it("returns null for a costume only one character uses", () => {
    const c = cat([
      { name: "Azazel", costume: "characters/costumes/lord.anm2" },
      { name: "Other", costume: "characters/costumes/bandage.anm2" },
    ]);
    expect(
      findSharedSheetInfo(
        c,
        "Azazel",
        "C:/g/characters/costumes/lord.anm2",
        0,
      ),
    ).toBeNull();
  });

  it("returns null when there's no catalog or no anm2 path", () => {
    expect(findSharedSheetInfo(null, "Isaac", "x.anm2", 0)).toBeNull();
    expect(
      findSharedSheetInfo(cat([{ name: "Isaac" }]), "Isaac", null, 0),
    ).toBeNull();
  });
});
