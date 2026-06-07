// Tiny decode helper for the diff viewer — bypasses the SheetDoc cache on
// purpose so the modded file is read directly from disk (not from any
// cached canvas that might've been mutated in-memory).

import { readFile } from "@tauri-apps/plugin-fs";

export async function decodePng(
  path: string,
): Promise<HTMLCanvasElement | null> {
  try {
    const bytes = await readFile(path);
    const bitmap = await createImageBitmap(
      new Blob([bytes], { type: "image/png" }),
    );
    const canvas = document.createElement("canvas");
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    canvas.getContext("2d")!.drawImage(bitmap, 0, 0);
    bitmap.close();
    return canvas;
  } catch {
    return null;
  }
}
