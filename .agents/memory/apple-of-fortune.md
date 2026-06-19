---
name: Apple of Fortune game
description: Non-obvious sprite-extraction coords and design decisions for the Apple of Fortune mobile clone
---

# Apple of Fortune (artifacts/apple-of-fortune)

Multiplier-ladder gambling clone, virtual currency only, no backend. Built from 12
reference screenshots (1080x2340). Keep the Uzbek UI text exactly as in the screenshots.

## Sprite source crops (NOT derivable from code — needed to re-extract)
Sprites saved 160x160, circular-masked, in assets/images/: wood, sprout, apple, core, bg.
Crop centers in the 1080-wide screenshots: WOOD (615,664); CORE (460,664);
APPLE (280,985); SPROUT (615,1160). bg = jungle crop 1080x400+0+1610, stretched + blurred.
DECISION: re-extracting sharper sprites is NOT worth it — tiles touch each other, so any
crop catches neighbor slivers, and the existing 160px masks are already native-res. Improve
perceived quality via rendering instead (expo-blur backdrop, tile drop-shadows, expo-image
cross-dissolve transition to kill the black flash on source swap), not bigger source crops.

## Board geometry (corrected against the user's original-game screenshots)
PILL_COL ≈ width*0.142. colPitch = (width - 2*H_PAD - PILL_COL - COL_GAP)/5.
The original board is OPEN: tiles do NOT touch. Tile diameter ≈ 0.89*colPitch (clear
horizontal gap) and crucially the VERTICAL pitch is LARGER than the tile —
pitchY slightly LARGER than the tile (small gap between rows, NO overlap). 7 of 9 rows
visible. Do NOT pack rows so they touch/overlap — that reads as cramped and is wrong.

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
