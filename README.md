# Basement Suite

A desktop **Photoshop-for-Isaac** — a multi-layer pixel-art editor and a live `.anm2` animation previewer, side by side. Paint into a sprite layer in one pane, watch the animation re-render in the other, and save straight into a mod folder. Built specifically to make sprite modding for *The Binding of Isaac: Repentance* less painful.

## What it does

**Browse the game by name, not by file path.** A semantic catalog reads the game's own XML (`entities2.xml`, `items.xml`, `players.xml`, `costumes2.xml`) and turns the 8,000+ extracted PNGs and 2,000+ anm2 files into a navigable grid of characters, enemies, items, familiars, pickups, effects, UI, and cutscenes. Rendered hover-animated thumbnails so you can see what something looks like before opening it.

**Live preview while you edit.** Click any sprite to open it in a document tab. The right pane plays the actual animation (with body + head + costume composited the way the game does it). The left pane is the editor. Strokes appear in the preview *during* the gesture, not on save.

**Photoshop-style editor:**
- Multi-layer documents (visible / opacity / lock / rename / reorder by drag), composite is what the game sees
- **Tools:** Move (V), Brush (B), Eraser (E), Eyedropper (I), Fill bucket (G), Rectangle marquee (M), Lasso (L), Magic wand (W), Pan (H)
- **Selections** clip paint, support inside-drag (Photoshop's "move marquee" gesture), Free Transform (Ctrl+T), Cut (Ctrl+X), Delete, Alt+drag to duplicate, Ctrl+D to deselect
- **Free Transform** with corner *and* edge handles — uniform scale on corners, axis-locked on edges
- **Mirror brush** (horizontal / vertical / both) for symmetric sprites
- **Frame strip** under the preview shows every frame of the current animation as a clickable thumbnail; click one to jump the editor's pan to the matching crop rect
- **Layers + History panels** docked beside the canvas (Photoshop layout); every operation lands in the History panel with a label, click any row to jump to that state
- **Merge down** (Ctrl+E), **drag-to-reorder layers**, **per-layer opacity slider** that lands as a single history entry on release

**Mod manager** (separate tab):
- Lists every folder under `modsPath` with parsed `metadata.xml`, version, file count, and a Steam Workshop badge when the mod has a workshop `<id>`
- **Active mod** — one mod at a time receives saves and overlays into the preview so modded sprites appear live
- **Diff viewer** — side-by-side or overlay-slider comparison of any modded file against vanilla
- **New mod** creation, hard-delete with confirm, BBCode-rendered descriptions (including remote images)
- Dirty-state modal stops you closing a tab or switching active mods over unsaved edits

**Mod export:** Ctrl+S in the editor writes the flattened sprite into `<modsPath>/<name>/resources/gfx/<mirrored path>/...` and generates `metadata.xml` on first save. Your game files are never touched.

## Acknowledgments

Massive thanks to **Edmund McMillen, Nicalis, and the entire team behind The Binding of Isaac: Rebirth, Afterbirth, Afterbirth+, Repentance, and Repentance+.** This project exists because the game has thirteen years of incredible art and the existing tools for modifying that art are genuinely difficult to work with. Basement Suite is a labor of love, built specifically to make sprite modding accessible — none of it would exist without the world they made.

This app reads only data the game's own resource extractor produces locally; it does not bundle, redistribute, or modify any of the game's assets.

## Setup

1. **Own *The Binding of Isaac: Repentance* on Steam** (the Repentance / Repentance+ DLC is recommended for the full asset tree).
2. **Run the game's resource extractor once:**
   `<game dir>/tools/ResourceExtractor/ResourceExtractor.exe`
   (may need to run as administrator — it writes to `<game dir>/extracted_resources/`)
3. **Install Node.js 20+** and **Rust** (`rustup`) plus your platform's MSVC / clang toolchain. On Windows, install the *Visual Studio Build Tools* with the *C++ workload*.
4. **Clone and install:**
   ```bash
   git clone https://github.com/laughable-9/basement-suite.git
   cd basement-suite
   npm install
   ```
5. **Create `bs.config.json`** in the repo root (gitignored — paths are machine-local):
   ```json
   {
     "isaacPath": "C:/Program Files (x86)/Steam/steamapps/common/The Binding of Isaac Rebirth",
     "modsPath": "C:/Program Files (x86)/Steam/steamapps/common/The Binding of Isaac Rebirth/mods",
     "extractedResourcesPath": "C:/Program Files (x86)/Steam/steamapps/common/The Binding of Isaac Rebirth/extracted_resources/resources"
   }
   ```
   On macOS / Linux the paths will look different — point them at your Steam library location.
6. **Run in dev mode** (desktop window with hot-reload):
   ```bash
   npm run tauri dev
   ```
   First Rust compile takes a few minutes; subsequent runs are fast.
7. **Build a packaged installer:**
   ```bash
   npm run tauri build
   ```
   The installer/app bundle lands in `src-tauri/target/release/bundle/`.

### Other useful commands

```bash
npm test            # vitest suite (catalog, parser, history, etc.)
npm run build       # tsc type-check + Vite bundle (no Rust)
npm run dev         # Vite only — UI loads in a browser but fs calls fail
```

## Tech

Tauri 2 · React · TypeScript · Vite · Canvas 2D. The Rust side is a thin, capability-scoped file I/O shell (`fs` plugin, `dialog` plugin); everything else is TypeScript. The anm2 parser is pure, lenient by design, and unit-tested against the entire shipped game corpus (2,199 files, every landmine documented in `SCAN_REPORT.md`).

## Asset policy

This repo contains **no game assets**. Spritesheets and `.anm2` files are copyrighted; the app and its tests read them from your local game installation at runtime. The game directory is treated as **strictly read-only** — every write call routes through `lib/fsx/modWrite.ts` and is rejected unless the target lives under `modsPath`.

## Support the project

If Basement Suite has saved you time on a mod and you'd like to throw a tip in the jar:

[![Support on Ko-fi](https://ko-fi.com/img/githubbutton_sm.svg)](https://ko-fi.com/laughable)

## License

[MIT](LICENSE) — covers the code in this repository only, not any game content it reads.
