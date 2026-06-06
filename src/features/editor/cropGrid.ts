// Crop-grid extraction (PLAN M2): every unique source rect a given
// spritesheet contributes to an anm2, labeled by first use "AnimName[i]".
// Pure — unit-tested in Node.

import type { Anm2 } from "../../lib/anm2/types";

export interface CropRect {
  x: number;
  y: number;
  w: number;
  h: number;
  /** First animation+frame using this rect, e.g. "FloatDown[0]" */
  label: string;
  animName: string;
  /** Tick where that frame starts (player jump target) */
  atTick: number;
}

export function cropGrid(anm2: Anm2, sheetId: number): CropRect[] {
  const layerIds = new Set(
    anm2.content.layers
      .filter((l) => l.spritesheetId === sheetId)
      .map((l) => l.id),
  );
  const seen = new Map<string, CropRect>();

  for (const anim of anm2.animations) {
    for (const track of anim.layers) {
      if (!layerIds.has(track.layerId)) continue;
      let tick = 0;
      for (let i = 0; i < track.frames.length; i++) {
        const f = track.frames[i];
        const startTick = tick;
        tick += f.delay;
        if (f.width <= 0 || f.height <= 0) continue;
        const key = `${f.xCrop},${f.yCrop},${f.width},${f.height}`;
        if (seen.has(key)) continue;
        seen.set(key, {
          x: f.xCrop,
          y: f.yCrop,
          w: f.width,
          h: f.height,
          label: `${anim.name}[${i}]`,
          animName: anim.name,
          atTick: startTick,
        });
      }
    }
  }
  return [...seen.values()];
}
