import { describe, expect, it } from "vitest";
import { peekAnm2 } from "../lib/anm2/peek";

// Synthetic fixtures modeled on real corpus quirks documented in SCAN_REPORT §3.
// Corpus-backed golden tests (reading from extractedResourcesPath) land in M1.

const NORMAL = `<AnimatedActor>
  <Info CreatedBy="robot" CreatedOn="07.02.2014" Fps="30" Version="104" />
  <Content>
    <Spritesheets>
      <Spritesheet Path="familiar/familiar_spawners_03_littlechad.png" Id="0" />
      <Spritesheet Id="1" Path="shadow.png" />
    </Spritesheets>
  </Content>
  <Animations DefaultAnimation="IdleDown">
    <Animation Name="IdleDown" FrameNum="1" Loop="false"></Animation>
    <Animation FrameNum="16" Name="FloatDown" Loop="true"></Animation>
    <Animation Name="Spawn" FrameNum="4" Loop="False"></Animation>
  </Animations>
</AnimatedActor>`;

describe("peekAnm2", () => {
  it("extracts animations regardless of attribute order", () => {
    const peek = peekAnm2(NORMAL);
    expect(peek.animations).toEqual([
      { name: "IdleDown", frameNum: 1, loop: false },
      { name: "FloatDown", frameNum: 16, loop: true },
      { name: "Spawn", frameNum: 4, loop: false }, // capital-F "False"
    ]);
    expect(peek.defaultAnimation).toBe("IdleDown");
    expect(peek.fps).toBe(30);
  });

  it("does not confuse <Animations> with <Animation>", () => {
    const peek = peekAnm2(NORMAL);
    expect(peek.animations.map((a) => a.name)).not.toContain("");
  });

  it("finds Spritesheet paths regardless of attribute order", () => {
    expect(peekAnm2(NORMAL).spritesheets).toEqual([
      "familiar/familiar_spawners_03_littlechad.png",
      "shadow.png",
    ]);
  });

  it("clamps garbage FPS (giantbook_mama_mega has Fps=107844072)", () => {
    const xml = `<AnimatedActor><Info Fps="107844072"/><Animations DefaultAnimation="x"/></AnimatedActor>`;
    expect(peekAnm2(xml).fps).toBe(30);
  });

  it("defaults FPS to 30 when <Info> is absent (18 shipped files)", () => {
    const xml = `<AnimatedActor><Animations DefaultAnimation="Idle"><Animation Name="Idle" FrameNum="1" Loop="false"></Animation></Animations></AnimatedActor>`;
    expect(peekAnm2(xml).fps).toBe(30);
  });

  it("tolerates FrameNum=0 (collectible 'Empty' animation)", () => {
    const xml = `<AnimatedActor><Animations DefaultAnimation="Empty"><Animation Name="Empty" FrameNum="0" Loop="false"></Animation></Animations></AnimatedActor>`;
    expect(peekAnm2(xml).animations[0].frameNum).toBe(0);
  });
});
