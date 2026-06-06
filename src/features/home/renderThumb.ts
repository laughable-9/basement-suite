// U3 thumbnails: the actual rendered entity — first frame of its default
// animation — not the raw spritesheet. Characters get their skin substituted
// into the shared player anm2 (sheet id 0), so Magdalene's card shows
// Magdalene. Hover playback reuses the same scene.

import type { WorkTab } from "../../app/store";
import { frameBounds } from "../../lib/anm2/bounds";
import { parseAnm2 } from "../../lib/anm2/parse";
import type { Anm2, Anm2Animation } from "../../lib/anm2/types";
import { readText } from "../../lib/fsx/fs";
import { dirname, resolveRelative } from "../../lib/fsx/resolve";
import { getSheetDoc } from "../../lib/sheets/store";
import { renderFrame, type SheetMap } from "../player/render";

export interface ThumbScene {
  anm2: Anm2;
  anim: Anm2Animation;
  /**
   * The player anm2 keeps head and body as SEPARATE animations that the game
   * engine composites (WalkDown = body only, HeadDown = head). Character
   * scenes carry the head animation so cards/icons show a whole person.
   */
  headAnim: Anm2Animation | null;
  sheets: SheetMap;
  fps: number;
  /** Sheet doc paths involved (live-link redraw hooks) */
  sheetPaths: string[];
}

const MAX_THUMB_ZOOM = 3;
const scenes = new Map<string, Promise<ThumbScene | null>>();

async function load(tab: WorkTab): Promise<ThumbScene | null> {
  if (!tab.anm2Path) return null;
  try {
    const anm2 = parseAnm2(await readText(tab.anm2Path));
    const dir = dirname(tab.anm2Path);
    const sheets: SheetMap = new Map();
    const sheetPaths: string[] = [];
    await Promise.all(
      anm2.content.spritesheets.map(async (s) => {
        // Character tabs carry a skin sheet that replaces the player
        // anm2's sheet 0 (all skins share its layout).
        const path =
          tab.sheetPath && s.id === 0
            ? tab.sheetPath
            : resolveRelative(dir, s.rawPath);
        try {
          sheets.set(s.id, (await getSheetDoc(path)).canvas);
          sheetPaths.push(path);
        } catch {
          sheets.set(s.id, null);
        }
      }),
    );
    const anim =
      anm2.animations.find((a) => a.name === anm2.defaultAnimation) ??
      anm2.animations[0];
    if (!anim || anim.frameNum <= 0) return null;

    // Characters (skin override present): pair the body anim with its head.
    const headAnim = tab.sheetPath
      ? (anm2.animations.find(
          (a) => a.name === anim.name.replace(/^Walk/, "Head"),
        ) ?? null)
      : null;

    if (!frameBounds(anim, 0)) return null; // fully invisible first frame
    return { anm2, anim, headAnim, sheets, fps: anm2.info.fps, sheetPaths };
  } catch {
    return null;
  }
}

export function thumbScene(tab: WorkTab): Promise<ThumbScene | null> {
  let p = scenes.get(tab.id);
  if (!p) {
    p = load(tab);
    scenes.set(tab.id, p);
  }
  return p;
}

function union(
  a: ReturnType<typeof frameBounds>,
  b: ReturnType<typeof frameBounds>,
) {
  if (!a) return b;
  if (!b) return a;
  return {
    minX: Math.min(a.minX, b.minX),
    minY: Math.min(a.minY, b.minY),
    maxX: Math.max(a.maxX, b.maxX),
    maxY: Math.max(a.maxY, b.maxY),
  };
}

/**
 * Draw the scene at tick t, auto-fit and centered. The camera is locked to
 * `fitTick` (default frame 0) so hover playback doesn't jitter.
 */
export function drawThumb(
  canvas: HTMLCanvasElement,
  scene: ThumbScene,
  t: number,
  fitTick = 0,
): void {
  const ctx = canvas.getContext("2d")!;
  const { width: w, height: h } = canvas;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, w, h);
  ctx.imageSmoothingEnabled = false;

  const bounds = union(
    frameBounds(scene.anim, fitTick),
    scene.headAnim && frameBounds(scene.headAnim, 0),
  );
  if (!bounds) return;
  const bw = Math.max(1, bounds.maxX - bounds.minX);
  const bh = Math.max(1, bounds.maxY - bounds.minY);
  const scale = Math.min(MAX_THUMB_ZOOM, (w - 8) / bw, (h - 8) / bh);
  const cx = (bounds.minX + bounds.maxX) / 2;
  const cy = (bounds.minY + bounds.maxY) / 2;

  ctx.translate(w / 2 - cx * scale, h / 2 - cy * scale);
  ctx.scale(scale, scale);
  renderFrame(ctx, scene.anm2, scene.anim, t, scene.sheets);
  if (scene.headAnim) {
    renderFrame(
      ctx,
      scene.anm2,
      scene.headAnim,
      t % Math.max(1, scene.headAnim.frameNum),
      scene.sheets,
    );
  }
}
