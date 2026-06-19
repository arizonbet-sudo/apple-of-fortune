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

## Board geometry (corrected against the user's original-game screenshots)
PILL_COL ≈ width*0.142. colPitch = (width - 2*H_PAD - PILL_COL - COL_GAP)/5.
The original board is OPEN: tiles do NOT touch. Tile diameter ≈ 0.89*colPitch (clear
horizontal gap) and crucially the VERTICAL pitch is LARGER than the tile —
pitchY slightly LARGER than the tile (small gap between rows, NO overlap). 7 of 9 rows
visible. Do NOT pack rows so they touch/overlap — that reads as cramped and is wrong.

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
center should be ≈144 → **OFFSET 122** (verified: 122 gives top-row center 145, gap 67).
Earlier OFFSETs 170 and 140 were too low because they measured from the first bright row;
116 was close; 122 is the reference-correct value.
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
board UP only increases bottom clearance. 122 < 140 (already-clean), so 122 is safe.

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
- A real horizontal gap between the pill column and tiles needs its own COL_GAP subtracted
  from tilesArea AND a marginLeft on the tiles row (widening PILL_COL just makes pills bigger).
