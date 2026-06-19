---
name: Apple of Fortune game
description: Sprite extraction coords and grid geometry for the Apple of Fortune mobile clone
---

# Apple of Fortune (artifacts/apple-of-fortune)

Multiplier-ladder gambling clone, virtual currency only, no backend, balance in AsyncStorage.
Built from 12 reference screenshots (1080x2340). Keep Uzbek text exactly as in screenshots.

## Sprite source crops (from the 1080-wide screenshots)
- Each sprite saved 160x160, circular-masked, in assets/images/: wood, sprout, apple, core, bg.
- WOOD from screenshot at (615,664); CORE (460,664); APPLE (280,985); SPROUT (615,1160).
- bg = jungle crop 1080x400+0+1610 stretched + blurred.
**Why:** these coords are not derivable from code; re-extracting needs them.

## Grid geometry (the distinctive look)
- 5 columns. Tiles overlap vertically (~28%) but are spaced horizontally.
- Implemented responsively: colPitch = tilesArea/5; tile = colPitch*0.94; pitchY = tile*0.78.
- Lower rows paint in front (render top->bottom). Board window shows 7 of 9 rows; rail
  auto-scrolls via translateY = (bottomVisible-2)*pitchY, bottomVisible = clamp(active-2,0,2).

## Reanimated gotcha
Set shared `.value` (withTiming/withRepeat) inside useEffect, never during render, or the
strict-mode logger floods "Writing/Reading value during component render" warnings.
