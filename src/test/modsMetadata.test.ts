import { describe, expect, it } from "vitest";
import { parseMetadataXml } from "../lib/mods/metadata";

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
    });
  });

  it("returns nulls for empty / malformed input without throwing", () => {
    expect(parseMetadataXml("")).toEqual({
      name: null,
      description: null,
      version: null,
      directory: null,
    });
    expect(parseMetadataXml("<not-metadata/>")).toEqual({
      name: null,
      description: null,
      version: null,
      directory: null,
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
});
