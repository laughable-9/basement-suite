import { describe, expect, it } from "vitest";
import { paletteFromPixels } from "../features/editor/palette";

function px(...pixels: [number, number, number, number][]): Uint8ClampedArray {
  return new Uint8ClampedArray(pixels.flat());
}

describe("paletteFromPixels", () => {
  it("orders by frequency and dedupes", () => {
    const data = px(
      [255, 0, 0, 255],
      [255, 0, 0, 255],
      [255, 0, 0, 255],
      [0, 255, 0, 255],
      [0, 255, 0, 255],
      [0, 0, 255, 128],
    );
    expect(paletteFromPixels(data, 32)).toEqual([
      { r: 255, g: 0, b: 0, a: 255 },
      { r: 0, g: 255, b: 0, a: 255 },
      { r: 0, g: 0, b: 255, a: 128 },
    ]);
  });

  it("ignores fully transparent pixels", () => {
    const data = px([10, 20, 30, 0], [40, 50, 60, 255]);
    expect(paletteFromPixels(data, 32)).toEqual([
      { r: 40, g: 50, b: 60, a: 255 },
    ]);
  });

  it("caps at max", () => {
    const many: [number, number, number, number][] = [];
    for (let i = 0; i < 100; i++) many.push([i, 0, 0, 255]);
    expect(paletteFromPixels(px(...many), 8)).toHaveLength(8);
  });

  it("treats same RGB at different alpha as distinct colors", () => {
    const data = px([9, 9, 9, 255], [9, 9, 9, 100]);
    expect(paletteFromPixels(data, 32)).toHaveLength(2);
  });
});
