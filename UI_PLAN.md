# UI Redesign Plan — "Photoshop for Isaac"

Agreed direction (2026-06-07): visual-first semantic browser replacing the raw
folder tree, document-tab workspace, hover-animated thumbnails. This plan is
approved-pending-build; implementation happens on `dev` in milestones U1–U5.

## 1. Decisions made

| Decision | Choice |
|---|---|
| Workspace model | **Document tabs** — Home tab (browser) + one tab per opened entity, each preserving its own editor/player state |
| Thumbnails | **Rendered first frame** of default animation; **animate on hover** (one at a time) |
| Browse flow | **Browser is a mode** — full-window grid; opening an entity switches to its tab |
| Raw tree | Kept as a **Files** category (power-user escape hatch) |

## 2. The catalog — semantic data from the game's own XML

The extracted resources include index files that map raw assets to real names.
All read-only, parsed once at startup (fast-xml-parser, same lenient style as
the anm2 parser):

| Source | Gives us |
|---|---|
| `entities2.xml` | id/variant → display name, anm2 path, `boss` flag, kind |
| `items.xml` | collectible/trinket names → gfx file ("The Sad Onion") |
| `players.xml` | characters → name + spritesheet/portrait paths |
| `bossportraits.xml` | boss portrait art mapping |
| `backdrops.xml` | floor names → backdrop gfx |

**Category tree** (sidebar order):

- **Characters** (players.xml)
- **Tears & Projectiles** (entity types 002, 009)
- **Familiars** (003)
- **Pickups** (005.* — hearts, coins, chests…)
- **Items & Trinkets** (items.xml; subsections Collectibles / Trinkets)
- **Enemies** (entities2 type ≥ 10, boss=0) ▸ **Bosses** (boss=1)
- **Effects** (1000.*)
- **Grid & Props** (grid/)
- **Backdrops** (backdrop/ + backdrops.xml names)
- **UI** ▸ HUD · Main Menu · Giantbook · Boss Intro · Achievements · Co-op ·
  Cards & Misc (curated map of `ui/` subfolders + known hud files)
- **Cutscenes**
- **Files** (current raw tree, everything, including unclassified leftovers)

Catalog entry shape: `{ key, name, category, subcategory?, anm2Path?,
sheetPaths[], entityId?, variant?, source }`. Entities with many variants
(e.g. champions) group under one card with a variant picker in the workspace.
Anything no XML claims → appears only under Files.

**Search**: startup-built index over names + filenames; global search bar
(fuzzy-ish substring, ranked: name match > filename match).

## 3. Layout

```
┌──────────────────────────────────────────────────────────────┐
│ ☰ BS  [🏠 Home] [Gaper ×] [C.H.A.D. ●×]   [🔍 search]   ⚙   │  app bar + tabs
├──────┬───────────────────────────────────────────────────────┤
│ 👤   │ HOME TAB: Enemies ▸ Bosses              [size ▾]      │  breadcrumb
│ 💧   │ ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐              │
│ 🐾   │ │ 🖼  │ │ 🖼  │ │ 🖼  │ │ 🖼  │ │ 🖼  │  virtualized │
│ 👹   │ │Monst│ │Larry│ │Chub │ │Gurdy│ │ Mom │  grid        │
│ 🎁   │ └─────┘ └─────┘ └─────┘ └─────┘ └─────┘              │
│ 🖥   │  …                                                    │
│ 📁   │ ENTITY TAB: editor (tool rail) │ player (right)       │
├──────┴───────────────────────────────────────────────────────┤
│ 2,199 anm2 · 8,290 sheets · mod: chad recolor     [toasts]   │  status bar
└──────────────────────────────────────────────────────────────┘
```

- Sidebar: icon-only category rail (tooltips), active category highlighted —
  same visual language as the editor tool rail.
- Tab strip: Home pinned first; entity tabs show dirty dot; middle-click or ×
  closes (confirm if dirty); Ctrl+Tab cycles, Ctrl+W closes.
- Entity tab content = current editor+player split (unchanged internals).
- Status bar: corpus counts, active mod name, save feedback.

## 4. Thumbnails

- Render via existing `renderFrame` → offscreen canvas → ~96px fit box;
  first frame of default animation (fallback: sheet center crop for plain PNGs).
- Lazy: IntersectionObserver + render queue (concurrency ~4, idle-priority);
  in-memory LRU cache keyed by anm2 path + sheet version (live-link aware —
  editing C.H.A.D. updates his Home card).
- Hover: card swaps to a live mini-player for its default animation; only one
  animates at a time; leave restores the cached static frame.

## 5. Milestones

- **U1 — Catalog** (pure logic + tests): parse the 5 XML sources, build
  category tree + search index. Corpus-backed tests: Gaper named & filed under
  Enemies; Monstro under Bosses; "The Sad Onion" resolves to its PNG; counts
  sane (≥600 enemies, ≥600 items). Acceptance: a temporary debug view lists
  every category with counts and sample names.
- **U2 — Shell**: app bar + tab strip + sidebar + Home grid (virtualized,
  breadcrumbs, search) using cheap sheet-crop thumbs; Files category embeds the
  existing tree. Acceptance: browse Enemies ▸ Bosses visually, search "brim",
  open Monstro into a tab, current editor/player works inside it.
- **U3 — Real thumbnails**: rendered first frames + hover animation +
  live-link cache invalidation. Acceptance: Familiars grid shows recognizable
  sprites; hovering Little C.H.A.D. plays FloatDown; Enemies (~800 cards)
  scrolls smoothly.
- **U4 — Tab state**: per-tab editor/player state preserved across switches,
  dirty dots, close confirmations, Ctrl+Tab/Ctrl+W. Acceptance: edit Gaper,
  switch to C.H.A.D. and back — zoom/undo stack/animation position intact.
- **U5 — Polish**: status bar, settings panel (view/edit config paths),
  empty-state and loading skeletons, app icon refresh to match the new look.

## 6. Risks / notes

- **Verified 2026-06-07**: `entities2.xml` carries literal `name=` attributes
  and `boss="1"` on 197 entries ✓. But `items.xml`/`players.xml` use
  localization keys (`#THE_SAD_ONION_NAME`); literal strings live in binary
  `stringtable.sta`. **Display names for items/characters are derived from the
  gfx filename instead** (`Collectibles_001_TheSadOnion.png` → "The Sad
  Onion") — title-cased camel-split, unit-tested.
- `entities2.xml` has thousands of entries with messy data (same lenient
  parsing posture as anm2: never throw, skip unmappable rows, count them).
- UI subfolder classification is a curated map — unknown files land in
  UI ▸ Misc, never lost.
- Hidden tabs keep components mounted (cheap; cap ~10 open tabs, LRU-close
  prompt beyond that).
- Refactor strategy: build catalog + Home alongside the current shell, swap
  the shell last — the app stays usable on `dev` throughout.
