# Pallet Town Theme — Design Spec

## Overview
A GBA-era Pokemon overworld theme for Agent Office. Bright greens, warm tan paths, cozy small-town feel inspired by FireRed/LeafGreen's Pallet Town and Route 1.

## Characters (New Sprites)

All sprites use the existing `PixelRect[]` format at ~14x14px with states: idle, typing, reading, thinking, waiting.

### CC Agents (3 new character types)
Assigned by `teamColor` index (0=Charmander, 1=Squirtle, 2=Bulbasaur, 3+=wrap around).

- **Charmander** (`"charmander"`): Orange body, cream belly, flame tail tip. ~14x13px.
- **Squirtle** (`"squirtle"`): Blue body, cream belly, brown shell on back. ~14x13px.
- **Bulbasaur** (`"bulbasaur"`): Teal-green body, darker spots, green bulb on top. ~14x13px.

### OpenClaw Agent
- **Trainer** (`"trainer"`): Red cap, black hair, blue jacket, dark pants. Classic GBA overworld trainer sprite. ~14x14px.

### Subagents
- **Pikachu** (`"pikachu"`): Yellow body, red cheeks, pointy ears, lightning bolt tail. Same sprite for all subagents (no color variants). ~14x13px.

### Pet
- **Jigglypuff** (`"jigglypuff"`): Round pink body, big eyes, tuft of curled hair on top. Small and bouncy. Needs idle, walk1, walk2, sleep, startled states. ~8x8px (smaller like existing pets).

## Theme Config

### Sky & Time
- Day: bright Pokemon blue `#88bbee`, `#99ccee`, `#aaddee`
- Dawn: warm orange tint, `#cc8866`, `#dd9977`, `#eeaa88`
- Night: deep blue, `#1a2244`, `#222a4e`, `#2a3358`
- Stars at night: yes, 10 stars

### Background Features
- Rolling green hills (not sharp mountains), using `shape: "mountain"` with wide halfWidth and green colors
- 3 hills: gentle peaks, `bodyColor: "#5a9a55"`, `capColor: null`

### Ground
- Tan/sandy path tiles (GBA dirt path): `baseColor1: "#d4c8a0"`, `baseColor2: "#ccc098"`
- Tile size: 8
- Grass tuft decorations: `decorColor: "#6aaa55"`, short decorHeight

### Vegetation
- Type: `"trees"` (round/puffy GBA-style — the existing tree renderer works, just needs rounder/brighter colors)
- Bright greens: trunk `#665533`, leaves `#2a8833`, `#3aaa44`, `#44cc55`, `#55dd66`
- Density: 1.2

### Building
- Style: `"walled"` — Pokemon Center inspired
- Wall: cream/white `#f0e8d8`, dark `#e0d8c8`, accent `#e8e0d0`
- Floor: warm wood tones `#8a7a60`, `#887858`
- Red roof detail drawn via wall accent

### Fire Vessel
- Style: `"fire-pit"` — campfire on the ground
- Stone colors: grey fieldstone tones

### Glass Panels
- `null` — open air, no windows

### Poster Mount
- Style: `"wooden-sign"` — rustic Pokemon sign post

### Guitar Area
- `hasGuitar: false`
- Instead: tall grass patches and a wooden fence section (drawn in environment.ts golden-ruins style theme block)

### Monolith Surrounds (renderer.ts)
- Tall grass patches (`#3a8833`, `#44aa44`) arranged around the base
- Small wooden sign post to one side
- No stones/ruins — organic Pokemon feel

### Monolith Effect
- Style: `"haze"`, color: `#44cc66"` (green shimmer), speed: 6
- Only visible during materialize/dematerialize transition

### Desk
- Light wood Pokemon Center desk: `topColor: "#c8b888"`, `legColor: "#aa9060"`
- Chair: warm brown tones

### Skins Config
```typescript
skins: {
  agent: "starter",     // resolved to charmander/squirtle/bulbasaur by teamColor
  openclaw: "trainer",
  subagent: "pikachu",  // no color suffix needed
}
```

### Pet
- `petType: "jigglypuff"`

## Implementation Notes

### Skin Resolution for CC Agents
The skins system currently maps `agent` to a single CharacterType. For rotating starters, we need a small extension: when `skins.agent === "starter"`, the renderer picks from `["charmander", "squirtle", "bulbasaur"]` based on `agent.teamColor % 3`.

### Pikachu Subagent
Since `skins.subagent = "pikachu"`, the renderer will try `pikachu-0`, `pikachu-1`, etc. We need to handle this: when the subagent prefix resolves to `pikachu-*`, always use the base `pikachu` sprite (no color variants).

### Files to Create
1. `src/components/characters/charmander.ts`
2. `src/components/characters/squirtle.ts`
3. `src/components/characters/bulbasaur.ts`
4. `src/components/characters/trainer.ts`
5. `src/components/characters/pikachu.ts`
6. `src/components/characters/jigglypuff.ts`
7. `src/components/scene/themes/pallet-town.ts`

### Files to Modify
1. `src/components/characters/sprite-cache.ts` — register new character types
2. `src/components/scene/themes/index.ts` — register theme
3. `src/components/scene/themes/types.ts` — add "jigglypuff" to petType union
4. `src/components/store.ts` — add "pallet-town" to ThemeId
5. `src/components/overlay/agent-labels.tsx` — add theme option to dropdown
6. `src/components/scene/renderer.ts` — handle "starter" skin rotation + "pikachu" subagent (no color suffix) + monolith surrounds for pallet-town
7. `src/components/scene/environment.ts` — pallet-town decorations (tall grass, fences) in the guitar/activity area
