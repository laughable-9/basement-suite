// Runtime branding: render Isaac's "Happy" (thumbs-up) frame from the user's
// own extracted game files and use it as window icon + app-bar logo.
// Deliberately NOT a committed asset — the repo ships no game art; on a
// machine without the game this silently falls back to the BS chip.

import { Image } from "@tauri-apps/api/image";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { drawThumb, thumbScene } from "../home/renderThumb";

const ICON_SIZE = 64;

export async function applyIsaacBranding(
  gfxRoot: string,
): Promise<string | null> {
  try {
    const scene = await thumbScene({
      id: "__branding",
      title: "",
      anm2Path: `${gfxRoot}/001.000_player.anm2`,
      sheetPath: null,
    });
    if (!scene) return null;

    const happy = scene.anm2.animations.find((a) => a.name === "Happy");
    const branded = happy ? { ...scene, anim: happy } : scene;
    const canvas = document.createElement("canvas");
    canvas.width = ICON_SIZE;
    canvas.height = ICON_SIZE;
    // Mid-animation is where the thumb is fully up.
    drawThumb(canvas, branded, Math.floor(branded.anim.frameNum / 2));

    try {
      const rgba = canvas
        .getContext("2d")!
        .getImageData(0, 0, ICON_SIZE, ICON_SIZE).data;
      const icon = await Image.new(Array.from(rgba), ICON_SIZE, ICON_SIZE);
      await getCurrentWindow().setIcon(icon);
    } catch {
      // Icon permission missing or platform refusal — logo still applies.
    }
    return canvas.toDataURL();
  } catch {
    return null;
  }
}
