// U3 thumbnails: the actual rendered entity — first frame of its default
// animation — not the raw spritesheet. Characters get their skin substituted
// into the shared player anm2 (sheet id 0), so Magdalene's card shows
// Magdalene. Hover playback reuses the same scene.

import type { WorkTab } from "../../app/store";
import { frameBounds } from "../../lib/anm2/bounds";
import { headAnimFor } from "../../lib/anm2/compose";
import { parseAnm2 } from "../../lib/anm2/parse";
import type { Anm2, Anm2Animation } from "../../lib/anm2/types";
import { readText } from "../../lib/fsx/fs";
import { loadAnm2Sheets, type SheetMap } from "../../lib/sheets/store";
import { renderFrame } from "../player/render";

/** A costume overlay (hair/wings/fez) with its state animations matched. */
export interface CostumePart {
  anm2: Anm2;
  sheets: SheetMap;
  /** Costume animation matching the body state (Azazel's wings ride WalkDown) */
  bodyAnim: Anm2Animation | null;
  /** Costume animation matching the head state (Maggy's hair rides HeadDown) */
  headAnim: Anm2Animation | null;
}

export interface ThumbScene {
  anm2: Anm2;
  anim: Anm2Animation;
  /**
   * The player anm2 keeps head and body as SEPARATE animations that the game
   * engine composites (WalkDown = body only, HeadDown = head). Character
   * scenes carry the head animation so cards/icons show a whole person.
   */
  headAnim: Anm2Animation | null;
  costume: CostumePart | null;
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
    const main = await loadAnm2Sheets(anm2, tab.anm2Path, tab.sheetPath);
    const sheetPaths = [...main.paths];
    const anim =
      anm2.animations.find((a) => a.name === anm2.defaultAnimation) ??
      anm2.animations[0];
    if (!anim || anim.frameNum <= 0) return null;

    // Characters (skin override present): pair the body anim with its head.
    const headAnim = tab.sheetPath ? headAnimFor(anm2, anim) : null;

    // Signature costume (hair/wings): same state names, separate anm2.
    let costume: CostumePart | null = null;
    if (tab.costumeAnm2Path) {
      try {
        const cAnm2 = parseAnm2(await readText(tab.costumeAnm2Path));
        const cLoaded = await loadAnm2Sheets(cAnm2, tab.costumeAnm2Path);
        sheetPaths.push(...cLoaded.paths);
        costume = {
          anm2: cAnm2,
          sheets: cLoaded.sheets,
          bodyAnim:
            cAnm2.animations.find((a) => a.name === anim.name) ?? null,
          headAnim: headAnim
            ? (cAnm2.animations.find((a) => a.name === headAnim.name) ?? null)
            : null,
        };
      } catch {
        // costume is decoration — never block the scene
      }
    }

    if (!frameBounds(anim, 0)) return null; // fully invisible first frame
    return {
      anm2,
      anim,
      headAnim,
      costume,
      sheets: main.sheets,
      fps: anm2.info.fps,
      sheetPaths,
    };
  } catch {
    return null;
  }
}

/** Cache key covers everything that affects the render — a tab whose skin or
 *  costume resolution changes (e.g. catalog fixes) must not reuse old scenes. */
function sceneKey(tab: WorkTab): string {
  return `${tab.anm2Path}|${tab.sheetPath ?? ""}|${tab.costumeAnm2Path ?? ""}`;
}

export function thumbScene(tab: WorkTab): Promise<ThumbScene | null> {
  const key = sceneKey(tab);
  let p = scenes.get(key);
  if (!p) {
    p = load(tab);
    scenes.set(key, p);
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

  const at = (anim: Anm2Animation) => t % Math.max(1, anim.frameNum);
  const { costume } = scene;
  // Engine-ish ordering: costume body parts (wings) behind the body,
  // costume head parts (hair/fez) over the head.
  if (costume?.bodyAnim) {
    renderFrame(ctx, costume.anm2, costume.bodyAnim, at(costume.bodyAnim), costume.sheets);
  }
  renderFrame(ctx, scene.anm2, scene.anim, t, scene.sheets);
  if (scene.headAnim) {
    renderFrame(ctx, scene.anm2, scene.headAnim, at(scene.headAnim), scene.sheets);
  }
  if (costume?.headAnim) {
    renderFrame(ctx, costume.anm2, costume.headAnim, at(costume.headAnim), costume.sheets);
  }
}
