import { describe, expect, it } from "vitest";
import { parseAnm2 } from "../lib/anm2/parse";
import { cropGrid } from "../features/editor/cropGrid";
import { hasGameFixtures, readGfx } from "./fixtures";

describe("cropGrid", () => {
  it("collects unique rects with first-use labels and tick offsets", () => {
    const anm2 = parseAnm2(`<AnimatedActor>
      <Content>
        <Spritesheets><Spritesheet Path="a.png" Id="0"/><Spritesheet Path="b.png" Id="1"/></Spritesheets>
        <Layers><Layer Id="0" Name="body" SpritesheetId="0"/><Layer Id="1" Name="other" SpritesheetId="1"/></Layers>
        <Nulls/><Events/>
      </Content>
      <Animations DefaultAnimation="A">
        <Animation Name="A" FrameNum="4" Loop="false">
          <RootAnimation><Frame Delay="4"/></RootAnimation>
          <LayerAnimations>
            <LayerAnimation LayerId="0">
              <Frame XCrop="0" YCrop="0" Width="32" Height="32" Delay="2"/>
              <Frame XCrop="32" YCrop="0" Width="32" Height="32" Delay="2"/>
            </LayerAnimation>
            <LayerAnimation LayerId="1">
              <Frame XCrop="64" YCrop="0" Width="16" Height="16" Delay="4"/>
            </LayerAnimation>
          </LayerAnimations>
          <NullAnimations/><Triggers/>
        </Animation>
        <Animation Name="B" FrameNum="1" Loop="false">
          <RootAnimation><Frame Delay="1"/></RootAnimation>
          <LayerAnimations>
            <LayerAnimation LayerId="0">
              <Frame XCrop="0" YCrop="0" Width="32" Height="32" Delay="1"/>
            </LayerAnimation>
          </LayerAnimations>
          <NullAnimations/><Triggers/>
        </Animation>
      </Animations>
    </AnimatedActor>`);

    const rects = cropGrid(anm2, 0);
    // Duplicate rect in B is dropped (first use wins); sheet 1's rect excluded.
    expect(rects).toHaveLength(2);
    expect(rects[0]).toMatchObject({ x: 0, y: 0, w: 32, h: 32, label: "A[0]", atTick: 0 });
    expect(rects[1]).toMatchObject({ x: 32, y: 0, w: 32, h: 32, label: "A[1]", atTick: 2 });
    expect(cropGrid(anm2, 1)).toHaveLength(1);
  });

  it.skipIf(!hasGameFixtures)(
    "little c.h.a.d.: FloatDown/Spawn rects on the single sheet",
    () => {
      const anm2 = parseAnm2(readGfx("003.022_little c.h.a.d..anm2"));
      const rects = cropGrid(anm2, 0);
      // IdleDown+FloatDown share crop (0,0); Spawn adds 32,64,96,128.
      const xs = rects.map((r) => `${r.x},${r.y}`);
      expect(xs).toContain("0,0");
      expect(xs).toContain("32,0");
      expect(xs).toContain("128,0");
      expect(rects.every((r) => r.w === 32 && r.h === 32)).toBe(true);
      const spawn = rects.find((r) => r.animName === "Spawn")!;
      expect(spawn.label).toBe("Spawn[0]");
    },
  );
});
