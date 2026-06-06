import { describe, expect, it } from "vitest";
import { parseAnm2 } from "../lib/anm2/parse";

// Every landmine here is real shipped-game data documented in SCAN_REPORT §3.

function doc(inner: string): string {
  return `<AnimatedActor>${inner}</AnimatedActor>`;
}

const MINIMAL_CONTENT = `<Content>
  <Spritesheets><Spritesheet Path="sheet.png" Id="0"/></Spritesheets>
  <Layers><Layer Id="0" Name="body" SpritesheetId="0"/></Layers>
  <Nulls/><Events/>
</Content>`;

describe("parseAnm2 structure", () => {
  it("parses the full element tree", () => {
    const a = parseAnm2(
      doc(`<Info CreatedBy="robot" CreatedOn="07.02.2014" Fps="30" Version="104"/>
      ${MINIMAL_CONTENT}
      <Animations DefaultAnimation="Idle">
        <Animation Name="Idle" FrameNum="2" Loop="true">
          <RootAnimation><Frame XPosition="0" YPosition="0" Delay="2" Visible="true"/></RootAnimation>
          <LayerAnimations>
            <LayerAnimation LayerId="0" Visible="true">
              <Frame XPosition="1" YPosition="-8" XPivot="16" YPivot="24" XCrop="0" YCrop="0" Width="32" Height="32" Delay="2" Interpolated="true"/>
            </LayerAnimation>
          </LayerAnimations>
          <NullAnimations/>
          <Triggers><Trigger EventId="2" AtFrame="1"/></Triggers>
        </Animation>
      </Animations>`),
    );
    expect(a.info.fps).toBe(30);
    expect(a.content.spritesheets).toEqual([{ id: 0, rawPath: "sheet.png" }]);
    expect(a.content.layers[0]).toMatchObject({ id: 0, name: "body", blendMode: "normal" });
    expect(a.defaultAnimation).toBe("Idle");
    const anim = a.animations[0];
    expect(anim.frameNum).toBe(2);
    expect(anim.loop).toBe(true);
    expect(anim.rootFrames).toHaveLength(1);
    expect(anim.layers[0].frames[0]).toMatchObject({
      x: 1, y: -8, xPivot: 16, yPivot: 24, width: 32, height: 32,
      interpolated: true, delay: 2,
    });
    expect(anim.triggers).toEqual([{ eventId: 2, atFrame: 1 }]);
  });

  it("preserves LayerAnimation declaration order (z-order), not id order", () => {
    const a = parseAnm2(
      doc(`${MINIMAL_CONTENT}<Animations DefaultAnimation="x">
        <Animation Name="x" FrameNum="1" Loop="false">
          <RootAnimation><Frame Delay="1"/></RootAnimation>
          <LayerAnimations>
            <LayerAnimation LayerId="2" Visible="true"><Frame Delay="1"/></LayerAnimation>
            <LayerAnimation LayerId="0" Visible="true"><Frame Delay="1"/></LayerAnimation>
            <LayerAnimation LayerId="1" Visible="true"><Frame Delay="1"/></LayerAnimation>
          </LayerAnimations>
          <NullAnimations/><Triggers/>
        </Animation>
      </Animations>`),
    );
    expect(a.animations[0].layers.map((l) => l.layerId)).toEqual([2, 0, 1]);
  });

  it("handles single-child elements as arrays", () => {
    const a = parseAnm2(
      doc(`${MINIMAL_CONTENT}<Animations DefaultAnimation="x">
        <Animation Name="x" FrameNum="1" Loop="false"/>
      </Animations>`),
    );
    expect(a.animations).toHaveLength(1);
    expect(a.content.spritesheets).toHaveLength(1);
  });
});

describe("parseAnm2 landmines (SCAN_REPORT §3)", () => {
  it("clamps garbage FPS to default (giantbook_mama_mega: 107844072)", () => {
    const a = parseAnm2(doc(`<Info Fps="107844072"/><Animations DefaultAnimation=""/>`));
    expect(a.info.fps).toBe(30);
  });

  it("defaults FPS when <Info> is missing entirely (18 shipped files)", () => {
    const a = parseAnm2(doc(`<Animations DefaultAnimation=""/>`));
    expect(a.info.fps).toBe(30);
  });

  it("keeps legitimate non-30 FPS (31 files use 45)", () => {
    const a = parseAnm2(doc(`<Info Fps="45"/><Animations DefaultAnimation=""/>`));
    expect(a.info.fps).toBe(45);
  });

  it("wraps uint32-encoded negative crops (XCrop=4294967293 → −3)", () => {
    const a = parseAnm2(
      doc(`${MINIMAL_CONTENT}<Animations DefaultAnimation="x">
        <Animation Name="x" FrameNum="1" Loop="false">
          <RootAnimation><Frame Delay="1"/></RootAnimation>
          <LayerAnimations><LayerAnimation LayerId="0">
            <Frame XCrop="4294967293" YCrop="4294967290" Width="32" Height="32" Delay="1"/>
          </LayerAnimation></LayerAnimations>
          <NullAnimations/><Triggers/>
        </Animation>
      </Animations>`),
    );
    const f = a.animations[0].layers[0].frames[0];
    expect(f.xCrop).toBe(-3);
    expect(f.yCrop).toBe(-6);
  });

  it('treats Visible="37" as visible (big_isaac.anm2)', () => {
    const a = parseAnm2(
      doc(`${MINIMAL_CONTENT}<Animations DefaultAnimation="x">
        <Animation Name="x" FrameNum="1" Loop="false">
          <RootAnimation><Frame Delay="1" Visible="37"/></RootAnimation>
          <LayerAnimations/><NullAnimations/><Triggers/>
        </Animation>
      </Animations>`),
    );
    expect(a.animations[0].rootFrames[0].visible).toBe(true);
  });

  it('parses Interpolated="False" with capital F', () => {
    const a = parseAnm2(
      doc(`${MINIMAL_CONTENT}<Animations DefaultAnimation="x">
        <Animation Name="x" FrameNum="1" Loop="False">
          <RootAnimation><Frame Delay="1" Interpolated="False"/></RootAnimation>
          <LayerAnimations/><NullAnimations/><Triggers/>
        </Animation>
      </Animations>`),
    );
    expect(a.animations[0].loop).toBe(false);
    expect(a.animations[0].rootFrames[0].interpolated).toBe(false);
  });

  it("clamps insane tints (RedTint=37914128, AlphaTint=900, negatives)", () => {
    const a = parseAnm2(
      doc(`${MINIMAL_CONTENT}<Animations DefaultAnimation="x">
        <Animation Name="x" FrameNum="1" Loop="false">
          <RootAnimation><Frame Delay="1" RedTint="37914128" GreenTint="-255" AlphaTint="900" RedOffset="263"/></RootAnimation>
          <LayerAnimations/><NullAnimations/><Triggers/>
        </Animation>
      </Animations>`),
    );
    const f = a.animations[0].rootFrames[0];
    expect(f.tint).toEqual({ r: 255, g: 0, b: 255, a: 255 });
    expect(f.offset.r).toBe(255);
  });

  it("tolerates FrameNum=0 and empty animations ('Empty' in collectible)", () => {
    const a = parseAnm2(
      doc(`${MINIMAL_CONTENT}<Animations DefaultAnimation="Empty">
        <Animation Name="Empty" FrameNum="0" Loop="false"/>
      </Animations>`),
    );
    expect(a.animations[0].frameNum).toBe(0);
    expect(a.animations[0].layers).toEqual([]);
  });

  it("recognizes BlendMode=1 as additive (level 2 willo)", () => {
    const a = parseAnm2(
      doc(`<Content><Spritesheets/><Layers>
        <Layer Id="3" Name="glow" SpritesheetId="1" BlendMode="1"/>
      </Layers><Nulls/><Events/></Content><Animations DefaultAnimation=""/>`),
    );
    expect(a.content.layers[0].blendMode).toBe("additive");
  });
});
