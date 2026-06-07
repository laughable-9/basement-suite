// App branding from public/icon.png (user-provided): window/taskbar icon at
// runtime + the app-bar logo. Falls back to the BS chip if missing.

import { Image } from "@tauri-apps/api/image";
import { getCurrentWindow } from "@tauri-apps/api/window";

const ICON_SIZE = 64;

export async function applyIsaacBranding(): Promise<string | null> {
  try {
    const res = await fetch("/icon.png");
    if (!res.ok) return null;
    const bitmap = await createImageBitmap(await res.blob());

    const canvas = document.createElement("canvas");
    canvas.width = ICON_SIZE;
    canvas.height = ICON_SIZE;
    const ctx = canvas.getContext("2d")!;
    ctx.imageSmoothingEnabled = false;
    const scale = Math.min(ICON_SIZE / bitmap.width, ICON_SIZE / bitmap.height);
    const w = bitmap.width * scale;
    const h = bitmap.height * scale;
    ctx.drawImage(bitmap, (ICON_SIZE - w) / 2, (ICON_SIZE - h) / 2, w, h);
    bitmap.close();

    try {
      const rgba = ctx.getImageData(0, 0, ICON_SIZE, ICON_SIZE).data;
      const icon = await Image.new(Array.from(rgba), ICON_SIZE, ICON_SIZE);
      await getCurrentWindow().setIcon(icon);
    } catch {
      // Icon permission missing or platform refusal — logo still applies.
    }
    return "/icon.png";
  } catch {
    return null;
  }
}
