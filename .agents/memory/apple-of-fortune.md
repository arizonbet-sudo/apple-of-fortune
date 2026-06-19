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
index.tsx layout math. Tile-top on screen = boardTop + (pitchY-tile)/2 (~4 device px), and
in any game state the row sitting at the board-container top is at that same screen Y (the
container is fixed; only the inner rail scrolls). To match the reference's top spacing use the
STATUS-BAR-INDEPENDENT title->first-row gap (web preview has no status bar; the reference
phone screenshot does, ~94 ref px ≈ 35 device px — do NOT match absolute Y or you'll be off by
the status bar): measure title-bottom and topmost-tile-top in the reference (1080x2340),
gap_ref px × (deviceWidth/1080) = gap_device, then set OFFSET so on-screen
(tiletop - title_bottom) == gap_device. Device viewport ~402x874 is ~same aspect as the ref
(0.46), so width-scale ≈ height-scale ≈ 0.372. Measured ref: title-bottom y≈322,
first-row tile-top y≈566 -> gap 244 ref ≈ 91 device; OFFSET 116 was too high, 170 matches.
Measure edges programmatically from a saved screenshot (screenshot tool save_to) — per-row
gray-brightness profile for the title band, wood-color threshold (R>110 & G<110) for tile top.

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
