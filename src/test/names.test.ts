import { describe, expect, it } from "vitest";
import { nameFromLocKey, prettifyGfxName } from "../lib/catalog/names";

describe("nameFromLocKey", () => {
  it("decodes localization keys", () => {
    expect(nameFromLocKey("#FROWNING_GAPER")).toBe("Frowning Gaper");
    expect(nameFromLocKey("#LEVEL_2_GAPER")).toBe("Level 2 Gaper");
    expect(nameFromLocKey("#MONSTRO_II")).toBe("Monstro II");
  });

  it("passes literal names through", () => {
    expect(nameFromLocKey("Deep Gaper")).toBe("Deep Gaper");
  });
});

describe("prettifyGfxName", () => {
  it("turns item gfx filenames into display names", () => {
    expect(prettifyGfxName("Collectibles_001_TheSadOnion.png")).toBe(
      "The Sad Onion",
    );
    expect(prettifyGfxName("Collectibles_002_TheInnerEye.png")).toBe(
      "The Inner Eye",
    );
    expect(prettifyGfxName("Trinket_005_PurpleHeart.png")).toBe(
      "Purple Heart",
    );
  });

  it("handles character skins", () => {
    expect(prettifyGfxName("Character_001_Isaac.png")).toBe("Isaac");
    expect(prettifyGfxName("Character_002_Magdalene.png")).toBe("Magdalene");
  });

  it("strips entity id prefixes from anm2 names", () => {
    expect(prettifyGfxName("010.001_gaper.anm2")).toBe("Gaper");
    expect(prettifyGfxName("003.022_little c.h.a.d..anm2")).toBe(
      "Little C.h.a.d.",
    );
  });

  it("handles paths, underscores and digits", () => {
    expect(prettifyGfxName("ui/main menu/titlemenu.png")).toBe("Titlemenu");
    expect(prettifyGfxName("ui_cardfronts.anm2")).toBe("Ui Cardfronts");
    expect(prettifyGfxName("boss_021_gurdyjr_blue.png")).toBe("Gurdyjr Blue");
  });
});
