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

## Screenshots

![Editing a character with the live preview running](docs/screenshots/editor.gif)

| Catalog browser | Mod manager |
| --- | --- |
| ![Home / catalog tab](docs/screenshots/home.png) | ![Mods tab](docs/screenshots/mods.png) |

| Color picker | Diff viewer |
| --- | --- |
| ![Photoshop-style color picker](docs/screenshots/color-picker.png) | ![Vanilla vs modded diff viewer](docs/screenshots/diff.png) |

## Acknowledgments

Massive thanks to **Edmund McMillen, Nicalis, and the entire team behind The Binding of Isaac: Rebirth, Afterbirth, Afterbirth+, Repentance, and Repentance+.** This project exists because the game has thirteen years of incredible art and the existing tools for modifying that art are genuinely difficult to work with. Basement Suite is a labor of love, built specifically to make sprite modding accessible — none of it would exist without the world they made.

This app reads only data the game's own resource extractor produces locally; it does not bundle, redistribute, or modify any of the game's assets.

## Setup

### Step 1 — Own *The Binding of Isaac: Repentance* on Steam

Repentance or Repentance+ DLC is recommended for the full asset tree. Basement Suite browses *your* installed game; without it, there is nothing to load.

### Step 2 — Extract the game's resources

Repentance ships with an extractor that unpacks the game's `.a` archives into a real folder structure you (and Basement Suite) can read.

**Windows:**
1. Open Steam → right-click *The Binding of Isaac: Rebirth* → **Manage → Browse local files**.
2. Open `tools\ResourceExtractor\` inside that folder.
3. **Right-click `ResourceExtractor.exe` → Run as administrator** (it writes back into the game directory).
4. Click *Extract resources* and wait — first run takes a couple of minutes.
5. When it's done you should see a new `<game folder>\extracted_resources\resources\` directory with thousands of PNGs and `.anm2` files under `gfx/`. That's the folder Basement Suite reads.

**macOS / Linux:** Steam's *Properties → Installed Files → Browse* takes you to the game folder. The extractor is in the same `tools/ResourceExtractor/` directory and behaves the same way.

### Step 3a — Install the prebuilt release *(recommended for non-developers)*

The fastest way to use Basement Suite is to grab a packaged build from the GitHub [Releases page](https://github.com/laughable-9/basement-suite/releases) once one has been published. Each release attaches:

- **Windows:** `Basement.Suite_<version>_x64_en-US.msi` (standard installer) and `Basement.Suite_<version>_x64-setup.exe` (NSIS installer)
- **macOS:** `Basement.Suite_<version>_x64.dmg` (Intel) and `_aarch64.dmg` (Apple Silicon)
- **Linux:** `basement-suite_<version>_amd64.AppImage` and a `.deb`

Run the installer; on Windows you may need to click *More info → Run anyway* the first time because the installer is currently unsigned.

After it launches, jump to **Step 4 (configure paths)** below. If no release has been published yet, follow **Step 3b** to build from source.

### Step 3b — Build from source *(developers)*

You need three things installed:

1. **Node.js 20 or newer** — `node --version` should report `v20.x` or higher. Get it from [nodejs.org](https://nodejs.org/) or `nvm install 20`.
2. **Rust** via [rustup](https://rustup.rs/) — `rustc --version` should print a stable version (1.75+).
3. **Platform native build tools** so the Rust crate can link:
   - **Windows:** [Visual Studio Build Tools](https://visualstudio.microsoft.com/downloads/?q=build+tools) → tick **"Desktop development with C++"**. The standalone Build Tools installer (no full VS) is enough.
   - **macOS:** `xcode-select --install` (the Command Line Tools — full Xcode not required).
   - **Linux (Debian / Ubuntu):** `sudo apt install libwebkit2gtk-4.1-dev build-essential curl wget file libxdo-dev libssl-dev libayatana-appindicator3-dev librsvg2-dev`
   - Other distros: the Tauri docs at [tauri.app/start/prerequisites](https://tauri.app/start/prerequisites/) list the equivalents.

Then clone and install JS deps:
```bash
git clone https://github.com/laughable-9/basement-suite.git
cd basement-suite
npm install
```

### Step 4 — Create `bs.config.json`

Basement Suite reads three paths from a `bs.config.json` file in the repo root (or, for a packaged install, in the app's working directory). The file is git-ignored on purpose — these paths are machine-local. **Use forward slashes on every platform**, including Windows.

```json
{
  "isaacPath": "C:/Program Files (x86)/Steam/steamapps/common/The Binding of Isaac Rebirth",
  "modsPath": "C:/Program Files (x86)/Steam/steamapps/common/The Binding of Isaac Rebirth/mods",
  "extractedResourcesPath": "C:/Program Files (x86)/Steam/steamapps/common/The Binding of Isaac Rebirth/extracted_resources/resources"
}
```

**Finding your paths:**

| Key | What it points at | Default location |
| --- | --- | --- |
| `isaacPath` | The game install folder (the one with `isaac-ng.exe`) | Steam → *Manage → Browse local files* |
| `modsPath` | The `mods` folder Isaac loads from at launch | `<isaacPath>/mods` on every platform |
| `extractedResourcesPath` | The `resources/` folder **inside** `extracted_resources/` (the one with `gfx/`, `sfx/`, etc.) | `<isaacPath>/extracted_resources/resources` after running the extractor |

Examples for other platforms:

```json
// macOS
{
  "isaacPath":               "/Users/<you>/Library/Application Support/Steam/steamapps/common/The Binding of Isaac Rebirth",
  "modsPath":                "/Users/<you>/Library/Application Support/Steam/steamapps/common/The Binding of Isaac Rebirth/mods",
  "extractedResourcesPath":  "/Users/<you>/Library/Application Support/Steam/steamapps/common/The Binding of Isaac Rebirth/extracted_resources/resources"
}
```

```json
// Linux
{
  "isaacPath":               "/home/<you>/.steam/steam/steamapps/common/The Binding of Isaac Rebirth",
  "modsPath":                "/home/<you>/.steam/steam/steamapps/common/The Binding of Isaac Rebirth/mods",
  "extractedResourcesPath":  "/home/<you>/.steam/steam/steamapps/common/The Binding of Isaac Rebirth/extracted_resources/resources"
}
```

If any of these paths is wrong the app will start but show empty catalogs — open **Settings** (gear icon, top-right) to verify each one is reachable.

### Step 5 — Run

**From a packaged install:** just launch *Basement Suite* from the Start menu / Applications folder / `.AppImage`.

**From source, dev mode (desktop window with HMR):**
```bash
npm run tauri dev
```
The first Rust compile takes several minutes (downloads and compiles ~400 crates). Subsequent runs are seconds. The window opens automatically.

**From source, packaged installer:**
```bash
npm run tauri build
```
The installer / app bundle lands in `src-tauri/target/release/bundle/` (e.g. `bundle/msi/Basement.Suite_0.1.0_x64_en-US.msi` on Windows).

### Other useful commands

```bash
npm test            # vitest suite (catalog, parser, history, etc.) — 93 tests
npm run build       # tsc type-check + Vite bundle (no Rust)
npm run dev         # Vite only — UI loads in a browser but fs calls fail
```

### Troubleshooting

- **"No catalog loaded" / empty Home tab** → `extractedResourcesPath` is wrong, or the extractor hasn't been run. Open Settings, fix the path, *Reload catalog*.
- **"failed to read bs.config.json"** → check the file is in the repo root (source) or beside the executable (packaged), valid JSON, forward slashes.
- **`npm install` fails with `node-gyp` / `MSBuild not found` on Windows** → the C++ workload of Visual Studio Build Tools isn't installed.
- **`tauri dev` hangs at "compiling tao"** → not hung; the first build is slow. Let it run for 5–10 minutes the first time.
- **App launches but characters render as blank silhouettes** → the catalog is loading but spritesheet PNGs aren't being found. Verify `extractedResourcesPath` points at the folder containing `gfx/`, not at the parent.

## Releases

Releases are published automatically by GitHub Actions when a version tag is pushed. The workflow at `.github/workflows/release.yml` runs `npm run tauri build` on Windows, macOS, and Linux runners and attaches the installers to a draft release on the [Releases page](https://github.com/laughable-9/basement-suite/releases).

To cut a new release:

```bash
# 1. Bump the version in both files (must match)
#    - package.json          → "version": "0.2.0"
#    - src-tauri/tauri.conf.json → "version": "0.2.0"
# 2. Commit + push the bump
git add package.json src-tauri/tauri.conf.json
git commit -m "chore(release): v0.2.0"
git push

# 3. Tag the commit and push the tag
git tag v0.2.0
git push origin v0.2.0
```

That tag push fires the workflow. ~10 minutes later a **draft release** appears on GitHub with the MSI / NSIS / DMG / AppImage / .deb attached. Edit the release notes, hit **Publish**, and users can download.

### How version numbers work — *semver in one paragraph*

Basement Suite follows [Semantic Versioning](https://semver.org/): **MAJOR.MINOR.PATCH** (`v0.2.5`).

- **PATCH** (`v0.2.0 → v0.2.1`) — bug fixes only, no new features. Safe to install blindly.
- **MINOR** (`v0.2.5 → v0.3.0`) — new features that don't break anything existing.
- **MAJOR** (`v0.x → v1.0`) — breaking changes (config file format, mod layout, etc.). The `0.x` prefix is the pre-1.0 era — minor versions may still break things. Once it hits `v1.0.0` you're promising stability.

### How software engineers actually decide when to release

You don't tag every commit. The two common cadences:

- **By time** — every 1–2 weeks if there's anything worth shipping, otherwise skip. Predictable and simple.
- **By milestone** — release when a meaningful chunk of work lands (a new tab, a major feature, a batch of fixes that solve a real user pain). This is what most small projects do.

Either way, the rules of thumb:

1. **Never release from a broken `main`.** CI must be green; `npm test` must pass; the app must launch and the golden-path features must work.
2. **Batch fixes.** If you fix three small bugs in a day, release once at the end of the day as `v0.2.1`, not three times.
3. **Use pre-releases for risky stuff.** Tag `v0.3.0-beta.1` for in-progress features; GitHub flags it "Pre-release" so users know it's experimental.
4. **Keep a `CHANGELOG.md`** (or write good release notes in the GitHub release UI). "v0.2.0 — added the lasso tool, fixed the layer reorder undo bug" is more useful to your users than just a tag.
5. **Don't break old configs.** If you change the `bs.config.json` schema, either auto-migrate it or bump the MAJOR version.

For Basement Suite right now (early `0.1.x`), a sensible cadence is: ship a `0.1.x` patch whenever you fix something users would notice, bump to `0.2.0` when a meaningful feature group lands (e.g. shape tools or layer groups), and target `v1.0.0` only when you'd be embarrassed to break the config format.

## Tech

Tauri 2 · React · TypeScript · Vite · Canvas 2D. The Rust side is a thin, capability-scoped file I/O shell (`fs` plugin, `dialog` plugin); everything else is TypeScript. The anm2 parser is pure, lenient by design, and unit-tested against the entire shipped game corpus (2,199 files, every landmine documented in `SCAN_REPORT.md`).

## Asset policy

This repo contains **no game assets**. Spritesheets and `.anm2` files are copyrighted; the app and its tests read them from your local game installation at runtime. The game directory is treated as **strictly read-only** — every write call routes through `lib/fsx/modWrite.ts` and is rejected unless the target lives under `modsPath`.

## Support the project

If Basement Suite has saved you time on a mod and you'd like to throw a tip in the jar:

[![Support on Ko-fi](https://ko-fi.com/img/githubbutton_sm.svg)](https://ko-fi.com/laughable)

## License

[MIT](LICENSE) — covers the code in this repository only, not any game content it reads.
