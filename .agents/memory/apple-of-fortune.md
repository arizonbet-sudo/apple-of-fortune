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

## Design decisions
- Tiles overlap vertically (~28%) but are spaced horizontally — this packed look is the
  game's signature; keep it if reworking the board.
- Board shows 7 of 9 multiplier rows and auto-scrolls as the player climbs.
- "Numbers update in jumps": values snap to the final amount with a subtle scale pop —
  do NOT add incremental count-up animation.
- Cash-out reuses the same win ("G'alaba!") overlay/end-state as a top-row win.
