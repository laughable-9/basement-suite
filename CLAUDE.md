# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Basement Suite: a desktop app (Tauri 2 + React + TypeScript + Vite) combining a pixel art editor with a live `.anm2` animation previewer for modding The Binding of Isaac: Repentance. Edit a spritesheet in one pane, watch the animation re-render live in the other, save into a mod folder.

**Current status: MVP complete (M0–M4).** Browser, anm2 parser+player, pixel editor (incl. floating paste), live link, and mod export are all working and verified in-game. Post-MVP work continues on the `dev` branch. Read these before doing anything:
- `SCAN_REPORT.md` — empirical findings from scanning the game's 2,199 anm2 / 8,290 PNG files: real schema, attribute ranges, and a list of landmines in shipped game data (garbage FPS values, uint32-wrapped negative crops, missing `<Info>` elements, broken refs). Do not re-scan the game tree; the answers are here.
- `PLAN.md` — approved architecture, repo structure, milestones M0–M4 with acceptance criteria, and the TypeScript data model for parsed anm2 files.

## Hard rules

- `bs.config.json` (gitignored, repo root) holds machine-local paths: `isaacPath`, `modsPath`, `extractedResourcesPath`. If missing, stop and ask the user — never guess or hardcode Steam paths in code.
- The game directory (`isaacPath`, including `extracted_resources/`) is **strictly read-only**. Writes are allowed only inside this repo and `modsPath`.
- Never copy game PNGs or `.anm2` files into the repo or stage them in git — they are copyrighted. Test fixtures load from `extractedResourcesPath` at test time; throwaway local copies go in the gitignored `assets-cache/`.

## Architecture (from PLAN.md, binding once scaffolded)

- `src/lib/anm2/` must stay **pure TS with no Tauri imports** (string in, parsed data out) so parser tests run in plain vitest/Node.
- Rust surface stays minimal: Tauri fs plugin + scoped capabilities (extracted tree read-only, mods read-write); avoid custom Rust commands unless the plugin API can't do it.
- Path resolution is an ordered overlay (mod tree → extracted tree), normalizing `\`/`/` and case — anm2 spritesheet paths resolve relative to the anm2's own directory.
- The anm2 parser must be lenient and clamping, never throwing on shipped-game data; each landmine in SCAN_REPORT §3 is a required unit test.
- Renderer z-order = per-animation `<LayerAnimation>` declaration order (first = bottom), **not** layer Id order.

## Commands

- `npm run tauri dev` — desktop window with Vite HMR (the user usually keeps this running in their own terminal; requires Rust + MSVC build tools)
- `npm run dev` — Vite only; the UI loads in a browser but all fs calls fail (no Tauri bridge). Not useful beyond CSS tinkering.
- `npm test` — vitest, single run; `npx vitest run src/test/<file>.test.ts` for one file
- `npm run build` — tsc type-check + Vite bundle (no Rust needed); `npm run tauri build` for the full installer

Corpus-dependent test suites skip when `extractedResourcesPath` is unavailable (e.g. CI); pure-logic tests must run everywhere.
