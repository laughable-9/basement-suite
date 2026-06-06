import { describe, expect, it } from "vitest";
import {
  buildExportPaths,
  isValidModName,
  metadataXml,
  relUnderGfx,
} from "../features/export/modExport";

const GFX = "C:/Games/Isaac/extracted_resources/resources/gfx";
const MODS = "C:/Games/Isaac/mods";

describe("relUnderGfx", () => {
  it("computes the gfx-relative mirror path", () => {
    expect(
      relUnderGfx(`${GFX}/familiar/familiar_spawners_03_littlechad.png`, GFX),
    ).toBe("familiar/familiar_spawners_03_littlechad.png");
  });

  it("is case-insensitive and separator-tolerant (Windows reality)", () => {
    expect(
      relUnderGfx(
        "C:/games/isaac/EXTRACTED_RESOURCES/resources/gfx\\ui\\hudpickups.png",
        GFX,
      ),
    ).toBe("ui/hudpickups.png");
  });

  it("returns null for paths outside gfx", () => {
    expect(relUnderGfx("C:/elsewhere/sheet.png", GFX)).toBeNull();
  });
});

describe("buildExportPaths", () => {
  it("mirrors into modsPath/<mod>/resources/gfx/...", () => {
    const p = buildExportPaths(MODS, "my mod", "familiar/chad.png");
    expect(p.pngPath).toBe(`${MODS}/my mod/resources/gfx/familiar/chad.png`);
    expect(p.metadataPath).toBe(`${MODS}/my mod/metadata.xml`);
  });
});

describe("isValidModName", () => {
  it("accepts normal names", () => {
    expect(isValidModName("my sprite mod")).toBe(true);
    expect(isValidModName("ReColor_v2")).toBe(true);
  });

  it("rejects path escapes and reserved characters", () => {
    for (const bad of ["", "  ", "a/b", "a\\b", "..", "con?", 'x"y', "dot."]) {
      expect(isValidModName(bad), bad).toBe(false);
    }
  });
});

describe("metadataXml", () => {
  it("produces minimal valid metadata with matching directory", () => {
    const xml = metadataXml("my mod");
    expect(xml).toContain("<name>my mod</name>");
    expect(xml).toContain("<directory>my mod</directory>");
    expect(xml).toContain("<version>1.0</version>");
  });

  it("escapes XML-significant characters", () => {
    expect(metadataXml("a&b")).toContain("<name>a&amp;b</name>");
  });
});
