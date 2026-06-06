// M0 lightweight anm2 inspection: animation names + metadata without the full
// parser (that's M1). Pure string functions — no DOM, no Tauri — so they run
// in plain Node under vitest.
//
// Regexes are attribute-order-agnostic: SCAN_REPORT §3.10 — attribute order
// varies between files, and `<Animation\b` must not match `<Animations`.

export interface Anm2AnimationPeek {
  name: string;
  frameNum: number;
  loop: boolean;
}

export interface Anm2Peek {
  fps: number;
  defaultAnimation: string | null;
  animations: Anm2AnimationPeek[];
  spritesheets: string[];
}

const FPS_MIN = 1;
const FPS_MAX = 120;
const FPS_DEFAULT = 30;

function attr(tag: string, name: string): string | undefined {
  return tag.match(new RegExp(`\\b${name}="([^"]*)"`))?.[1];
}

/** Lenient bool: shipped files contain `Loop="False"` and `Visible="37"`. */
function looseBool(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined) return fallback;
  return value.toLowerCase() !== "false";
}

export function peekAnm2(xml: string): Anm2Peek {
  // 18 shipped files have no <Info> at all; 2 have garbage Fps. Clamp + default.
  const infoTag = xml.match(/<Info\b[^>]*>/)?.[0] ?? "";
  const fpsRaw = Number(attr(infoTag, "Fps"));
  const fps =
    Number.isFinite(fpsRaw) && fpsRaw >= FPS_MIN && fpsRaw <= FPS_MAX
      ? fpsRaw
      : FPS_DEFAULT;

  const animationsTag = xml.match(/<Animations\b[^>]*>/)?.[0] ?? "";
  const defaultAnimation = attr(animationsTag, "DefaultAnimation") ?? null;

  const animations: Anm2AnimationPeek[] = [];
  for (const m of xml.matchAll(/<Animation\b([^>]*)>/g)) {
    animations.push({
      name: attr(m[0], "Name") ?? "",
      frameNum: Number(attr(m[0], "FrameNum")) || 0,
      loop: looseBool(attr(m[0], "Loop"), false),
    });
  }

  const spritesheets: string[] = [];
  for (const m of xml.matchAll(/<Spritesheet\b[^>]*\bPath="([^"]*)"/g)) {
    spritesheets.push(m[1]);
  }

  return { fps, defaultAnimation, animations, spritesheets };
}
