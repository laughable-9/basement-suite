// Frame-strip → editor handshake: when the user clicks frame N in the strip,
// figure out which spritesheet crop rect is drawn at that frame on the
// currently-edited sheet, so the editor can pan to it and highlight it.
// Pure — unit testable in plain Node.

import type { Anm2 } from "../../lib/anm2/types";
import type { CropRect } from "./cropGrid";

/**
 * Active crop on `sheetId` at tick `t` of animation `animName`. Walks the
 * cumulative delays of every layer track that uses that sheet and returns
 * the first matching rect from the supplied list (cropGrid output).
 *
 * Returns null if the animation doesn't exist, the sheet is unused by it,
 * or the active keyframe's rect isn't in the supplied list (shouldn't
 * happen for cropGrid output, but defensive).
 */
export function rectAtFrame(
  anm2: Anm2,
  animName: string,
  sheetId: number,
  t: number,
  rects: CropRect[],
): CropRect | null {
  const anim = anm2.animations.find((a) => a.name === animName);
  if (!anim) return null;
  const layerIds = new Set(
    anm2.content.layers
      .filter((l) => l.spritesheetId === sheetId)
      .map((l) => l.id),
  );
  for (const track of anim.layers) {
    if (!layerIds.has(track.layerId)) continue;
    let cursor = 0;
    for (const f of track.frames) {
      const start = cursor;
      cursor += f.delay;
      if (t < start || t >= cursor) continue;
      if (f.width <= 0 || f.height <= 0) continue;
      return (
        rects.find(
          (r) =>
            r.x === f.xCrop &&
            r.y === f.yCrop &&
            r.w === f.width &&
            r.h === f.height,
        ) ?? null
      );
    }
  }
  return null;
}
