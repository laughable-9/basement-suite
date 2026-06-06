# Basement Suite — Scan Report

Scanned: 2026-06-07. All paths below use `{isaacPath}` = the game install directory from `bs.config.json`. The game directory was treated strictly read-only.

## 0. Extraction layout (differs from expectations)

The Repentance+ ResourceExtractor does **not** write to `{isaacPath}/resources/gfx` and `{isaacPath}/resources-dlc3/gfx`. It writes a **single merged tree** to:

```
{isaacPath}/extracted_resources/
├── resources/          ← base + DLC3 already merged (this is what we scan)
│   ├── gfx/            ← 8,290 PNG, 2,199 anm2
│   ├── font/ music/ rooms/ sfx/ shaders/ ...
│   └── *.xml           (entities2.xml, items.xml, players.xml, ...)
├── resources.de/ .es/ .fr/ .jp/ .kr/ .ru/ .zh/   ← localized overrides only
```

**Consequence for the app:** there is no dlc3-over-base resolution to perform on the extracted tree — the extractor already applied it. `bs.config.json` gained an `extractedResourcesPath` key pointing at `{isaacPath}/extracted_resources/resources`. The dlc3-priority logic still matters in one place: a mod's own files override the game's, so the app's path resolver should be written as a generic ordered-overlay resolver (mod → extracted) rather than hardcoding one tree.

## 1. Inventory

### 1.1 Counts per top-level `gfx/` folder

| Folder | PNG | anm2 | Notes |
|---|---:|---:|---|
| (gfx root) | 94 | **1,290** | All entity anm2s live here, named `<type>.<variant>_<name>.anm2` (e.g. `001.000_player.anm2`, `003.022_little c.h.a.d..anm2`) |
| characters | 3,326 | 481 | costumes, player spritesheets |
| ui | 1,382 | 131 | |
| items | 1,022 | 112 | collectibles, trinkets |
| monsters | 805 | 0 | spritesheets only; their anm2s are at gfx root |
| bosses | 372 | 0 | same |
| familiar | 317 | 25 | |
| grid | 233 | 96 | rocks, poops, props per floor |
| effects | 231 | 1 | |
| overlays | 216 | 0 | |
| backdrop | 212 | 29 | |
| cutscenes | 45 | 4 | |
| promo | 35 | 30 | |
| **Total** | **8,290** | **2,199** | |

### 1.2 PNG dimension distribution

| Bucket | Count |
|---|---:|
| ≤256×256 | 5,900 (71%) |
| ≤512×512 | 1,904 (23%) |
| ≤1024×1024 | 413 (5%) |
| >1024 | 73 (1%) |

**10 largest spritesheets (stress-test candidates):**

| Dimensions | Path (under `gfx/`) |
|---|---|
| 2400×1620 | `promo/gfuel/effects/explosion3.png` |
| 2640×1215 | `promo/gfuel/effects/explosion_big.png` |
| 1616×1920 | `bosses/repentance/beast.png` |
| 2400×1080 | `promo/gfuel/effects/explosion_delayed.png` |
| 2048×1024 | `bosses/repentance/witness_arm.png` |
| 2048×1024 | `bosses/repentance/witness_head2.png` |
| 1024×2048 | `ui/death enemies.png` |
| 1280×1536 | `cutscenes/final.png` |
| 1260×932 | `bosses/repentance/ultra death.png` |
| 325×3552 | `backdrop/controls.png` |

### 1.3 anm2 files with the most animations (stress-test candidates)

| Anims | File |
|---:|---|
| 49 | `grid/props_07_the corpse.anm2` |
| 49 | `grid/props_07_the womb_blue.anm2` |
| 49 | `grid/props_07_the womb.anm2` |
| 49 | `grid/props_07_utero.anm2` |
| 48 | `grid/props_03_caves.anm2` |
| 45 | `ui/ui_cardfronts.anm2` |
| 44 | `019.002_tuff twin.anm2` |
| 43 | `grid/props_10_cathedral.anm2` |
| 43 | `grid/props_09_sheol.anm2` |
| 43 | `grid/props_11_the chest.anm2` |

**Longest animations** (timeline stress): `cutscenes/intro.anm2` "Scene" = 4,522 frames; `cutscenes/final.anm2` = 3,689; `cutscenes/credits.anm2` = 1,715.

### 1.4 Spritesheet path patterns inside anm2 XML

3,084 `<Spritesheet Path="…">` references total (every anm2 has ≥1; 624 files have multiple, max 40 sheets/file). Resolution semantics verified empirically on a 300-file random sample: **paths resolve relative to the anm2 file's own directory** (419/420 refs resolved; the single failure is a genuinely broken ref, see §3).

| Pattern | Count | Example |
|---|---:|---|
| subdir-relative | 2,335 | `characters/costumes/Character_001_Isaac.png` (from gfx root) |
| same-dir filename | 717 | `BulletAtlas.png` |
| `../` (up 1) | 24 | `../ui/main menu/MenuOverlay.png` |
| `../../` (up 2) | 8 | `../../overlays/hell_overlay.png` |

**Normalization requirements found in real data:** 761 refs use backslashes (`\`) instead of `/`; 1,132 contain uppercase letters that don't always match on-disk casing (e.g. `Characters/costumes/ghost.png` vs on-disk `characters/`). The resolver must normalize separators and compare case-insensitively (fine on Windows, would break on a case-sensitive FS).

## 2. anm2 schema (as found on disk)

Census method: streamed **all 2,199 files** through an XML reader collecting every element name, attribute name, and value range; plus full parses of 5 representatives: `001.000_player.anm2` (player), `003.022_little c.h.a.d..anm2` (ground familiar), `010.001_gaper.anm2` (monster), `005.100_collectible.anm2` (item), `ui/hudpickups.anm2` (UI). Zero XML parse errors across the corpus.

### 2.1 Element tree (complete — no other elements exist in the corpus)

```
AnimatedActor
├── Info                       CreatedBy, CreatedOn, Version, Fps     (ABSENT in 18 files!)
├── Content
│   ├── Spritesheets > Spritesheet   Id, Path
│   ├── Layers       > Layer         Id, Name, SpritesheetId, BlendMode (BlendMode: 1 occurrence in entire game)
│   ├── Nulls        > Null          Id, Name, ShowRect
│   └── Events       > Event         Id, Name
└── Animations                 DefaultAnimation
    └── Animation              Name, FrameNum, Loop
        ├── RootAnimation         > Frame (transform-only)
        ├── LayerAnimations > LayerAnimation  LayerId, Visible  > Frame (full)
        ├── NullAnimations  > NullAnimation   NullId, Visible   > Frame (transform-only)
        └── Triggers        > Trigger         EventId, AtFrame
```

### 2.2 Frame attributes — full census (200,407 Frame elements)

| Attribute | Present on | Observed range | Sane range | Notes |
|---|---|---|---|---|
| XPosition / YPosition | all frames | −1027 … 1143 | px | offset from parent transform |
| Delay | all frames | 0 … 4490 | ≥1 | ticks held at anm2 FPS; **0 occurs** (skip/zero-length frame) |
| Visible | all frames | `true`/`false` | bool | **one `Visible="37"`** in `characters/big_isaac.anm2`; coerce non-"false" to true |
| XScale / YScale | all frames | −700 … 48000 | percent (100 = 1×) | negative = mirror flip |
| Rotation | all frames | −720 … 720 | degrees | |
| RedTint/GreenTint/BlueTint | all frames | −255 … 512 (one 37,914,128) | 0–255 multiplier | clamp on load |
| AlphaTint | all frames | 0 … 900 | 0–255 | clamp |
| Red/Green/BlueOffset | all frames | −190 … 263 | additive, ±255 | |
| Interpolated | 195,142 frames | `true`/`false`/**`False`** | bool | case-insensitive parse; lerp toward next keyframe |
| XCrop / YCrop | 174,752 (layer frames only) | −512 … **4294967293** | px source rect | values like 4294967293 are **negative ints stored as uint32** (−3); decode via `(v | 0)` int32 wrap |
| Width / Height | 174,752 (layer frames only) | 0 … 1024 | px source rect | |
| XPivot / YPivot | 175,066 | −390 … 768 | px anchor within crop rect | 314 frames have pivot without crop |

Frame "kinds": **Root/Null frames** carry only transform+tint (no crop/size/pivot); **Layer frames** carry everything. They are distinguished by parent element, not by attributes present — but 25,655 transform-only frames means parsers must treat crop/size/pivot as optional.

### 2.3 Timing model (verified on Little C.H.A.D. `FloatDown`)

- `Info Fps` is ticks-per-second for the whole file. Values: 30 (2,148 files), 45 (31 files), garbage 107,844,072 (2 files: `ui/giantbook/giantbook_mama_mega.anm2`, `giantbook_sleep.anm2` — **clamp FPS to e.g. 1–120, default 30**), absent entirely (18 files — `<Info>` element missing, e.g. `002.008_scythe tear.anm2`, `ui/hudstats2.anm2` → default 30).
- `Animation FrameNum` = total timeline length in ticks. `Delay=N` on a keyframe holds it for N ticks. Sum of Delays per track ≈ FrameNum (e.g. FloatDown: FrameNum=16, 8 keyframes × Delay=2; its RootAnimation has 1 keyframe with Delay=16).
- `FrameNum="0"` exists (`005.100_collectible.anm2` "Empty") — render nothing, don't crash.
- `Interpolated="true"` on keyframe K linearly interpolates position/scale/rotation/tint from K to K+1 across K's Delay ticks; `false` holds.

### 2.4 Layer rendering order (verified)

- `Content/Layers` declaration order always equals Id order (0 of 2,199 files differ) — Id order is **not** the signal.
- **The z-order is the declaration order of `<LayerAnimation>` elements inside each `<Animation>`, first = bottom-most.** 593 files rely on this, e.g. `003.080_incubus.anm2` `FloatDown` declares LayerIds in order 2 (WingsBack), 0 (body), 1 (WingsFront). Render order can differ per animation within the same file.
- `BlendMode="1"` (additive) appears exactly once in the game (`838.000_level 2 willo.anm2`, glow layer). Support or ignore-with-warning.

### 2.5 Sample file profiles

| File | Sheets | Layers | Nulls | Events | Anims | Notable |
|---|---:|---:|---:|---:|---:|---|
| `001.000_player.anm2` | 2 | 15 | 8 | 4 | 39 | Triggers (`DeathSound` at frame 8 of Death); nulls: LeftEye, Mouth, … |
| `003.022_little c.h.a.d..anm2` | 1 | 1 | 0 | 0 | 3 | FloatDown 16f loop, interpolated scale bobbing |
| `010.001_gaper.anm2` | 2 | 2 | 1 | 0 | 3 | shared body sheet (`Monster_000_Bodies01.png`) + own head sheet |
| `005.100_collectible.anm2` | 4 | 6 | 1 | 0 | 6 | altar+item+sparkle+shadow composite; `Empty` anim FrameNum=0 |
| `ui/hudpickups.anm2` | 1 | 1 | 0 | 0 | 2 | layer with empty Name `""` |

### 2.6 Other schema facts

- `Animations DefaultAnimation` always present (2,199/2,199).
- `Trigger`: `EventId` 0–11, `AtFrame` 0–196; used for sound/FX sync. 2,379 triggers corpus-wide.
- `NullAnimation` may be self-closing with zero Frames.
- `Layer Name` may be `""`. Animation names include spaces and mixed case.
- Up to 56 layers (`Layer Id` max 56), 40 spritesheets, 25 nulls in a single file.
- Encoding: plain XML, tab/space-indented, no XML declaration line in most files.

## 3. Surprises / landmines (all observed in shipped files)

1. **Garbage FPS** `107844072` in 2 files — looks like uninitialized memory. Clamp.
2. **Missing `<Info>`** in 18 files — FPS must default (30).
3. **uint32-wrapped negative crops** — `XCrop="4294967293"` = −3. Parse as int64 then wrap to int32, or clamp.
4. **`Visible="37"`**, **`Interpolated="False"`** (capital F) — boolean parsing must be lenient.
5. **`RedTint="37914128"`**, `AlphaTint` up to 900, tints down to −255 — clamp to 0–255.
6. **Broken spritesheet ref**: `919.000_raglich.anm2` → `bosses/repentance/screenshot.png` does not exist (unfinished boss). Renderer must tolerate missing sheets (render placeholder).
7. **`FrameNum="0"`** animation ("Empty") exists.
8. **`Delay="0"`** keyframes exist.
9. Mixed path separators and case mismatches vs on-disk names (§1.4).
10. Attribute order varies between files (`Path` first vs `Id` first) — fine for XML parsers, fatal for naive regex.

## 4. Mods folder

`{modsPath}` exists and contains **0 mods** — no real-world example to copy. Canonical minimal sprite-replacement mod (from modding docs, to be verified on first export in M3):

```
{modsPath}/<mod folder name>/
├── metadata.xml
└── resources/
    └── gfx/
        └── <mirrored path>/<edited>.png     ← same relative path as under extracted gfx/
```

`metadata.xml` minimal form:

```xml
<metadata>
    <name>My Sprite Mod</name>
    <directory>my sprite mod</directory>
    <description>Edited sprites</description>
    <version>1.0</version>
    <visibility/>
</metadata>
```

Notes: `directory` must match the folder name; no `id` tag until uploaded to Workshop. A replaced PNG is picked up by path mirror alone — the anm2 doesn't need to be copied unless it was edited too. Localized variants (`resources.de` etc.) are out of scope.

## 5. Implications for Basement Suite (carried into PLAN.md)

- Parser must be **lenient + clamping**, never throwing on shipped-game data; the full corpus (2,199 files) parses as valid XML, so a standard XML parser + tolerant attribute decoding suffices.
- Path resolver: anm2-dir-relative, separator/case normalizing, ordered overlay (mod tree → extracted tree), missing-file tolerant.
- Renderer z-order: per-animation LayerAnimation declaration order. Pivot/crop/scale(%)/rotation/tint/offset/interpolation all exercised by real content.
- Canvas sizes are friendly: 94% of sheets ≤512×512; cap zoom math around the 2640×1620 worst case.
- Stress fixtures: `grid/props_07_the corpse.anm2` (49 anims), `cutscenes/intro.anm2` (4,522-frame timeline), `005.100_collectible.anm2` (4 sheets, 6 layers), `003.080_incubus.anm2` (z-reorder), `838.000_level 2 willo.anm2` (BlendMode), `919.000_raglich.anm2` (broken ref).
