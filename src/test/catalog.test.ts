import { describe, expect, it } from "vitest";
import { buildCatalog, searchCatalog } from "../lib/catalog/build";
import {
  hasGameFixtures,
  listGfxRelative,
  readResourceText,
} from "./fixtures";

describe("buildCatalog (synthetic)", () => {
  const sources = {
    entities2Xml: `<entities>
      <entity id="10" variant="0" name="Gaper" anm2path="010.001_gaper.anm2" boss="0"/>
      <entity id="20" variant="0" name="Monstro" anm2path="020.000_monstro.anm2" boss="1"/>
      <entity id="20" variant="1" name="Monstro Champ" anm2path="020.000_monstro.anm2" boss="1"/>
      <entity id="3" variant="22" name="Little C.H.A.D." anm2path="003.022_little c.h.a.d..anm2" boss="0"/>
      <entity id="2" variant="0" name="Tear" anm2path="002.000_tear.anm2" boss="0"/>
      <entity id="1000" variant="0" name="Poof" anm2path="1000.000_poof.anm2" boss="0"/>
      <entity id="50" variant="0" name="Ghost" anm2path="050.000_missing.anm2" boss="0"/>
      <entity id="51" variant="0" name="NoPath"/>
    </entities>`,
    itemsXml: `<items>
      <passive id="1" name="#X" gfx="Collectibles_001_TheSadOnion.png"/>
      <trinket id="5" name="#Y" gfx="Trinket_005_PurpleHeart.png"/>
      <passive id="9" name="#Z" gfx="Collectibles_404_Missing.png"/>
    </items>`,
    playersXml: `<players>
      <player id="0" name="#ISAAC" skin="Character_001_Isaac.png"/>
      <player id="99" name="#TAINTED" skin="Character_001_Isaac.png"/>
    </players>`,
    gfxFiles: [
      "010.001_gaper.anm2",
      "020.000_monstro.anm2",
      "003.022_little c.h.a.d..anm2",
      "002.000_tear.anm2",
      "1000.000_poof.anm2",
      "items/collectibles/Collectibles_001_TheSadOnion.png",
      "items/trinkets/Trinket_005_PurpleHeart.png",
      "characters/costumes/Character_001_Isaac.png",
      "ui/main menu/titlemenu.png",
      "ui/hudpickups.anm2",
      "ui/hudpickups.png",
      "grid/props_03_caves.anm2",
      "cutscenes/intro.anm2",
      "backdrop/01_basement.png",
    ],
  };
  const catalog = buildCatalog(sources);
  const byKey = new Map(catalog.entries.map((e) => [e.key, e]));

  it("categorizes entities by type id and boss flag", () => {
    expect(byKey.get("entity:10.0.0")).toMatchObject({
      name: "Gaper",
      category: "enemies",
      subcategory: null,
    });
    expect(byKey.get("entity:20.0.0")).toMatchObject({
      category: "enemies",
      subcategory: "Bosses",
    });
    expect(byKey.get("entity:3.22.0")).toMatchObject({
      category: "familiars",
    });
    expect(byKey.get("entity:2.0.0")).toMatchObject({
      category: "tears",
      subcategory: "Tears",
    });
    expect(byKey.get("entity:1000.0.0")).toMatchObject({
      category: "effects",
    });
  });

  it("dedupes variants sharing one anm2", () => {
    expect(byKey.has("entity:20.1.0")).toBe(false);
  });

  it("skips rows whose files are missing, with warnings", () => {
    expect(byKey.has("entity:50.0.0")).toBe(false);
    expect(catalog.warnings.some((w) => w.includes("050.000_missing"))).toBe(
      true,
    );
    expect(catalog.warnings.some((w) => w.includes("Collectibles_404"))).toBe(
      true,
    );
  });

  it("names items from gfx filenames", () => {
    expect(byKey.get("item:c1")).toMatchObject({
      name: "The Sad Onion",
      category: "items",
      subcategory: "Collectibles",
      sheetPath: "items/collectibles/Collectibles_001_TheSadOnion.png",
    });
    expect(byKey.get("item:t5")).toMatchObject({ subcategory: "Trinkets" });
  });

  it("dedupes characters reusing a skin and links the player anm2", () => {
    expect(byKey.get("player:0")).toMatchObject({
      name: "Isaac",
      category: "characters",
      anm2Path: "001.000_player.anm2",
    });
    expect(byKey.has("player:99")).toBe(false);
  });

  it("classifies folder categories and skips pngs owned by an anm2", () => {
    expect(byKey.get("file:ui/main menu/titlemenu.png")).toMatchObject({
      category: "ui",
      subcategory: "Main Menu",
    });
    expect(byKey.get("file:ui/hudpickups.anm2")).toMatchObject({
      subcategory: "HUD",
    });
    expect(byKey.has("file:ui/hudpickups.png")).toBe(false); // same-stem anm2
    expect(byKey.get("file:grid/props_03_caves.anm2")?.category).toBe("grid");
    expect(byKey.get("file:cutscenes/intro.anm2")?.category).toBe("cutscenes");
    expect(byKey.get("file:backdrop/01_basement.png")?.category).toBe(
      "backdrops",
    );
  });

  it("search ranks name prefix > name substring > path", () => {
    const hits = searchCatalog(catalog.entries, "gap");
    expect(hits[0]?.name).toBe("Gaper");
    expect(searchCatalog(catalog.entries, "sad onion")[0]?.name).toBe(
      "The Sad Onion",
    );
    expect(searchCatalog(catalog.entries, "")).toEqual([]);
  });
});

describe.skipIf(!hasGameFixtures)("buildCatalog (real game data)", () => {
  const catalog = buildCatalog({
    entities2Xml: readResourceText("entities2.xml"),
    itemsXml: readResourceText("items.xml"),
    playersXml: readResourceText("players.xml"),
    gfxFiles: listGfxRelative(),
  });
  const by = (cat: string, sub?: string | null) =>
    catalog.entries.filter(
      (e) => e.category === cat && (sub === undefined || e.subcategory === sub),
    );

  it("has globally unique entry keys (React list keys depend on it)", () => {
    const keys = new Set(catalog.entries.map((e) => e.key));
    expect(keys.size).toBe(catalog.entries.length);
  });

  it("finds the expected category populations", () => {
    expect(by("enemies").length).toBeGreaterThan(400);
    expect(by("enemies", "Bosses").length).toBeGreaterThan(80);
    expect(by("items").length).toBeGreaterThan(600);
    expect(by("characters").length).toBeGreaterThan(20);
    expect(by("familiars").length).toBeGreaterThan(100);
    expect(by("ui").length).toBeGreaterThan(100);
  });

  it("files Gaper under Enemies and Monstro under Bosses", () => {
    const gaper = catalog.entries.find((e) => e.name === "Gaper");
    expect(gaper?.category).toBe("enemies");
    const monstro = catalog.entries.find((e) => e.name === "Monstro");
    expect(monstro?.category).toBe("enemies");
    expect(monstro?.subcategory).toBe("Bosses");
  });

  it('names "The Sad Onion" from its gfx filename', () => {
    const onion = catalog.entries.find((e) => e.name === "The Sad Onion");
    expect(onion?.category).toBe("items");
    expect(onion?.sheetPath?.toLowerCase()).toContain("collectibles_001");
  });

  it("search: 'brim' finds Brimstone-related entries", () => {
    const hits = searchCatalog(catalog.entries, "brim");
    expect(hits.length).toBeGreaterThan(0);
    expect(hits.some((h) => h.name.toLowerCase().includes("brim"))).toBe(true);
  });
});
