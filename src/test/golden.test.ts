// Golden tests against the 5 representative REAL game files profiled in
// SCAN_REPORT §2.5. Skipped when the game isn't available (e.g. CI).

import { describe, expect, it } from "vitest";
import { parseAnm2 } from "../lib/anm2/parse";
import { hasGameFixtures, readGfx } from "./fixtures";

describe.skipIf(!hasGameFixtures)("golden: real game files", () => {
  it("001.000_player.anm2", () => {
    const a = parseAnm2(readGfx("001.000_player.anm2"));
    expect(a.info.fps).toBe(30);
    expect(a.content.spritesheets).toHaveLength(2);
    expect(a.content.layers).toHaveLength(15);
    expect(a.content.nulls).toHaveLength(8);
    expect(a.content.events.map((e) => e.name)).toEqual([
      "FX", "Poof", "DeathSound", "Hit",
    ]);
    expect(a.defaultAnimation).toBe("WalkDown");
    expect(a.animations).toHaveLength(39);
    const death = a.animations.find((x) => x.name === "Death")!;
    expect(death.triggers).toContainEqual({ eventId: 2, atFrame: 8 });
  });

  it("003.022_little c.h.a.d..anm2 — FloatDown timing", () => {
    const a = parseAnm2(readGfx("003.022_little c.h.a.d..anm2"));
    expect(a.defaultAnimation).toBe("IdleDown");
    const float = a.animations.find((x) => x.name === "FloatDown")!;
    expect(float.frameNum).toBe(16);
    expect(float.loop).toBe(true);
    expect(float.layers[0].frames).toHaveLength(8);
    // 8 keyframes × Delay=2 = 16 ticks = FrameNum
    expect(float.layers[0].frames.reduce((s, f) => s + f.delay, 0)).toBe(16);
    expect(float.layers[0].frames.every((f) => f.interpolated)).toBe(true);
    expect(float.rootFrames[0].delay).toBe(16);
  });

  it("010.001_gaper.anm2 — two sheets, two layers", () => {
    const a = parseAnm2(readGfx("010.001_gaper.anm2"));
    expect(a.content.spritesheets.map((s) => s.rawPath)).toEqual([
      "Monsters/Classic/Monster_000_Bodies01.png",
      "Monsters/Classic/Monster_017_Gaper.png",
    ]);
    expect(a.animations.map((x) => x.name)).toEqual([
      "WalkHori", "WalkVert", "Head",
    ]);
  });

  it("005.100_collectible.anm2 — FrameNum=0 'Empty'", () => {
    const a = parseAnm2(readGfx("005.100_collectible.anm2"));
    expect(a.content.spritesheets).toHaveLength(4);
    expect(a.content.layers).toHaveLength(6);
    const empty = a.animations.find((x) => x.name === "Empty")!;
    expect(empty.frameNum).toBe(0);
  });

  it("003.080_incubus.anm2 — z-order differs from id order", () => {
    const a = parseAnm2(readGfx("003.080_incubus.anm2"));
    const float = a.animations.find((x) => x.name === "FloatDown")!;
    expect(float.layers.map((l) => l.layerId)).toEqual([2, 0, 1]);
  });

  it("ui/giantbook/giantbook_mama_mega.anm2 — garbage FPS clamped", () => {
    const a = parseAnm2(readGfx("ui/giantbook/giantbook_mama_mega.anm2"));
    expect(a.info.fps).toBe(30);
  });
});
