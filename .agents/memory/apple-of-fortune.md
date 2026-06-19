---
name: Apple of Fortune game
description: Non-obvious sprite-extraction coords and design decisions for the Apple of Fortune mobile clone
---

# Apple of Fortune (artifacts/apple-of-fortune)

Multiplier-ladder gambling clone, virtual currency only, no backend. Built from 12
reference screenshots (1080x2340). Keep the Uzbek UI text exactly as in the screenshots.

## Sprite source crops (NOT derivable from code — needed to re-extract)
Sprites saved 160x160, circular-masked (alpha 0 outside a radius-~79 circle, feather 0.6) in
assets/images/: wood, sprout, apple, core, bg. Extract from the target reference (1080x2340),
crop 160x160 centered on a tile, then CopyOpacity with a white circle (radius 79) mask.
CRITICAL PITFALL (this is what made an earlier pass look "dark/muddy with a green cast"):
the climbed-board screenshot dims PAST/already-passed tiles to ~60% brightness, so cropping
wood from there yields dark muddy tiles. ALWAYS crop each sprite from a FULL-BRIGHTNESS,
UNOBSCURED instance, and sample the crop's center color to verify before installing —
bright wood center is ~srgb(135,57,30); the dimmed/wrong one is ~srgb(80,46,26).
Good full-brightness sources & centers:
- WOOD <- the LOW-progress screenshot (e.g. ...125812..., top UNOPENED rows), center ~(637,667).
- APPLE+green tile+leaf <- a fully-lit picked apple in the climbed screenshot (...125823...), ~(450,667).
- SPROUT/mushroom <- top mushroom row of ...125823..., center ~(457,462) (cleanest, no green rim).
- CORE: no clean reference instance — rebuild = bright WOOD ring + git-original eaten-apple-core
  center (brighten orig core modulate ~122,108,100; composite via feathered circle r~40).
- bg: the git-original jungle bg.png (do NOT re-grade it; revert any modulate).
DECISION: extracting straight from the reference makes tile colors pixel-exact BY CONSTRUCTION;
code tints/overlays only uniformly lighten/darken and CANNOT fix per-color hue/saturation.

## Board geometry — ONE measured master grid (do NOT go back to ad-hoc per-axis constants)
The user rejected the old layout (separate PILL_COL + COL_GAP + colPitch + pitchY=tile*1.15)
because horizontal pitch ≠ vertical pitch and the pill column was off-grid → "inconsistent,
drifting" rows. The original game is actually ONE uniform SQUARE grid; rebuild on that.
Measured from the 1080-wide reference (Screenshot_...125812...) by wood-color column/row scans:
- 6 columns = 1 multiplier pill (col 0) + 5 tile columns, ALL on the same pitch.
- Tile column centers x = 278,447,616,784,953 → column pitch ≈ 169 ref px. Green pill center
  x ≈ 108 = 278−170, so the pill is just column 0 of the same grid.
- Tile & pill diameter ≈ 147 ref px (measure on a FULL-BRIGHT row; vertical scans
  under-read the diameter ~123 because the wood circle's top/bottom is shaded).
- Row pitch ≈ 170 ref px ≈ column pitch → treat as SQUARE: use ONE `pitch` for both axes.
Implementation (current): `gridScale=width/1080; tile=147*gridScale; pitch=169.5*gridScale;
pitchY=pitch;` render each row as 6 equal `pitch`-wide square cells, content (pill/tile)
size=`tile` centered in each cell, row paddingLeft=`gridLeft=(width-6*pitch)/2` → perfectly
centered, identical gaps everywhere, zero per-row drift. tile/pitch ≈ 0.867 (open board,
tiles never touch). 7 of 9 rows visible. Verified at 402-wide: columns & rows both ~63 px
pitch. Pill width set to `tile`; keep pill text fontSize ~10 + small padding so "x 349.68"
fits the ~55px cell.

## Per-row tile opacity must match the reference's dimming (visual)
In tileTypeFor: PAST already-climbed unpicked rows render dimmed — opacity 0.6 is CORRECT
because the reference's dimmed wood ≈ bright wood × 0.6 (measured). But UPCOMING (not-yet-
reached) rows are FULL brightness in the reference, so they must be ~1.0, NOT dimmed.
A stale 0.72 dimming on far upcoming rows (tuned for the old dark sprite) made the board look
dark — fixed to dist<=2?1:0.9. Re-check this whenever sprite brightness changes.

## Board vertical position / top-spacing calibration (visual)
The whole grid's vertical placement is ONE value: `boardTop = insets.top + OFFSET` in
index.tsx layout math. It maps 1:1 to the on-screen Y of the board (the title/header are a
separate fixed strip), so OFFSET delta == screen-position delta exactly — use a live in-session
screenshot as the calibration data point, NOT a prior-session screenshot (insets/header can
differ across sessions and break the 1:1 assumption).
ANCHOR / "first visible row" definition (this caused two wrong iterations): the clone's
TOPMOST visible row maps to the reference's HIGHEST-multiplier row x349.68 (which is faint/faded
at the board's top edge in the screenshot), NOT the first fully-bright wood row below it.
Measuring from the first bright row makes you place the board too LOW.
Match the STATUS-BAR-INDEPENDENT title->top-row gap (web preview has no OS status bar; the ref
phone does — never match absolute Y). Use multiplier PILLS as the per-row anchor (one per row,
white text / green active pill, at exact row centers; pitch ~170 ref px). Reference
(Screenshot_...125812..., 1080x2340): title center y≈307; x349.68 pill/row center y≈484 →
title-center→top-row-center gap = 177 ref px. Scale = deviceWidth/1080 ≈ 0.372 (viewport
~402x874 ≈ same aspect 0.46) → ~66 device px. So at 402-wide: title center ≈78, top-row
center should be ≈144. After the master-grid rebuild the value is **boardTop = insets.top + 121**
(verified at 402-wide: top-row center 145, gap 67). NOTE the absolute number is tied to the
current grid `pitch`/`tile`; if you change the grid scale, re-measure and retune boardTop.
Measure programmatically from a saved screenshot (screenshot tool save_to, after temporarily
lowering the loading timeout line ~91 from 1100→50 then REVERTING): per-row gray-brightness for
the title band, wood-color threshold (R>110 & G<110) for tile rows, white/green threshold for
ref pills.
BOTTOM clearance: boardTop is the ONLY lever and the board is FIXED height (~7 rows, ~450
device px, overflow:hidden so shrinking height just clips the bottom row). Pushing boardTop
DOWN shoves the bottom row into the controls on SHORT panes; the "MAVJUD YUTUQ" winInfoBar
(semi-opaque, only mid-round) makes overlap visually obvious. Validate in the PLAYING state
(runTest: GAROV then tap a tile) at ~400x720. The reference deliberately leaves a LARGE
board→panel jungle gap, so the correct (higher) boardTop also clears the panel — moving the
board UP only increases bottom clearance. The square grid (pitch≈63 at 402-wide) is shorter
than the old pitchY=tile*1.15, so the board is slightly shorter → bottom clearance improved;
boardTop 121 verified clean in the PLAYING state.

## Verifying the UI (screenshot gotcha)
The app shows a ~1100ms branded loading overlay on mount that fades out. The screenshot
tool RELOADS the page every call, so it always captures the loading screen at t=0 and never
the game. Use the Playwright testing skill (runTest) to wait past the overlay and exercise
the board/admin menu — that is the only reliable visual validation here.

## Design decisions
- Tiles are OPEN — clear gaps both horizontally and vertically, tiles never touch/overlap.
  This matches the original game; do not pack/overlap the rows.
- Board shows 7 of 9 multiplier rows and auto-scrolls as the player climbs.
- "Numbers update in jumps": values snap to the final amount with a subtle scale pop —
  do NOT add incremental count-up animation.
- Cash-out reuses the same win ("G'alaba!") overlay/end-state as a top-row win.
- Sprite gloss is a plain semi-transparent white rounded View overlaid on apple/core/sprout
  (NOT wood) — no gradient lib needed; keep opacity low (~0.16) so it reads as a sheen.
- Board is nudged down via boardTop: with a fixed 7-row window over 9 rows, the top
  multiplier row unavoidably reaches the board's top edge near x349, so the ONLY way to keep
  "spacing from the screen top" at high multipliers is a larger boardTop — you cannot
  translate board content down without clipping the rows still being climbed.
- The pill column is NOT special-cased anymore — it is column 0 of the same master grid, so
  the pill/tile horizontal gap falls out of the uniform `pitch` automatically (no COL_GAP /
  separate tilesArea). Do not reintroduce per-axis or per-column spacing constants.
