# Basement Suite — Architecture Plan

Companion to `SCAN_REPORT.md`. Status: awaiting approval; no scaffolding done.

## 1. Stack: Tauri 2 + React 18 + TypeScript + Vite

Recommended as specified, and the scan supports it:

- **All rendering/parsing lives in TS.** The anm2 corpus parses cleanly with `DOMParser` (zero XML errors in 2,199 files), PNGs decode via `createImageBitmap`, and playback is plain Canvas 2D. Nothing here needs native code.
- **Rust surface stays minimal**: filesystem commands only (read file/dir, write file, watch). Tauri's `plugin-fs` + `plugin-dialog` cover most of it with zero custom Rust; we add 2–3 tiny commands where the plugin API is awkward (recursive dir listing with filters, atomic write).
- **Why not Electron:** the only Electron advantage here would be Node's `fs` in-process and a marginally simpler dev story. Costs: ~10× bundle size, slower startup, and no benefit since we don't need Node-native modules — image work happens in the renderer either way. Not worth it for a single-window desktop tool. (If we later need headless CLI export, that's a Node script reusing the parser package, not a reason to pick Electron.)

One Tauri-specific consideration: the webview cannot `fetch()` arbitrary disk paths. We read PNGs as bytes over the IPC bridge (`readFile` → `Blob` → `createImageBitmap`). Fine at the observed sizes (94% of sheets ≤512×512, worst case 2640×1620 ≈ 17 MB decoded).

## 2. Repo structure

```
basement-suite/
├── bs.config.json              # gitignored (machine-local paths)
├── SCAN_REPORT.md / PLAN.md
├── assets-cache/               # gitignored; optional copies for manual testing
├── src-tauri/                  # Rust shell (minimal)
│   ├── src/main.rs             # tauri builder + fs commands
│   └── capabilities/           # fs scope: extractedResourcesPath RO, modsPath RW
├── src/
│   ├── app/                    # shell, panes layout, global state (zustand)
│   ├── lib/
│   │   ├── anm2/               # ← pure TS, no Tauri imports (unit-testable in Node)
│   │   │   ├── parse.ts        # XML → Anm2 (lenient, clamping)
│   │   │   ├── timeline.ts     # tick → resolved frame (delay walk + lerp)
│   │   │   └── types.ts        # data model (§6)
│   │   ├── fsx/                # Tauri fs wrappers + ordered-overlay path resolver
│   │   └── png/                # decode, ImageBitmap cache, dirty-region updates
│   ├── features/
│   │   ├── browser/            # asset tree, thumbnails, anm2 badges
│   │   ├── player/             # canvas renderer, transport controls
│   │   ├── editor/             # pixel editor canvas, tools, palette, undo
│   │   └── export/             # mod writer, metadata.xml generator
│   └── test/
│       ├── fixtures.ts         # loads real files from extractedResourcesPath at test time
│       └── *.test.ts           # vitest
└── package.json
```

Key boundary: `src/lib/anm2` is pure (string in, data out) so the parser test suite runs in plain vitest/Node with no Tauri runtime.

## 3. Core data flow

```
extractedResourcesPath (RO)          modsPath (RW)
        │                                ▲
        ▼                                │ M3: Save to mod
  PathResolver (overlay: mod → extracted; normalizes \ / case)
        │
        ▼
  Anm2Store (parsed anm2) ──► PlayerPane (canvas, rAF clock)
        │                          ▲
        ▼                          │ ImageBitmap refresh (live link)
  SheetStore (decoded PNG + edit buffer)
        ▲
        │ pencil/eraser strokes, undo stack
  EditorPane (zoomed canvas + anm2 crop-grid overlay)
```

The live link is in-memory: editor and player share the same `SheetStore` entry; a stroke commits to the edit buffer, invalidates the `ImageBitmap`, and the player redraws next frame. No file round-trip until "Save to mod".

## 4. Features → milestones

### M0 — Scaffold + config + asset browser
- Tauri 2 + React + Vite scaffold; fs capability scoped to the two config paths.
- Load `bs.config.json`; friendly error states for missing config / missing `extracted_resources` (with the "run ResourceExtractor.exe" hint, since we hit this ourselves).
- Asset browser: lazy tree of `gfx/`, PNG thumbnails (virtualized list — characters/ alone has 3,326 PNGs), anm2 entries with animation-count badge.
- **Accept:** app launches; browsing to `gfx/familiar/` shows thumbnails; clicking `003.022_little c.h.a.d..anm2` shows its 3 animation names; pointing config at a bogus path shows the actionable error, not a crash.

### M1 — anm2 parser + playback renderer
- Parser per SCAN_REPORT §2 with all §3 landmine handling (FPS clamp/default, uint32 crop wrap, lenient bools, tint clamp, missing sheets → magenta placeholder).
- Timeline evaluator: tick → per-track resolved frame (delay walk, optional lerp of pos/scale/rot/tint).
- Canvas player: composites RootAnimation transform × layer frames in per-animation LayerAnimation order; honors crop, pivot, %scale, mirror (negative scale), rotation, tint multiply, color offset, visibility. Play/pause/scrub/loop, animation dropdown, FPS display, frame counter.
- **Accept:** Little C.H.A.D. `FloatDown` plays its 16-tick bobbing loop with interpolated squash; Incubus `FloatDown` shows wings split behind/in front of body (z-order proof); Gaper `WalkHori` composites body+head from two different sheets; `919.000_raglich.anm2` loads with placeholder instead of crashing; `cutscenes/intro.anm2` (4,522 frames) scrubs without jank.

### M2 — Pixel editor
- Zoomable canvas 1×–32× (device-pixel-snapped), pan; pencil, eraser, eyedropper; color palette (recent + picker, alpha); undo/redo (stroke-grained, ≥100 deep).
- Crop-grid overlay from the loaded anm2: every unique layer-frame crop rect drawn + labeled `AnimName[i]`; toggleable; click a rect in the overlay → player jumps to that animation/frame.
- **Accept:** open Little C.H.A.D.'s sheet (96×64 region usage), draw at 16×, undo restores exactly; overlay shows FloatDown/Spawn rects labeled; eyedropper picks the alpha-0 background correctly.

### M3 — Live link + mod export
- Editor strokes invalidate the shared sheet → player re-composites next rAF (target <16 ms; dirty-rect ImageBitmap update if full re-upload is slow at 2048×).
- "Save to mod": pick/create mod name → writes edited PNG to `modsPath/<mod>/resources/gfx/<mirrored path>` (path mirror computed from the sheet's resolved source), generates `metadata.xml` on first save, never touches `{isaacPath}` outside `modsPath`. Overlay resolver now prefers the mod tree, so reopening shows the modded file.
- **Accept:** recolor C.H.A.D. while FloatDown plays — pane updates live; Save creates `mods/<name>/resources/gfx/familiar/familiar_spawners_03_littlechad.png` + valid metadata.xml; launching the game shows the edit in-run; second save doesn't duplicate metadata.
- Manual in-game verification is the user's step; the app verifies by re-reading the written files.

### M4 — Polish
- Onion skin (prev/next frame ghosts), palette extraction from sheet, recent files, keyboard shortcuts, dark UI, error toasts, per-animation export of crop rects as PNG slices.
- **Accept:** onion skin toggles on FloatDown; "extract palette" lists the sheet's distinct colors; reopening the app restores last session.

## 5. Non-goals for v1 (future scope)
- Editing anm2 keyframes / creating animations (future: full anm2 editor — the parser's data model is already designed to round-trip)
- Audio (Triggers/Events are parsed and shown as timeline markers but not played)
- Room/level editing; entities2.xml editing; Workshop upload; localized resource variants.

## 6. Data model (TypeScript)

```ts
// lib/anm2/types.ts — mirrors on-disk schema (SCAN_REPORT §2), post-clamping

export interface Anm2 {
  /** Path of the .anm2 itself, relative to gfx/ root (resolver key) */
  sourcePath: string;
  info: { fps: number; version: number; createdBy: string; createdOn: string };
  content: {
    spritesheets: Spritesheet[];   // indexed by id (sparse-safe: Map if gaps seen)
    layers: Layer[];
    nulls: NullDef[];
    events: EventDef[];
  };
  defaultAnimation: string;
  animations: Anm2Animation[];
}

export interface Spritesheet {
  id: number;
  /** Raw path as written in XML (mixed case/separators) */
  rawPath: string;
  /** Normalized, resolved relative to the anm2's dir; null if missing on disk */
  resolvedPath: string | null;
}

export interface Layer  { id: number; name: string; spritesheetId: number; blendMode: 'normal' | 'additive' }
export interface NullDef   { id: number; name: string; showRect: boolean }
export interface EventDef  { id: number; name: string }

export interface Anm2Animation {
  name: string;
  frameNum: number;              // timeline length in ticks; 0 is legal
  loop: boolean;
  rootFrames: TransformFrame[];  // RootAnimation track
  layers: LayerTrack[];          // IN DECLARATION ORDER = z-order, bottom first
  nulls: NullTrack[];
  triggers: { eventId: number; atFrame: number }[];
}

export interface LayerTrack { layerId: number; visible: boolean; frames: LayerFrame[] }
export interface NullTrack  { nullId: number; visible: boolean; frames: TransformFrame[] }

/** Root/Null keyframe — transform + tint only */
export interface TransformFrame {
  x: number; y: number;
  xScale: number; yScale: number;     // percent; 100 = 1×; negative = mirror
  rotation: number;                   // degrees
  delay: number;                      // ticks (≥0; 0 observed in game data)
  visible: boolean;
  interpolated: boolean;
  tint: Rgba;                         // 0–255 multipliers (clamped at parse)
  offset: Rgb;                        // −255–255 additive (clamped at parse)
}

/** Layer keyframe — adds source rect + pivot */
export interface LayerFrame extends TransformFrame {
  xCrop: number; yCrop: number;       // int32-wrapped at parse (4294967293 → −3)
  width: number; height: number;
  xPivot: number; yPivot: number;
}

export type Rgba = { r: number; g: number; b: number; a: number };
export type Rgb  = { r: number; g: number; b: number };

// timeline.ts
/** Resolve a track to its state at tick t: locate keyframe by cumulative delay,
 *  lerp toward next iff interpolated && a next frame exists. */
export function sampleTrack(frames: TransformFrame[], t: number): ResolvedFrame | null;
```

Parser contracts (each is a unit test backed by a real file): clamp fps to [1,120] default 30 (`giantbook_mama_mega`), default missing `<Info>` (`hudstats2`), int32-wrap crops, `Visible="37"` → true, `Interpolated="False"` → false, tints clamped, `FrameNum=0` yields empty render, unknown attrs ignored but warned.

## 7. Test strategy

- **Vitest** on `lib/anm2` + `lib/fsx` (pure TS).
- **Fixture loader, no committed assets:** `test/fixtures.ts` reads `bs.config.json` and loads real files from `extractedResourcesPath` at test time. If the path is missing (CI), those suites `describe.skipIf` with a notice — schema tests run on dev machines, pure-logic tests (timeline math, clamping with synthetic XML strings) run everywhere.
- Golden suite over the 5 sampled files asserting parsed shape (counts, names, fps, z-orders from SCAN_REPORT §2.5).
- Corpus smoke test (dev-only, ~seconds): parse all 2,199 anm2 — zero throws allowed.
- Renderer: deterministic `sampleTrack` unit tests (delay walk, lerp midpoints, loop wrap); visual correctness stays manual via milestone acceptance criteria.

## 8. Risks / open questions

1. **metadata.xml shape unverified** — 0 mods installed locally. M3 acceptance includes an in-game check; format is well-documented community knowledge, low risk.
2. **Tint/offset exact blend math** — multiply + add is the standard reading; verify visually against in-game rendering in M1 (e.g. ghost layer alpha on `001.000_player.anm2`).
3. **Delay=0 semantics** — assumed zero-duration (skip); verify against in-game behavior if a visible case is found.
4. **Performance of live link at 2048×2048** — fallback to dirty-rect `ImageBitmap` patching is designed in but only built if needed.
5. **Interpolation easing** — assumed linear; community docs agree; spot-check one rotation tween in-game.
