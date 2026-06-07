# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Basement Suite: a desktop app (Tauri 2 + React + TypeScript + Vite) combining a pixel art editor with a live `.anm2` animation previewer for modding The Binding of Isaac: Repentance. Edit a spritesheet in one pane, watch the animation re-render live in the other, save into a mod folder.

**Current status: MVP (M0–M4) + UI redesign (U1–U5) complete.** Semantic catalog browser (categories from the game's XML indexes), document tabs with per-tab editor/player state, rendered hover-animated thumbnails, character compositing (skin + head + costume + skinColor variants), settings popover. All verified in-game. Work continues on the `dev` branch (GitHub: laughable-9/basement-suite; never push/merge to main without explicit consent). Read these before doing anything:
- `SCAN_REPORT.md` — empirical findings from scanning the game's 2,199 anm2 / 8,290 PNG files: real schema, attribute ranges, and a list of landmines in shipped game data (garbage FPS values, uint32-wrapped negative crops, missing `<Info>` elements, broken refs). Do not re-scan the game tree; the answers are here.
- `PLAN.md` — approved architecture, repo structure, milestones M0–M4 with acceptance criteria, and the TypeScript data model for parsed anm2 files.

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

## Architecture (from PLAN.md, binding once scaffolded)

- `src/lib/anm2/` must stay **pure TS with no Tauri imports** (string in, parsed data out) so parser tests run in plain vitest/Node.
- Rust surface stays minimal: Tauri fs plugin + scoped capabilities (extracted tree read-only, mods read-write); avoid custom Rust commands unless the plugin API can't do it.
- Path resolution is an ordered overlay (mod tree → extracted tree), normalizing `\`/`/` and case — anm2 spritesheet paths resolve relative to the anm2's own directory.
- The anm2 parser must be lenient and clamping, never throwing on shipped-game data; each landmine in SCAN_REPORT §3 is a required unit test.
- Renderer z-order = per-animation `<LayerAnimation>` declaration order (first = bottom), **not** layer Id order.
- Character rendering is a composite the engine performs and we replicate: player anm2 body anim + separate Head* anim + costume anm2 (costumes2.xml, type="none") matched by state name, with skinColor → `_red/_black/…` skin file variants (see `lib/anm2/compose.ts`, `features/home/renderThumb.ts`).
- The semantic catalog (`lib/catalog/`) parses entities2/items/players/costumes2.xml — all names are localization keys decoded via `lib/catalog/names.ts`; entity keys need id.variant.subtype (collisions otherwise).
- All sheet pixel access goes through `lib/sheets/store.ts` shared docs (live link depends on it); all disk writes go through `lib/fsx/modWrite.ts` (modsPath enforcement).

## Commands

- `npm run tauri dev` — desktop window with Vite HMR (the user usually keeps this running in their own terminal; requires Rust + MSVC build tools)
- `npm run dev` — Vite only; the UI loads in a browser but all fs calls fail (no Tauri bridge). Not useful beyond CSS tinkering.
- `npm test` — vitest, single run; `npx vitest run src/test/<file>.test.ts` for one file
- `npm run build` — tsc type-check + Vite bundle (no Rust needed); `npm run tauri build` for the full installer

Corpus-dependent test suites skip when `extractedResourcesPath` is unavailable (e.g. CI); pure-logic tests must run everywhere.
