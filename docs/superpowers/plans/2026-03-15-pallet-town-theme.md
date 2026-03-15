# Pallet Town Theme Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a GBA-era Pokemon overworld theme with custom character sprites (Charmander, Squirtle, Bulbasaur as CC agents, Trainer as OpenClaw, Pikachu as subagents, Jigglypuff as pet).

**Architecture:** 6 new character sprite files + 1 theme config file. Extend sprite-cache to register them, extend renderer to handle "starter" skin rotation and pikachu (no-color-variant) subagents. Add monolith surrounds and environment decorations for the theme.

**Tech Stack:** TypeScript, Canvas 2D pixel art (PixelRect arrays)

---

## Task 1: Charmander sprite

**Files:**
- Create: `src/components/characters/charmander.ts`

- [ ] **Step 1: Create charmander.ts**

```typescript
import type { AgentSpriteState } from "@/shared/types";
import type { PixelRect } from "./clawd";

export const CHARMANDER_WIDTH = 14;
export const CHARMANDER_HEIGHT = 14;

const BODY = "#e87830";
const BODY_LT = "#f09048";
const BELLY = "#f8d878";
const EYE = "#1a1a2e";
const FLAME = "#ff4422";
const FLAME_TIP = "#ffcc44";

const body: PixelRect[] = [
  // Head
  { x: 4, y: 0, w: 6, h: 5, color: BODY },
  { x: 3, y: 1, w: 8, h: 4, color: BODY },
  { x: 5, y: 0, w: 4, h: 4, color: BODY_LT },
  // Eyes
  { x: 5, y: 2, w: 1, h: 2, color: EYE },
  { x: 8, y: 2, w: 1, h: 2, color: EYE },
  // Body
  { x: 4, y: 5, w: 6, h: 4, color: BODY },
  { x: 5, y: 5, w: 4, h: 3, color: BELLY },
  // Arms
  { x: 2, y: 5, w: 2, h: 2, color: BODY },
  { x: 10, y: 5, w: 2, h: 2, color: BODY },
  // Legs
  { x: 4, y: 9, w: 2, h: 3, color: BODY },
  { x: 8, y: 9, w: 2, h: 3, color: BODY },
  // Tail with flame
  { x: 11, y: 7, w: 1, h: 3, color: BODY },
  { x: 12, y: 6, w: 1, h: 2, color: BODY },
  { x: 12, y: 5, w: 1, h: 1, color: FLAME },
  { x: 13, y: 4, w: 1, h: 2, color: FLAME_TIP },
];

const typingBody: PixelRect[] = [
  { x: 4, y: 0, w: 6, h: 5, color: BODY },
  { x: 3, y: 1, w: 8, h: 4, color: BODY },
  { x: 5, y: 0, w: 4, h: 4, color: BODY_LT },
  // >_< eyes
  { x: 5, y: 2, w: 1, h: 1, color: EYE },
  { x: 6, y: 3, w: 1, h: 1, color: EYE },
  { x: 5, y: 4, w: 1, h: 1, color: EYE },
  { x: 8, y: 2, w: 1, h: 1, color: EYE },
  { x: 7, y: 3, w: 1, h: 1, color: EYE },
  { x: 8, y: 4, w: 1, h: 1, color: EYE },
  { x: 4, y: 5, w: 6, h: 4, color: BODY },
  { x: 5, y: 5, w: 4, h: 3, color: BELLY },
  // Arms forward
  { x: 1, y: 4, w: 3, h: 2, color: BODY },
  { x: 10, y: 4, w: 3, h: 2, color: BODY },
  { x: 4, y: 9, w: 2, h: 3, color: BODY },
  { x: 8, y: 9, w: 2, h: 3, color: BODY },
  { x: 11, y: 7, w: 1, h: 3, color: BODY },
  { x: 12, y: 6, w: 1, h: 2, color: BODY },
  { x: 12, y: 5, w: 1, h: 1, color: FLAME },
  { x: 13, y: 4, w: 1, h: 2, color: FLAME_TIP },
];

export const CHARMANDER_SPRITES: Record<AgentSpriteState, PixelRect[]> = {
  idle: body,
  typing: typingBody,
  reading: [
    { x: 4, y: 0, w: 6, h: 5, color: BODY },
    { x: 3, y: 1, w: 8, h: 4, color: BODY },
    { x: 5, y: 0, w: 4, h: 4, color: BODY_LT },
    // Half-lidded eyes
    { x: 5, y: 3, w: 2, h: 1, color: EYE },
    { x: 7, y: 3, w: 2, h: 1, color: EYE },
    { x: 4, y: 5, w: 6, h: 4, color: BODY },
    { x: 5, y: 5, w: 4, h: 3, color: BELLY },
    { x: 2, y: 5, w: 2, h: 2, color: BODY },
    { x: 10, y: 5, w: 2, h: 2, color: BODY },
    { x: 4, y: 9, w: 2, h: 3, color: BODY },
    { x: 8, y: 9, w: 2, h: 3, color: BODY },
    { x: 11, y: 7, w: 1, h: 3, color: BODY },
    { x: 12, y: 6, w: 1, h: 2, color: BODY },
    { x: 12, y: 5, w: 1, h: 1, color: FLAME },
    { x: 13, y: 4, w: 1, h: 2, color: FLAME_TIP },
  ],
  thinking: body,
  waiting: [
    { x: 4, y: 0, w: 6, h: 5, color: BODY },
    { x: 3, y: 1, w: 8, h: 4, color: BODY },
    { x: 5, y: 0, w: 4, h: 4, color: BODY_LT },
    // Wide eyes with glint
    { x: 5, y: 2, w: 2, h: 2, color: EYE },
    { x: 7, y: 2, w: 2, h: 2, color: EYE },
    { x: 6, y: 2, w: 1, h: 1, color: BODY_LT },
    { x: 8, y: 2, w: 1, h: 1, color: BODY_LT },
    { x: 4, y: 5, w: 6, h: 4, color: BODY },
    { x: 5, y: 5, w: 4, h: 3, color: BELLY },
    { x: 2, y: 5, w: 2, h: 2, color: BODY },
    { x: 10, y: 4, w: 2, h: 2, color: BODY },
    { x: 12, y: 2, w: 1, h: 2, color: BODY },
    { x: 4, y: 9, w: 2, h: 3, color: BODY },
    { x: 8, y: 9, w: 2, h: 3, color: BODY },
    { x: 11, y: 7, w: 1, h: 3, color: BODY },
    { x: 12, y: 6, w: 1, h: 2, color: BODY },
    { x: 12, y: 5, w: 1, h: 1, color: FLAME },
    { x: 13, y: 4, w: 1, h: 2, color: FLAME_TIP },
  ],
};
```

- [ ] **Step 2: Commit**

```bash
git add src/components/characters/charmander.ts
git commit -m "feat: add charmander sprite"
```

---

## Task 2: Squirtle sprite

**Files:**
- Create: `src/components/characters/squirtle.ts`

- [ ] **Step 1: Create squirtle.ts**

Same pattern as charmander — blue body `#5090d0`, lighter belly `#b8d8f0`, brown shell accent `#aa8844`, dark eyes. Tail is a small curled blue nub. All 5 states (idle, typing, reading, thinking, waiting).

- [ ] **Step 2: Commit**

```bash
git add src/components/characters/squirtle.ts
git commit -m "feat: add squirtle sprite"
```

---

## Task 3: Bulbasaur sprite

**Files:**
- Create: `src/components/characters/bulbasaur.ts`

- [ ] **Step 1: Create bulbasaur.ts**

Teal-green body `#58a888`, darker spots `#408868`, green bulb on top `#3a8833` with lighter highlight `#44aa44`. All 5 states.

- [ ] **Step 2: Commit**

```bash
git add src/components/characters/bulbasaur.ts
git commit -m "feat: add bulbasaur sprite"
```

---

## Task 4: Trainer sprite (OpenClaw)

**Files:**
- Create: `src/components/characters/trainer.ts`

- [ ] **Step 1: Create trainer.ts**

Red cap `#cc3333`, black hair `#222222`, skin `#f0c8a0`, blue jacket `#3366cc`, dark pants `#333344`, shoes `#222222`. Classic GBA overworld proportions. All 5 states.

- [ ] **Step 2: Commit**

```bash
git add src/components/characters/trainer.ts
git commit -m "feat: add trainer sprite"
```

---

## Task 5: Pikachu sprite (Subagent)

**Files:**
- Create: `src/components/characters/pikachu.ts`

- [ ] **Step 1: Create pikachu.ts**

Yellow body `#f8d030`, red cheeks `#cc3333`, brown stripes on back `#aa7722`, black ear tips `#222222`, pointy ears. Lightning bolt tail shape with brown base `#aa7722`. All 5 states + walk1/walk2 for wandering.

- [ ] **Step 2: Commit**

```bash
git add src/components/characters/pikachu.ts
git commit -m "feat: add pikachu sprite"
```

---

## Task 6: Jigglypuff sprite (Pet)

**Files:**
- Create: `src/components/characters/jigglypuff.ts`

- [ ] **Step 1: Create jigglypuff.ts**

Small ~8x8 like existing pets. Round pink body `#ffaacc`, big blue eyes `#4488cc`, tuft of curled hair `#ff88aa` on top. States: idle, walk1, walk2, sleep, startled.

- [ ] **Step 2: Commit**

```bash
git add src/components/characters/jigglypuff.ts
git commit -m "feat: add jigglypuff sprite"
```

---

## Task 7: Register all sprites in sprite-cache

**Files:**
- Modify: `src/components/characters/sprite-cache.ts`

- [ ] **Step 1: Add imports**

Add imports for all 6 new character files at the top of sprite-cache.ts.

- [ ] **Step 2: Extend CharacterType union**

```typescript
export type CharacterType = "clawd" | "claw" | `mage-${MageColorIndex}` | "cat" | "sphynx" | "gecko" | "space-cat"
  | "charmander" | "squirtle" | "bulbasaur" | "trainer" | "pikachu" | "jigglypuff";
```

- [ ] **Step 3: Register in buildSpriteCache**

Add cache entries for all 6 characters (5 agent states each) + walk frames for pikachu + pet states for jigglypuff. Follow the existing pattern used for clawd/claw/cat.

- [ ] **Step 4: Commit**

```bash
git add src/components/characters/sprite-cache.ts
git commit -m "feat: register pokemon sprites in sprite cache"
```

---

## Task 8: Create pallet-town theme config

**Files:**
- Create: `src/components/scene/themes/pallet-town.ts`

- [ ] **Step 1: Create theme file**

Full SceneTheme config using values from the spec:
- `id: "pallet-town"`, `name: "Pallet Town"`
- GBA-style sky colors, green hills, tan ground, bright tree colors
- Walled building with cream/white walls, warm wood floor
- Fire-pit style campfire, wooden-sign poster mount
- `hasGuitar: false`, `glassPanel: null`
- `skins: { agent: "starter", openclaw: "trainer", subagent: "pikachu" }`
- `petType: "jigglypuff"`
- `monolithEffect: { style: "haze", color: "#44cc66", speed: 6 }`

- [ ] **Step 2: Commit**

```bash
git add src/components/scene/themes/pallet-town.ts
git commit -m "feat: add pallet town theme config"
```

---

## Task 9: Register theme + types

**Files:**
- Modify: `src/components/scene/themes/types.ts` — add `"jigglypuff"` to petType union
- Modify: `src/components/scene/themes/index.ts` — import and register pallet-town
- Modify: `src/components/store.ts` — add `"pallet-town"` to ThemeId and VALID_THEMES

- [ ] **Step 1: Add jigglypuff to petType**

In `types.ts`, change petType line to include `"jigglypuff"`.

- [ ] **Step 2: Register in index.ts**

Add import and add to ALL_THEMES array.

- [ ] **Step 3: Add to store.ts**

Add `"pallet-town"` to ThemeId union and VALID_THEMES array.

- [ ] **Step 4: Commit**

```bash
git add src/components/scene/themes/types.ts src/components/scene/themes/index.ts src/components/store.ts
git commit -m "feat: register pallet town theme in types, index, and store"
```

---

## Task 10: Skin resolution in renderer

**Files:**
- Modify: `src/components/scene/renderer.ts`

- [ ] **Step 1: Handle "starter" skin rotation**

In the charType resolution block (~line 925), when `skins?.agent === "starter"`, pick from `["charmander", "squirtle", "bulbasaur"]` based on `agent.teamColor % 3`:

```typescript
if (agent.subagentClass !== null && agent.subagentClass !== undefined) {
  const prefix = skins?.subagent ?? "mage";
  // Pikachu: no color suffix needed
  charType = (prefix === "pikachu" ? "pikachu" : `${prefix}-${agent.subagentClass}`) as CharacterType;
} else if (agent.source === "openclaw") {
  charType = (skins?.openclaw ?? "claw") as CharacterType;
} else {
  const agentSkin = skins?.agent ?? "clawd";
  if (agentSkin === "starter") {
    const starters: CharacterType[] = ["charmander", "squirtle", "bulbasaur"];
    charType = starters[agent.teamColor % starters.length];
  } else {
    charType = agentSkin as CharacterType;
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/scene/renderer.ts
git commit -m "feat: handle starter rotation and pikachu subagent skins"
```

---

## Task 11: Monolith surrounds for pallet-town

**Files:**
- Modify: `src/components/scene/renderer.ts` — add pallet-town block in `drawMonolithSurrounds`

- [ ] **Step 1: Add tall grass and sign post**

In `drawMonolithSurrounds`, add a `theme.id === "pallet-town"` block with:
- Tall grass patches (dark green `#3a8833`, light green `#44aa44`, bright tips `#55cc55`) arranged around the monolith base
- Small wooden sign post to the right side (brown post `#665533`, sign board `#aa9060`)

- [ ] **Step 2: Commit**

```bash
git add src/components/scene/renderer.ts
git commit -m "feat: pallet town monolith surrounds"
```

---

## Task 12: Environment decorations for pallet-town

**Files:**
- Modify: `src/components/scene/environment.ts`

- [ ] **Step 1: Add pallet-town activity area**

In the theme-specific decoration section (after the golden-ruins block, before tropical-island), add a `theme.id === "pallet-town"` block with:
- Tall grass patch area (the Pokemon-style dark grass where wild encounters happen)
- A small wooden fence section (3-4 posts with horizontal rail)
- Positioned where the guitar/amp would be on forest theme

- [ ] **Step 2: Commit**

```bash
git add src/components/scene/environment.ts
git commit -m "feat: pallet town environment decorations"
```

---

## Task 13: Build and verify

- [ ] **Step 1: Build**

```bash
npm run build
```

Expected: clean build, no errors.

- [ ] **Step 2: Test in browser**

Cmd+Shift+R, switch to Pallet Town theme in Settings. Verify:
- Green hills background, tan ground, bright trees
- Pokemon Center-style building
- Charmander/Squirtle/Bulbasaur as CC agents (rotating)
- Trainer as OpenClaw agent
- Jigglypuff as pet
- Monolith with tall grass surrounds
- Campfire works
- Time of day tinting works
- Laptop glow works
- Materialize effect with green shimmer

- [ ] **Step 3: Final commit**

```bash
git add -A
git commit -m "feat: pallet town theme complete"
```
