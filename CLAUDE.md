# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Basement Suite: a desktop app (Tauri 2 + React + TypeScript + Vite) combining a pixel art editor with a live `.anm2` animation previewer for modding The Binding of Isaac: Repentance. Edit a spritesheet in one pane, watch the animation re-render live in the other, save into a mod folder.

**Current status: v0.1.0 published** on the Releases page (Windows MSI + NSIS). Semantic catalog browser, document tabs with per-tab editor/player state, rendered thumbnails, character compositing (skin + head + costume + skinColor variants), first-run setup wizard. Frame strip + loop toggle in the player. Multi-layer editor with Move/Brush/Eraser/Eyedropper/Fill/Marquee/Lasso/Wand/Pan tools, mirror brush, Free Transform, Photoshop-style Color Picker + FG/BG widget, drag-to-reorder layers, merge down, History panel with click-to-jump. Mod manager: per-mod metadata + file tree, side-by-side and overlay-slider diff, active-mod overlay so modded sprites appear in the preview, dirty-state guards. All verified in-game. Work continues on the `dev` branch (GitHub: laughable-9/basement-suite; never push/merge to main without explicit consent).

## Hard rules

- `bs.config.json` (gitignored, repo root) holds machine-local paths: `isaacPath`, `modsPath`, `extractedResourcesPath`. If missing, stop and ask the user — never guess or hardcode Steam paths in code.
- The game directory (`isaacPath`, including `extracted_resources/`) is **strictly read-only**. Writes are allowed only inside this repo and `modsPath`.
- Never copy game PNGs or `.anm2` files into the repo or stage them in git — they are copyrighted. Test fixtures load from `extractedResourcesPath` at test time; throwaway local copies go in the gitignored `assets-cache/`.

## UI style — Photoshop for Isaac

The aesthetic target is **a professional Adobe Photoshop-style desktop tool, dedicated to Isaac sprite modding**. Default to Photoshop's panel chrome, not a web app's:

- Dark muted palette (current vars), thin 1px borders, dense panels, **no emoji buttons** anywhere.
- Icon-first tool/category rails (16px stroke SVGs in `app/icons.tsx`); keyboard shortcuts surfaced in tooltips, not labels.
- Avoid bright "web app" affordances: solid green/blue chip badges, gradient buttons, rounded pill labels, decorative shadows.
- **No animated or pulsing state indicators** — no flickering dots, no pulsing borders, no scrolling marquees, no spinner-as-decoration. State that needs to be expressed goes in **plain inline text** ("Live Preview: Azazel"). The only animated indicator allowed is the existing skeleton-pulse on catalog loading shimmer. The tab dirty-dot stays static.
- Real text labels for real things: "75 Frames" not "75f"; tooltips are full sentences. The product is *for editing*, so the controls (transport, sheets, tools) are the focus; previews are reference, not centerpiece (unless explicitly in live-edit mode).
- Verify look in-app via screenshots before declaring a UI task done. The user takes screenshots themselves — provide a concrete checklist of what to look at.

## Architecture

- `src/lib/anm2/` must stay **pure TS with no Tauri imports** (string in, parsed data out) so parser tests run in plain vitest/Node.
- Rust surface stays minimal: Tauri fs plugin + scoped capabilities (extracted tree read-only, mods read-write); avoid custom Rust commands unless the plugin API can't do it.
- Path resolution is an ordered overlay (mod tree → extracted tree), normalizing `\`/`/` and case — anm2 spritesheet paths resolve relative to the anm2's own directory.
- The anm2 parser must be lenient and clamping, never throwing on shipped-game data. The existing corpus test (`src/test/corpus.test.ts`) round-trips all ~2,199 shipped anm2 files; that's the authority on what the parser must tolerate.
- Renderer z-order = per-animation `<LayerAnimation>` declaration order (first = bottom), **not** layer Id order.
- Character rendering is a composite the engine performs and we replicate: player anm2 body anim + separate Head* anim + costume anm2 (costumes2.xml, type="none") matched by state name, with skinColor → `_red/_black/…` skin file variants (see `lib/anm2/compose.ts`, `features/home/renderThumb.ts`).
- The semantic catalog (`lib/catalog/`) parses entities2/items/players/costumes2.xml — all names are localization keys decoded via `lib/catalog/names.ts`; entity keys need id.variant.subtype (collisions otherwise).
- All sheet pixel access goes through `lib/sheets/store.ts` shared docs (live link depends on it); all disk writes go through `lib/fsx/modWrite.ts` (modsPath enforcement).
- Active-mod path overlay lives in `lib/fsx/modOverlay.ts`: `setOverlay({gfxRoot, modsPath, activeMod})` once, then every `loadAnm2Sheets` swaps vanilla paths for `<modsPath>/<activeMod>/resources/gfx/<rel>` when that file exists. Cache is cleared on mod switch (`clearAllSheets` + `clearThumbScenes`); Save-to-mod calls `invalidateOverlay(rel)` so the just-written PNG hits.
- Dirty-state guards: `lib/sheets/dirty.ts` walks a registry of all loaded sheets; `ConfirmDirtyModal` is the one place that asks "Save / Discard / Cancel" and is used by both close-tab and active-mod-switch.

## Commands

- `npm run tauri dev` — desktop window with Vite HMR (the user usually keeps this running in their own terminal; requires Rust + MSVC build tools)
- `npm run dev` — Vite only; the UI loads in a browser but all fs calls fail (no Tauri bridge). Not useful beyond CSS tinkering.
- `npm test` — vitest, single run; `npx vitest run src/test/<file>.test.ts` for one file
- `npm run build` — tsc type-check + Vite bundle (no Rust needed); `npm run tauri build` for the full installer

Corpus-dependent test suites skip when `extractedResourcesPath` is unavailable (e.g. CI); pure-logic tests must run everywhere.

## Releases

Releases are **tag-driven**. The `.github/workflows/release.yml` workflow fires only on `v*` tag pushes — regular commits and PR merges to `main` produce nothing user-facing. Pushing a tag builds Windows (MSI + NSIS), macOS (Intel + Apple Silicon DMG), and Linux (AppImage + .deb) installers in parallel, runs the test suite first, then posts a **draft** GitHub release with every installer attached. Drafts stay invisible until a human edits the notes and clicks Publish.

- Versioning follows [semver](https://semver.org/): `MAJOR.MINOR.PATCH`. While on `0.x` minor bumps may break things; once `v1.0.0` ships, breaking changes mean a major bump.
- **Version is duplicated.** Bump both `package.json` and `src-tauri/tauri.conf.json` together (they must match) before tagging.
- Release cadence: batch fixes, don't tag every commit. Typical small-project cadence is once every 1–2 weeks if there's anything worth shipping, otherwise skip.
- Never tag from a red branch. CI must be green, `npm test` must pass, the packaged app must launch and the golden-path features must work.
- Use pre-release tags (`v0.3.0-beta.1`) for risky / in-progress features — GitHub flags them and users know not to expect stability.
- **Don't break config compatibility silently.** If `bs.config.json` schema changes, either migrate it transparently in code or bump the MAJOR version.

To cut a release: bump the two version fields → commit → `git tag v0.2.0 && git push origin v0.2.0` → wait ~10 minutes → edit the draft notes on GitHub → Publish.
