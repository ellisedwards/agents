# Lunar Base Theme — Design Spec

## Overview

A new "Lunar Base" theme for Agent Office inspired by Apollo-era realism. Stark grey moon surface, black sky with Earth rise, total desolation. The obelisk becomes the 2001 monolith.

## Decisions

| Question | Choice |
|----------|--------|
| Mood | Apollo Realism — stark, NASA-style, grey/black |
| Fire vessel | Glowing reactor / power core (cyan-blue) |
| Building | Open surface — no walls, desks on regolith |
| Horizon | Flat + Earth rise, no crater rims |
| Border scatter | Just boulders, no tech |

## Theme Properties

### Identity

- `id`: `"lunar-base"`
- `name`: `"Lunar Base"`

### Sky & Time Tints

The moon has no atmosphere — sky is always black. Stars always visible. Time-of-day shifts are subtle.

| Time | Sky Colors | Tint | Opacity |
|------|-----------|------|---------|
| Day | `#080810`, `#0a0a14`, `#0c0c18` | `""` (none) | 0 |
| Dawn | `#0a1020`, `#101828`, `#182030` | `#2244aa` (blue Earth-light) | 0.08 |
| Night | `#040408`, `#06060c`, `#080810` | `#000008` (near-black) | 0.3 |

- `drawStarsAtNight`: true
- `starCount`: 24 (dense — no atmosphere to obscure)

### Background Features

Empty array `[]`. The horizon is flat — just the ground meeting the sky. Earth is rendered separately (see New Code below).

### Ground

Per-pixel noise regolith, cold grey with subtle blue undertone.

- `baseColor1`: `#606068`
- `baseColor2`: `#585860`
- `tileSize`: 1 (per-pixel noise)
- `decorColor`: `#505058` (dark dust specks)
- `decorCount`: 40
- `decorHeight`: 1
- No island property.

### Vegetation

New type: `"boulders"`.

Renders grey lunar rocks of varying sizes. 3 variants:
- Large angular boulder (5-6px wide, 4-5px tall)
- Medium rounded rock (3-4px wide, 3px tall)
- Small pebble cluster (2px wide, 2px tall)

Colors use the vegetation color slots:
- `trunk` / `trunkLight`: used for boulder body / highlight
- `leaf1`-`leaf4`: not used (or used for shadow tones)

Palette:
- `trunk`: `#505058` (boulder body)
- `trunkLight`: `#606068` (top highlight)
- `leaf1`: `#404048` (shadow)
- `leaf2`: `#484850` (mid-shadow)
- `leaf3`: `#585860` (unused)
- `leaf4`: `#606068` (unused)
- `density`: 0.6

### Building

- `style`: `"none"` — open surface, no walls, no floor
- Wall/floor colors set but unused (match regolith for consistency):
  - `wallColor`: `#505058`
  - `wallDark`: `#404048`
  - `wallAccent`: `#585860`
  - `floorColor1`: `#606068`
  - `floorColor2`: `#585860`
  - `floorEdge1`: `#505058`
  - `floorEdge2`: `#484850`

### Fire Vessel — Reactor Core

New style: `"reactor"`.

A metallic grey housing with a glowing cyan-blue energy cell inside. Visually:
- Outer housing: dark metallic rectangle, slightly wider than fireplace
- Inner cell: cyan glow (`#22aacc`) with animated brightness pulse
- Top vent: thin darker strip

Colors:
- `stoneColor`: `#404048` (housing body)
- `stoneBrick`: `#484850` (panel lines)
- `stoneLight`: `#505058` (housing highlight)
- `stoneDark`: `#303038` (housing shadow)
- `interiorColor`: `#22aacc` (reactor glow)
- `interiorDeep`: `#1188aa` (deep glow)
- `mantleColor`: `#383840` (top housing)
- `mantleLight`: `#484850` (top highlight)
- `style`: `"reactor"`

### Glass Panels

`null` — no building, no windows.

### Poster Mount

New style: `"metal-panel"`.

A small metal plate bolted to a thin post/stand. Grey metallic tones.

- `style`: `"metal-panel"`
- `color`: `#505058`
- `colorLight`: `#606068`
- `colorDark`: `#383840`

### Furniture

- `hasGuitar`: false
- `clock`: null
- `plant`: null

### Desk

Metallic grey tones, no chairs.

- `topColor`: `#505058`
- `legColor`: `#383840`
- `chairBack`: `#404048`
- `chairSeat`: `#383840`
- `chairLight`: `#484850`
- `hideChairs`: true

### Obelisk Surrounds

No shrine decorations. The monolith stands alone on the regolith. Optionally render a few "footprint" marks — pairs of slightly darker pixels in a short trail approaching the base. Only for `theme.id === "lunar-base"`.

## New Code Required

### 1. `src/components/scene/themes/lunar-base.ts`
New theme file exporting `lunarBaseTheme: SceneTheme` with all properties above.

### 2. `src/components/scene/themes/index.ts`
Import and add to `ALL_THEMES` array.

### 3. `src/components/store.ts`
Add `"lunar-base"` to `ThemeId` union type and `VALID_THEMES` array.

### 4. `src/components/scene/environment.ts` — Boulders vegetation type
New `drawBoulder` function (similar to `drawForestTree` / `drawPalmTree`). Three variants of grey rocks. Wired into the vegetation drawing logic when `vegetation.type === "boulders"`.

### 5. `src/components/scene/environment.ts` — Earth in sky
Render a small blue-green circle (~6-8px diameter) in the upper portion of the sky. Position fixed, not affected by time-of-day. Subtle glow shadow. Only rendered when `theme.id === "lunar-base"` (or could be driven by a theme property if preferred).

### 6. `src/components/scene/environment.ts` — Reactor fire vessel
New `"reactor"` case in the fire vessel renderer. Metallic rectangular housing with cyan interior glow. The glow can use the existing fire animation frame for subtle pulsing.

### 7. `src/components/scene/environment.ts` — Metal panel poster mount
New `"metal-panel"` case in poster mount renderer. Small grey plate on a thin post.

### 8. `src/components/scene/renderer.ts` — Obelisk footprints (optional)
If `theme.id === "lunar-base"`, draw a few pairs of darker pixels in a trail approaching the obelisk base.
