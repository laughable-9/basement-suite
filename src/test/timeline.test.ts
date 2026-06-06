import { describe, expect, it } from "vitest";
import {
  normalizeTime,
  sampleLayerTrack,
  sampleTransformTrack,
} from "../lib/anm2/timeline";
import type { LayerFrame, TransformFrame } from "../lib/anm2/types";

const WHITE = { r: 255, g: 255, b: 255, a: 255 };
const NO_OFFSET = { r: 0, g: 0, b: 0 };

function tf(partial: Partial<TransformFrame>): TransformFrame {
  return {
    x: 0, y: 0, xScale: 100, yScale: 100, rotation: 0,
    delay: 1, visible: true, interpolated: false,
    tint: WHITE, offset: NO_OFFSET,
    ...partial,
  };
}

function lf(partial: Partial<LayerFrame>): LayerFrame {
  return {
    ...tf({}),
    xCrop: 0, yCrop: 0, width: 32, height: 32, xPivot: 16, yPivot: 16,
    ...partial,
  };
}

describe("sampleTransformTrack", () => {
  it("walks cumulative delays", () => {
    const frames = [tf({ x: 0, delay: 2 }), tf({ x: 10, delay: 2 }), tf({ x: 20, delay: 2 })];
    expect(sampleTransformTrack(frames, 0)!.x).toBe(0);
    expect(sampleTransformTrack(frames, 1.99)!.x).toBe(0);
    expect(sampleTransformTrack(frames, 2)!.x).toBe(10);
    expect(sampleTransformTrack(frames, 4)!.x).toBe(20);
  });

  it("holds the last keyframe past the end of the track", () => {
    const frames = [tf({ x: 5, delay: 1 })];
    expect(sampleTransformTrack(frames, 99)!.x).toBe(5);
  });

  it("returns null for empty tracks", () => {
    expect(sampleTransformTrack([], 0)).toBeNull();
  });

  it("lerps interpolated keyframes toward the next", () => {
    const frames = [
      tf({ x: 0, rotation: 0, interpolated: true, delay: 4 }),
      tf({ x: 100, rotation: 90, delay: 1 }),
    ];
    const mid = sampleTransformTrack(frames, 2)!;
    expect(mid.x).toBe(50);
    expect(mid.rotation).toBe(45);
  });

  it("does not lerp when interpolated=false", () => {
    const frames = [tf({ x: 0, delay: 4 }), tf({ x: 100, delay: 1 })];
    expect(sampleTransformTrack(frames, 3.9)!.x).toBe(0);
  });

  it("does not lerp the final keyframe (no next)", () => {
    const frames = [tf({ x: 0, interpolated: true, delay: 4 })];
    expect(sampleTransformTrack(frames, 2)!.x).toBe(0);
  });

  it("skips Delay=0 keyframes", () => {
    const frames = [tf({ x: 1, delay: 0 }), tf({ x: 2, delay: 2 })];
    expect(sampleTransformTrack(frames, 0)!.x).toBe(2);
  });
});

describe("sampleLayerTrack", () => {
  it("never interpolates crop/pivot (frame swaps, not tweens)", () => {
    const frames = [
      lf({ xCrop: 0, interpolated: true, delay: 2 }),
      lf({ xCrop: 32, delay: 2 }),
    ];
    expect(sampleLayerTrack(frames, 1)!.xCrop).toBe(0);
    expect(sampleLayerTrack(frames, 2)!.xCrop).toBe(32);
  });
});

describe("normalizeTime", () => {
  it("wraps when looping", () => {
    expect(normalizeTime(17, 16, true)).toBe(1);
    expect(normalizeTime(16, 16, true)).toBe(0);
  });

  it("clamps just inside the end when not looping", () => {
    expect(normalizeTime(99, 16, false)).toBeLessThan(16);
    expect(normalizeTime(99, 16, false)).toBeGreaterThan(15.9);
  });

  it("returns 0 for FrameNum=0 (the 'Empty' animation)", () => {
    expect(normalizeTime(5, 0, true)).toBe(0);
  });
});
