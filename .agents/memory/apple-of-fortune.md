---
name: Apple of Fortune game
description: Non-obvious sprite-extraction coords and design decisions for the Apple of Fortune mobile clone
---

# Apple of Fortune (artifacts/apple-of-fortune)

Multiplier-ladder gambling clone, virtual currency only, no backend. Built from
reference screenshots (1080x2340). Keep the Uzbek UI text exactly as in the screenshots.

## Sprite source crops (NOT derivable from code — needed to re-extract)
The board is DENSE: discs FILL each cell and nearly touch (this is what the original looks
like). Earlier 160x160 sprites had internal padding + neighbour fragments → tiles looked
small/sparse and the user rejected them hard. FIX = re-crop CLEAN full-bleed circular discs.
Current sprites are 168x168 in assets/images/ (wood, apple, sprout, core); originals backed
up in .local/refcrops/orig_*.png.
Extraction recipe (ImageMagick), crop 168x168 centered on a full-bright UNOBSCURED tile, then
circular alpha mask: `\( +clone -alpha transparent -fill white -draw "circle 84,84 84,166" \)
-compose CopyOpacity` (diameter ~164 in the 168 canvas → disc ≈0.976*cell).
Good full-brightness sources (1080x2340) and crop top-left origins (168x168):
- WOOD  <- Screenshot_...125812..., origin (284,640)
- SPROUT<- Screenshot_...125812..., origin (282,974)
- APPLE <- Screenshot_...125812..., origin (281,1141)
- CORE  <- Screenshot_...104919... (loss screen), origin (281,473), brightened `-modulate 168,150`
PITFALL: cropping from a screenshot's PAST/already-passed rows yields dark muddy tiles (the
game dims them ~60%). Always crop from a full-brightness instance and eyeball the center color
before installing.
DECISION: extracting straight from the reference makes tile colors pixel-exact BY CONSTRUCTION;
code tints/overlays only uniformly lighten/darken and CANNOT fix per-color hue/saturation.

## Board geometry — ONE measured master grid (do NOT go back to ad-hoc per-axis constants)
The original is ONE uniform grid: 6 columns = 1 multiplier pill (col 0) + 5 tile columns, all
on the same horizontal pitch; rows on a slightly shorter vertical pitch. Measured from the
1080-wide reference (Screenshot_...125812...):
- Tile column centers x ≈ 281,452,621,790,954 → column pitch ≈ 168 ref px.
- Disc ≈ 167w x 158h ref px (slightly WIDE ellipse, ratio ~0.95). Discs nearly touch.
- Row pitch ≈ 166.5 ref px. Title center y≈307; top (faded x349.68) row center y≈480 →
  title-center→top-row-center gap ≈ 166 ref px.
Implementation in app/index.tsx (~lines 105-113): `gridScale=width/1080;
pitch=168*gridScale; pitchY=166.5*gridScale; tile=168*gridScale; pillW=140*gridScale;
pillH=66*gridScale; gridLeft=29*gridScale; boardTop=insets.top+104;`. Pill renders as
{width:pillW,height:pillH,borderRadius:pillH/2}. Each row = 6 cells; pill=col0, tiles=cols1-5.
VERIFIED at 402-wide (gridScale≈0.372): column pitch 62.5, row pitch 62, disc 60w x 57h,
title center 73, row1 center 135 → gap 62 dev px (matches original ~62). Columns scale to
~277/446/613/782/948 vs orig 281/452/621/790/954 (within ~2-3 dev px). If you change the grid
scale, re-measure and retune boardTop (it maps 1:1 to on-screen board Y).

## MEASUREMENT GOTCHA (caused a false "rows 73px apart" panic)
Clone screenshots are 402x874. NEVER crop a region taller than the image then force
`-resize 1xN!` to a LARGER N — e.g. cropping 900px tall from an 874px image and resizing to
900 stretches Y by ~1.16x and reports bogus row pitch/disc height. Always crop within bounds
and use a resize height <= the crop height.

## Verifying the UI (screenshot gotcha)
The app shows a ~1100ms branded loading overlay on mount (timeout ~line 91). The screenshot
tool RELOADS the page every call, so it captures the loading screen at t=0. To grab the board
for `magick` measurement, temporarily lower that timeout 1100->50, screenshot with save_to,
then REVERT to 1100. For play-state (apples/core), drive it with the Playwright testing skill
(runTest): tap GAROV, then tap a tile.

## Per-row tile opacity must match the reference's dimming (visual)
In tileTypeFor: PAST already-climbed unpicked rows render dimmed (~0.6, matches reference);
UPCOMING not-yet-reached rows are FULL brightness (~1.0). Re-check whenever sprite brightness
changes.

## Design decisions
- Tiles are DENSE — discs fill each cell and nearly touch (matches the original). Do NOT revert
  to the old "open grid, tiles never touch" layout; that was the rejected version.
- Board shows 7 of 9 multiplier rows and auto-scrolls as the player climbs.
- The clone's TOPMOST visible row maps to the reference's HIGHEST-multiplier row x349.68 (faint
  at the board top), NOT the first fully-bright wood row below it. Anchor on that.
- Match the STATUS-BAR-INDEPENDENT title->top-row gap (web preview has no OS status bar; the ref
  phone does — never match absolute Y).
- "Numbers update in jumps": values snap with a subtle scale pop — no incremental count-up.
- Cash-out reuses the same win overlay/end-state as a top-row win.
- Sprite gloss is a plain semi-transparent white rounded View overlaid on apple/core/sprout
  (NOT wood) — low opacity (~0.16) so it reads as a sheen.
- The pill column is column 0 of the same master grid — do not reintroduce per-axis or
  per-column spacing constants.
