// Lenient anm2 parser. Hard requirement (CLAUDE.md): never throw on
// shipped-game data — every weird value documented in SCAN_REPORT §3 is
// normalized here, with a unit test pinning each case.
//
// Pure TS: no DOM, no Tauri. Runs in Node under vitest.

import { XMLParser } from "fast-xml-parser";
import type {
  Anm2,
  Anm2Animation,
  LayerFrame,
  LayerTrack,
  NullTrack,
  TransformFrame,
} from "./types";

const FPS_MIN = 1;
const FPS_MAX = 120;
const FPS_DEFAULT = 30;

// Elements that must always be arrays even with a single child.
const ARRAY_ELEMENTS = new Set([
  "Spritesheet",
  "Layer",
  "Null",
  "Event",
  "Animation",
  "LayerAnimation",
  "NullAnimation",
  "Frame",
  "Trigger",
]);

const xml = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "",
  // Keep attribute values as strings; numeric coercion below handles the
  // garbage values (uint32 wraps, "37" bools) explicitly.
  parseAttributeValue: false,
  parseTagValue: false,
  isArray: (name) => ARRAY_ELEMENTS.has(name),
});

/* ---------- lenient scalar coercion ---------- */

function num(v: unknown, fallback = 0): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

/** Crops are sometimes negative ints stored as uint32 (4294967293 = −3). */
function int32(v: unknown): number {
  return num(v) | 0;
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n));
}

/** Shipped files contain Visible="37" and Interpolated="False". */
function looseBool(v: unknown, fallback: boolean): boolean {
  if (v === undefined || v === null) return fallback;
  return String(v).toLowerCase() !== "false";
}

function str(v: unknown): string {
  return v === undefined || v === null ? "" : String(v);
}

/* ---------- frame parsing ---------- */

type RawAttrs = Record<string, unknown>;

function parseTransformFrame(f: RawAttrs): TransformFrame {
  return {
    x: num(f.XPosition),
    y: num(f.YPosition),
    xScale: num(f.XScale, 100),
    yScale: num(f.YScale, 100),
    rotation: num(f.Rotation),
    delay: Math.max(0, num(f.Delay, 1)),
    visible: looseBool(f.Visible, true),
    interpolated: looseBool(f.Interpolated, false),
    tint: {
      r: clamp(num(f.RedTint, 255), 0, 255),
      g: clamp(num(f.GreenTint, 255), 0, 255),
      b: clamp(num(f.BlueTint, 255), 0, 255),
      a: clamp(num(f.AlphaTint, 255), 0, 255),
    },
    offset: {
      r: clamp(num(f.RedOffset), -255, 255),
      g: clamp(num(f.GreenOffset), -255, 255),
      b: clamp(num(f.BlueOffset), -255, 255),
    },
  };
}

function parseLayerFrame(f: RawAttrs): LayerFrame {
  return {
    ...parseTransformFrame(f),
    xCrop: int32(f.XCrop),
    yCrop: int32(f.YCrop),
    width: Math.max(0, num(f.Width)),
    height: Math.max(0, num(f.Height)),
    xPivot: num(f.XPivot),
    yPivot: num(f.YPivot),
  };
}

/* ---------- document parsing ---------- */

function frames(node: RawAttrs | undefined): RawAttrs[] {
  return (node?.Frame as RawAttrs[] | undefined) ?? [];
}

function parseAnimation(a: RawAttrs): Anm2Animation {
  const layerAnims =
    ((a.LayerAnimations as RawAttrs)?.LayerAnimation as RawAttrs[]) ?? [];
  const nullAnims =
    ((a.NullAnimations as RawAttrs)?.NullAnimation as RawAttrs[]) ?? [];
  const triggers = ((a.Triggers as RawAttrs)?.Trigger as RawAttrs[]) ?? [];

  const layers: LayerTrack[] = layerAnims.map((la) => ({
    layerId: num(la.LayerId, -1),
    visible: looseBool(la.Visible, true),
    frames: frames(la).map(parseLayerFrame),
  }));

  const nulls: NullTrack[] = nullAnims.map((na) => ({
    nullId: num(na.NullId, -1),
    visible: looseBool(na.Visible, true),
    frames: frames(na).map(parseTransformFrame),
  }));

  return {
    name: str(a.Name),
    frameNum: Math.max(0, num(a.FrameNum)),
    loop: looseBool(a.Loop, false),
    rootFrames: frames(a.RootAnimation as RawAttrs).map(parseTransformFrame),
    layers,
    nulls,
    triggers: triggers.map((t) => ({
      eventId: num(t.EventId, -1),
      atFrame: Math.max(0, num(t.AtFrame)),
    })),
  };
}

export function parseAnm2(text: string): Anm2 {
  const doc = xml.parse(text) as RawAttrs;
  const actor = (doc.AnimatedActor as RawAttrs) ?? {};
  const info = (actor.Info as RawAttrs) ?? {}; // absent in 18 shipped files
  const content = (actor.Content as RawAttrs) ?? {};
  const animations = (actor.Animations as RawAttrs) ?? {};

  const fpsRaw = num(info.Fps, FPS_DEFAULT);
  const fps =
    fpsRaw >= FPS_MIN && fpsRaw <= FPS_MAX ? fpsRaw : FPS_DEFAULT;

  return {
    info: {
      fps,
      version: num(info.Version),
      createdBy: str(info.CreatedBy),
      createdOn: str(info.CreatedOn),
    },
    content: {
      spritesheets: (
        ((content.Spritesheets as RawAttrs)?.Spritesheet as RawAttrs[]) ?? []
      ).map((s) => ({ id: num(s.Id, -1), rawPath: str(s.Path) })),
      layers: (
        ((content.Layers as RawAttrs)?.Layer as RawAttrs[]) ?? []
      ).map((l) => ({
        id: num(l.Id, -1),
        name: str(l.Name),
        spritesheetId: num(l.SpritesheetId, -1),
        // BlendMode="1" appears exactly once in the game (level 2 willo glow)
        blendMode: num(l.BlendMode) === 1 ? "additive" : "normal",
      })),
      nulls: (((content.Nulls as RawAttrs)?.Null as RawAttrs[]) ?? []).map(
        (n) => ({
          id: num(n.Id, -1),
          name: str(n.Name),
          showRect: looseBool(n.ShowRect, false),
        }),
      ),
      events: (((content.Events as RawAttrs)?.Event as RawAttrs[]) ?? []).map(
        (e) => ({ id: num(e.Id, -1), name: str(e.Name) }),
      ),
    },
    defaultAnimation: str(animations.DefaultAnimation),
    animations: ((animations.Animation as RawAttrs[]) ?? []).map(
      parseAnimation,
    ),
  };
}
