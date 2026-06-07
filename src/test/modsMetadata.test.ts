import { describe, expect, it } from "vitest";
import { isWorkshopMod, parseMetadataXml } from "../lib/mods/metadata";

describe("parseMetadataXml", () => {
  it("reads the canonical Workshop layout", () => {
    expect(
      parseMetadataXml(`<metadata>
        <name>My Sprite Mod</name>
        <directory>my sprite mod</directory>
        <description>Edited sprites</description>
        <version>1.0</version>
        <visibility/>
      </metadata>`),
    ).toEqual({
      name: "My Sprite Mod",
      description: "Edited sprites",
      version: "1.0",
      directory: "my sprite mod",
      id: null,
    });
  });

  it("returns nulls for empty / malformed input without throwing", () => {
    expect(parseMetadataXml("")).toEqual({
      name: null,
      description: null,
      version: null,
      directory: null,
      id: null,
    });
    expect(parseMetadataXml("<not-metadata/>")).toEqual({
      name: null,
      description: null,
      version: null,
      directory: null,
      id: null,
    });
    // Even nonsense shouldn't throw.
    expect(() => parseMetadataXml("<<<")).not.toThrow();
  });

  it("trims whitespace and accepts capitalized variants", () => {
    expect(
      parseMetadataXml(`<Metadata>
        <Name>  Caps Mod  </Name>
        <Version>2.0</Version>
      </Metadata>`),
    ).toMatchObject({ name: "Caps Mod", version: "2.0" });
  });

  it("reads workshop id and flags isWorkshopMod when numeric", () => {
    const meta = parseMetadataXml(`<metadata>
      <name>EID</name>
      <id>836319872</id>
    </metadata>`);
    expect(meta.id).toBe("836319872");
    expect(isWorkshopMod(meta)).toBe(true);
  });

  it("treats a non-numeric or missing id as a local mod", () => {
    expect(
      isWorkshopMod(
        parseMetadataXml("<metadata><name>local</name></metadata>"),
      ),
    ).toBe(false);
    expect(
      isWorkshopMod(
        parseMetadataXml("<metadata><id>nope</id></metadata>"),
      ),
    ).toBe(false);
  });
});
