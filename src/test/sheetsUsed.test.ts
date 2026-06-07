import { describe, expect, it } from "vitest";
import { parseAnm2 } from "../lib/anm2/parse";
import {
  sheetIdsUsedByAnim,
  sheetNamesUsedByAnim,
} from "../lib/anm2/sheetsUsed";

function multiSheet(anim: { name: string; tracks: { layerId: number }[] }) {
  return parseAnm2(`<AnimatedActor>
    <Content>
      <Spritesheets>
        <Spritesheet Path="body.png" Id="0"/>
        <Spritesheet Path="head.png" Id="1"/>
        <Spritesheet Path="ghost.png" Id="2"/>
      </Spritesheets>
      <Layers>
        <Layer Id="0" Name="body"  SpritesheetId="0"/>
        <Layer Id="1" Name="head"  SpritesheetId="1"/>
        <Layer Id="2" Name="ghost" SpritesheetId="2"/>
      </Layers>
      <Nulls/><Events/>
    </Content>
    <Animations DefaultAnimation="${anim.name}">
      <Animation Name="${anim.name}" FrameNum="4" Loop="false">
        <RootAnimation><Frame Delay="4"/></RootAnimation>
        <LayerAnimations>
          ${anim.tracks
            .map(
              (t) =>
                `<LayerAnimation LayerId="${t.layerId}" Visible="true"><Frame XCrop="0" YCrop="0" Width="16" Height="16" XPivot="0" YPivot="0" Delay="4"/></LayerAnimation>`,
            )
            .join("")}
        </LayerAnimations>
        <NullAnimations/><Triggers/>
      </Animation>
    </Animations>
  </AnimatedActor>`);
}

describe("sheetsUsedByAnim", () => {
  it("returns one sheet for a single-layer anim", () => {
    const a = multiSheet({ name: "WalkDown", tracks: [{ layerId: 0 }] });
    expect(sheetIdsUsedByAnim(a, a.animations[0])).toEqual([0]);
    expect(sheetNamesUsedByAnim(a, a.animations[0])).toEqual(["body.png"]);
  });

  it("dedupes sheet ids across layers", () => {
    const a = multiSheet({
      name: "Death",
      tracks: [{ layerId: 0 }, { layerId: 2 }, { layerId: 0 }],
    });
    expect(sheetNamesUsedByAnim(a, a.animations[0])).toEqual([
      "body.png",
      "ghost.png",
    ]);
  });

  it("ignores hidden layer tracks", () => {
    const xml = `<AnimatedActor>
      <Content>
        <Spritesheets>
          <Spritesheet Path="body.png" Id="0"/>
          <Spritesheet Path="ghost.png" Id="1"/>
        </Spritesheets>
        <Layers>
          <Layer Id="0" Name="body" SpritesheetId="0"/>
          <Layer Id="1" Name="ghost" SpritesheetId="1"/>
        </Layers>
        <Nulls/><Events/>
      </Content>
      <Animations DefaultAnimation="x">
        <Animation Name="x" FrameNum="4" Loop="false">
          <RootAnimation><Frame Delay="4"/></RootAnimation>
          <LayerAnimations>
            <LayerAnimation LayerId="0" Visible="true">
              <Frame XCrop="0" YCrop="0" Width="16" Height="16" XPivot="0" YPivot="0" Delay="4"/>
            </LayerAnimation>
            <LayerAnimation LayerId="1" Visible="false">
              <Frame XCrop="0" YCrop="0" Width="16" Height="16" XPivot="0" YPivot="0" Delay="4"/>
            </LayerAnimation>
          </LayerAnimations>
          <NullAnimations/><Triggers/>
        </Animation>
      </Animations>
    </AnimatedActor>`;
    const a = parseAnm2(xml);
    expect(sheetNamesUsedByAnim(a, a.animations[0])).toEqual(["body.png"]);
  });
});
