import { describe, expect, it } from "vitest";
import { parseAnm2 } from "../lib/anm2/parse";
import { cropGrid } from "../features/editor/cropGrid";
import { rectAtFrame } from "../features/editor/rectAtFrame";

function build(): ReturnType<typeof parseAnm2> {
  // 2 layers, 2 sheets; head sheet (id 1) has 3 keyframes at delays 4/4/4.
  return parseAnm2(`<AnimatedActor>
    <Content>
      <Spritesheets>
        <Spritesheet Path="body.png" Id="0"/>
        <Spritesheet Path="head.png" Id="1"/>
      </Spritesheets>
      <Layers>
        <Layer Id="0" Name="body" SpritesheetId="0"/>
        <Layer Id="1" Name="head" SpritesheetId="1"/>
      </Layers>
      <Nulls/><Events/>
    </Content>
    <Animations DefaultAnimation="x">
      <Animation Name="x" FrameNum="12" Loop="false">
        <RootAnimation><Frame Delay="12"/></RootAnimation>
        <LayerAnimations>
          <LayerAnimation LayerId="0" Visible="true">
            <Frame XCrop="0"  YCrop="0" Width="16" Height="16" XPivot="0" YPivot="0" Delay="12"/>
          </LayerAnimation>
          <LayerAnimation LayerId="1" Visible="true">
            <Frame XCrop="0"  YCrop="0" Width="8" Height="8" XPivot="0" YPivot="0" Delay="4"/>
            <Frame XCrop="8"  YCrop="0" Width="8" Height="8" XPivot="0" YPivot="0" Delay="4"/>
            <Frame XCrop="16" YCrop="0" Width="8" Height="8" XPivot="0" YPivot="0" Delay="4"/>
          </LayerAnimation>
        </LayerAnimations>
        <NullAnimations/><Triggers/>
      </Animation>
    </Animations>
  </AnimatedActor>`);
}

describe("rectAtFrame", () => {
  it("returns the rect active on the head sheet at each tick", () => {
    const anm2 = build();
    const rects = cropGrid(anm2, 1);
    expect(rectAtFrame(anm2, "x", 1, 0, rects)?.x).toBe(0);
    expect(rectAtFrame(anm2, "x", 1, 3, rects)?.x).toBe(0);
    expect(rectAtFrame(anm2, "x", 1, 4, rects)?.x).toBe(8);
    expect(rectAtFrame(anm2, "x", 1, 7, rects)?.x).toBe(8);
    expect(rectAtFrame(anm2, "x", 1, 8, rects)?.x).toBe(16);
    expect(rectAtFrame(anm2, "x", 1, 11, rects)?.x).toBe(16);
  });

  it("returns the body rect when querying the body sheet (id 0)", () => {
    const anm2 = build();
    const rects = cropGrid(anm2, 0);
    expect(rectAtFrame(anm2, "x", 0, 5, rects)).toMatchObject({ x: 0, y: 0, w: 16, h: 16 });
  });

  it("returns null past the timeline or for an unknown anim", () => {
    const anm2 = build();
    const rects = cropGrid(anm2, 1);
    expect(rectAtFrame(anm2, "x", 1, 99, rects)).toBeNull();
    expect(rectAtFrame(anm2, "nope", 1, 0, rects)).toBeNull();
  });

  it("returns null when the sheet isn't used by the animation", () => {
    const anm2 = build();
    expect(rectAtFrame(anm2, "x", 9, 0, [])).toBeNull();
  });
});
