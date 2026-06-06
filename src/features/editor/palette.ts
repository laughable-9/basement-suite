// Palette extraction: most-frequent distinct colors in a sheet.
// Counting is pure (testable in Node); the canvas read is the thin wrapper.

import type { Rgba } from "../../lib/anm2/types";
import type { SheetDoc } from "../../lib/sheets/store";

export function paletteFromPixels(
  data: Uint8ClampedArray,
  max: number,
): Rgba[] {
  const counts = new Map<number, number>();
  for (let i = 0; i < data.length; i += 4) {
    const a = data[i + 3];
    if (a === 0) continue; // fully transparent isn't a "color"
    const key =
      data[i] * 0x1000000 + data[i + 1] * 0x10000 + data[i + 2] * 0x100 + a;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, max)
    .map(([key]) => ({
      r: Math.floor(key / 0x1000000) & 255,
      g: Math.floor(key / 0x10000) & 255,
      b: Math.floor(key / 0x100) & 255,
      a: key & 255,
    }));
}

export function extractPalette(doc: SheetDoc, max = 32): Rgba[] {
  const { data } = doc.ctx.getImageData(
    0,
    0,
    doc.canvas.width,
    doc.canvas.height,
  );
  return paletteFromPixels(data, max);
}
