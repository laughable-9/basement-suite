# Basement Suite

A desktop app for modding **The Binding of Isaac: Repentance** sprites: a pixel art editor and a live `.anm2` animation previewer, side by side. Edit a spritesheet in one pane and watch the in-game animation update in the other, then save straight into a mod folder.

> **Status:** MVP complete (M0–M4) — the full loop works: browse → play → edit → live preview → save to mod → verified in-game. See [`PLAN.md`](PLAN.md) for the roadmap and [`SCAN_REPORT.md`](SCAN_REPORT.md) for the reverse-engineered anm2 schema notes.

## Features (v1)

- **Asset browser** — browse the game's extracted `gfx/` tree with PNG thumbnails and anm2 detection
- **Animation player** — plays any animation from any anm2: layers, crops, pivots, scale, rotation, tints, per-frame delays, interpolation; play/pause/scrub, onion skin
- **Pixel editor** — Photoshop-style tool rail, zoomable canvas (1×–32×), pencil/eraser/eyedropper/pan, brush sizing with `[` `]`, color + opacity + recent swatches + sheet palette extraction, undo/redo, and a labeled crop-grid overlay generated from the anm2 (click a rect to jump the player to that frame)
- **Floating paste** — Ctrl+V any image, move/scale it, Enter stamps it pixelized into the sheet
- **Live link** — edits re-render in the animation pane immediately, even mid-playback
- **Mod export** — Ctrl+S writes the edited PNG into the mirrored path under `mods/<name>/resources/gfx/...` and generates `metadata.xml` on first save; session restores on relaunch

Out of scope for v1 (future): editing anm2 keyframes, creating animations, full layer system, audio, room editing.

## Tech

Tauri 2 · React · TypeScript · Vite · Canvas 2D. The Rust side is a thin, capability-scoped file IO shell; everything else is TypeScript.

## Setup

1. Own The Binding of Isaac: Repentance (Steam) with the Repentance/Repentance+ DLC.
2. Run the game's resource extractor once:
   `<game dir>/tools/ResourceExtractor/ResourceExtractor.exe`
   (may need to run as administrator — it writes to `<game dir>/extracted_resources/`)
3. Create `bs.config.json` in the repo root (it is gitignored — paths are machine-local):

```json
{
  "isaacPath": "C:/Program Files (x86)/Steam/steamapps/common/The Binding of Isaac Rebirth",
  "modsPath": "C:/Program Files (x86)/Steam/steamapps/common/The Binding of Isaac Rebirth/mods",
  "extractedResourcesPath": "C:/Program Files (x86)/Steam/steamapps/common/The Binding of Isaac Rebirth/extracted_resources/resources"
}
```

Build/run instructions will land with the first scaffold milestone (M0).

## Asset policy

This repo contains **no game assets**. Spritesheets and `.anm2` files are copyrighted; the app and its tests read them from your local game installation at runtime. The game directory is treated as strictly read-only — the app only ever writes inside your `mods/` folder.

## License

[MIT](LICENSE) — covers the code in this repository only, not any game content it reads.
