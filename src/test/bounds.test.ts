import { describe, expect, it } from "vitest";
import { frameBounds } from "../lib/anm2/bounds";
import { parseAnm2 } from "../lib/anm2/parse";

function anim(framesXml: string, rootXml = '<Frame Delay="8"/>') {
  return parseAnm2(`<AnimatedActor>
    <Content><Spritesheets><Spritesheet Path="a.png" Id="0"/></Spritesheets>
    <Layers><Layer Id="0" Name="l" SpritesheetId="0"/></Layers><Nulls/><Events/></Content>
    <Animations DefaultAnimation="x">
      <Animation Name="x" FrameNum="8" Loop="false">
        <RootAnimation>${rootXml}</RootAnimation>
        <LayerAnimations><LayerAnimation LayerId="0">${framesXml}</LayerAnimation></LayerAnimations>
        <NullAnimations/><Triggers/>
      </Animation>
    </Animations>
  </AnimatedActor>`).animations[0];
}

describe("frameBounds", () => {
  it("computes the pivot-anchored rect", () => {
    const a = anim(
      '<Frame XCrop="0" YCrop="0" Width="32" Height="32" XPivot="16" YPivot="24" Delay="8"/>',
    );
    expect(frameBounds(a, 0)).toEqual({
      minX: -16,
      minY: -24,
      maxX: 16,
      maxY: 8,
    });
  });

  it("applies percent scale and position", () => {
    const a = anim(
      '<Frame XCrop="0" YCrop="0" Width="10" Height="10" XPivot="0" YPivot="0" XScale="200" YScale="100" XPosition="5" YPosition="-5" Delay="8"/>',
    );
    expect(frameBounds(a, 0)).toEqual({
      minX: 5,
      minY: -5,
      maxX: 25,
      maxY: 5,
    });
  });

  it("applies root scale on top of the layer transform", () => {
    const a = anim(
      '<Frame XCrop="0" YCrop="0" Width="10" Height="10" XPivot="0" YPivot="0" Delay="8"/>',
      '<Frame XScale="300" YScale="300" Delay="8"/>',
    );
    expect(frameBounds(a, 0)).toEqual({
      minX: 0,
      minY: 0,
      maxX: 30,
      maxY: 30,
    });
  });

  it("returns null when nothing is visible", () => {
    const a = anim(
      '<Frame XCrop="0" YCrop="0" Width="10" Height="10" XPivot="0" YPivot="0" Visible="false" Delay="8"/>',
    );
    expect(frameBounds(a, 0)).toBeNull();
  });

  it("handles 90° rotation", () => {
    const a = anim(
      '<Frame XCrop="0" YCrop="0" Width="20" Height="10" XPivot="0" YPivot="0" Rotation="90" Delay="8"/>',
    );
    const b = frameBounds(a, 0)!;
    expect(b.minX).toBeCloseTo(-10);
    expect(b.maxX).toBeCloseTo(0);
    expect(b.minY).toBeCloseTo(0);
    expect(b.maxY).toBeCloseTo(20);
  });
});
