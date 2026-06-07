import { describe, expect, it } from "vitest";
import { headAnimFor } from "../lib/anm2/compose";
import { parseAnm2 } from "../lib/anm2/parse";

const ANM2 = parseAnm2(`<AnimatedActor>
  <Content><Spritesheets/><Layers/><Nulls/><Events/></Content>
  <Animations DefaultAnimation="WalkDown">
    <Animation Name="WalkDown" FrameNum="20" Loop="true"/>
    <Animation Name="HeadDown" FrameNum="4" Loop="false"/>
    <Animation Name="Pickup" FrameNum="42" Loop="false"/>
  </Animations>
</AnimatedActor>`);

describe("headAnimFor", () => {
  it("matches Walk* to its Head* animation", () => {
    const walk = ANM2.animations.find((a) => a.name === "WalkDown")!;
    expect(headAnimFor(ANM2, walk)?.name).toBe("HeadDown");
  });

  it("returns null for non-Walk states (no self-match double-draw)", () => {
    const pickup = ANM2.animations.find((a) => a.name === "Pickup")!;
    expect(headAnimFor(ANM2, pickup)).toBeNull();
  });

  it("returns null when the head animation is absent", () => {
    const walkUp = { ...ANM2.animations[0], name: "WalkUp" };
    expect(headAnimFor(ANM2, walkUp)).toBeNull();
  });
});
