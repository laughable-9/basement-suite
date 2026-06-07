// Canvas 2D compositor for one tick of an anm2 animation.
// Z-order = LayerTrack array order (declaration order), bottom first.

import type { Anm2, Anm2Animation, Layer, Rgb, Rgba } from "../../lib/anm2/types";
import {
  sampleLayerTrack,
  sampleTransformTrack,
  type ResolvedLayerFrame,
  type ResolvedTransform,
} from "../../lib/anm2/timeline";

// SheetMap lives with the shared sheet docs; re-exported for renderer users.
export type { SheetMap } from "../../lib/sheets/store";
import type { SheetMap } from "../../lib/sheets/store";

const IDENTITY: ResolvedTransform = {
  x: 0, y: 0, xScale: 100, yScale: 100, rotation: 0,
  visible: true,
  tint: { r: 255, g: 255, b: 255, a: 255 },
  offset: { r: 0, g: 0, b: 0 },
};

const DEG = Math.PI / 180;

// Scratch canvas reused for per-frame tinting.
let scratch: HTMLCanvasElement | null = null;

function getScratch(w: number, h: number): CanvasRenderingContext2D {
  scratch ??= document.createElement("canvas");
  if (scratch.width < w) scratch.width = w;
  if (scratch.height < h) scratch.height = h;
  const ctx = scratch.getContext("2d")!;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalCompositeOperation = "source-over";
  ctx.globalAlpha = 1;
  ctx.clearRect(0, 0, w, h);
  return ctx;
}

function isNeutral(tint: Rgba, offset: Rgb): boolean {
  return (
    tint.r === 255 && tint.g === 255 && tint.b === 255 &&
    offset.r === 0 && offset.g === 0 && offset.b === 0
  );
}

/** Multiply RGB tint and add color offset onto the cropped sprite region. */
function tintSprite(
  sheet: HTMLCanvasElement,
  f: ResolvedLayerFrame,
  tint: Rgba,
  offset: Rgb,
): HTMLCanvasElement {
  const ctx = getScratch(f.width, f.height);
  ctx.drawImage(sheet, f.xCrop, f.yCrop, f.width, f.height, 0, 0, f.width, f.height);

  if (tint.r !== 255 || tint.g !== 255 || tint.b !== 255) {
    ctx.globalCompositeOperation = "multiply";
    ctx.fillStyle = `rgb(${tint.r | 0},${tint.g | 0},${tint.b | 0})`;
    ctx.fillRect(0, 0, f.width, f.height);
    // multiply/lighter paint over transparent pixels too — re-mask with the crop's alpha
    ctx.globalCompositeOperation = "destination-in";
    ctx.drawImage(sheet, f.xCrop, f.yCrop, f.width, f.height, 0, 0, f.width, f.height);
  }

  if (offset.r > 0 || offset.g > 0 || offset.b > 0) {
    ctx.globalCompositeOperation = "lighter";
    ctx.fillStyle = `rgb(${Math.max(0, offset.r) | 0},${Math.max(0, offset.g) | 0},${Math.max(0, offset.b) | 0})`;
    ctx.fillRect(0, 0, f.width, f.height);
    ctx.globalCompositeOperation = "destination-in";
    ctx.drawImage(sheet, f.xCrop, f.yCrop, f.width, f.height, 0, 0, f.width, f.height);
  }

  return scratch!;
}

function mulTint(a: Rgba, b: Rgba): Rgba {
  return {
    r: (a.r * b.r) / 255,
    g: (a.g * b.g) / 255,
    b: (a.b * b.b) / 255,
    a: (a.a * b.a) / 255,
  };
}

function addOffset(a: Rgb, b: Rgb): Rgb {
  return { r: a.r + b.r, g: a.g + b.g, b: a.b + b.b };
}

/**
 * Draw animation state at tick t. The ctx must already be transformed so the
 * entity origin is at (0,0) and 1 unit = 1 sprite pixel (zoom applied outside).
 * `opacity` scales every layer's alpha — used for onion-skin ghosts.
 */
export function renderFrame(
  ctx: CanvasRenderingContext2D,
  anm2: Anm2,
  anim: Anm2Animation,
  t: number,
  sheets: SheetMap,
  opacity = 1,
): void {
  const root = sampleTransformTrack(anim.rootFrames, t) ?? IDENTITY;
  if (!root.visible) return;

  const layerById = new Map<number, Layer>(
    anm2.content.layers.map((l) => [l.id, l]),
  );

  for (const track of anim.layers) {
    if (!track.visible) continue;
    const f = sampleLayerTrack(track.frames, t);
    if (!f || !f.visible || f.width <= 0 || f.height <= 0) continue;

    const layer = layerById.get(track.layerId);
    const sheet = layer ? sheets.get(layer.spritesheetId) : undefined;

    ctx.save();
    // Root transform applies to every layer, then the layer frame's own.
    ctx.translate(root.x, root.y);
    ctx.rotate(root.rotation * DEG);
    ctx.scale(root.xScale / 100, root.yScale / 100);
    ctx.translate(f.x, f.y);
    ctx.rotate(f.rotation * DEG);
    ctx.scale(f.xScale / 100, f.yScale / 100);

    const tint = mulTint(root.tint, f.tint);
    const offset = addOffset(root.offset, f.offset);
    ctx.globalAlpha = (tint.a / 255) * opacity;
    if (layer?.blendMode === "additive") {
      ctx.globalCompositeOperation = "lighter";
    }

    if (!sheet) {
      // Missing spritesheet (e.g. raglich): magenta placeholder, don't crash.
      ctx.fillStyle = "rgba(255,0,255,0.6)";
      ctx.fillRect(-f.xPivot, -f.yPivot, f.width, f.height);
    } else if (isNeutral(tint, offset)) {
      ctx.drawImage(
        sheet,
        f.xCrop, f.yCrop, f.width, f.height,
        -f.xPivot, -f.yPivot, f.width, f.height,
      );
    } else {
      const tinted = tintSprite(sheet, f, tint, offset);
      ctx.drawImage(
        tinted,
        0, 0, f.width, f.height,
        -f.xPivot, -f.yPivot, f.width, f.height,
      );
    }
    ctx.restore();
  }
}
