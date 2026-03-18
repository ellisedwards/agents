# Lucky Pokeball & Critical Hits

## Goal

Add two EXP bonus mechanics to game mode: a "lucky pokeball" gambling event with a Price-is-Right style wheel, and random critical hits on tool uses. Both reward EXP — no new currencies.

## Lucky Pokeball

### Trigger
- Random, every 10-15 minutes while game mode is on and at least one CC agent is at a desk
- A random desk-bound agent's pokeball begins a special animation
- Test trigger available in settings panel (forces one to appear immediately)

### Pokeball Animation (canvas layer)
The pokeball needs to visually demand attention while fitting the pixel world:
- **Wobble/shake**: pokeball sprite rocks back and forth (2-3px oscillation)
- **Sparkle particles**: small star/glimmer pixels pop in and out around the pokeball, gold/white
- **Color pulse**: pokeball glows brighter and dims rhythmically with a gold tint overlay

All rendered on the canvas so it feels like part of the game world.

### Click Window
- 30 seconds to click the glowing pokeball
- If missed, animation fades out quietly and the opportunity is gone
- Click detected via the existing hover/click system in agent-labels (canvas coordinate hit test)

### The Wheel (HTML overlay)
Price-is-Right style spinning wheel:
- Appears as a centered HTML overlay styled to feel retro/cohesive with the pixel world (chunky segments, pixel-style font, not clean modern UI)
- Single vertical wheel with segments, spinning and decelerating with tick-tick-tick feel
- Segments (weighted):
  - **2x** — ~40% of segments, standard color
  - **3x** — ~25%, slightly brighter
  - **5x** — ~20%, distinct color
  - **10x** — ~10%, gold
  - **JACKPOT 50x** — ~5%, one segment, flashy gold/rainbow
- Deceleration curve makes near-misses possible and exciting
- Result displayed for 2-3 seconds with a flash in the agent's team color
- Jackpot triggers a special celebration: claw sparkle on the agent's slot + screen-wide particle burst

### Reward
- The multiplier applies to that agent's next 10 tool uses
- Bonus EXP accumulates visibly (the floating +EXP numbers show the boosted amounts)
- A small indicator on the agent's HUD row shows the active multiplier and remaining uses (e.g., "5x (7 left)")
- Multipliers do NOT stack with each other (new lucky pokeball replaces existing multiplier)
- Multipliers DO stack with critical hits

## Critical Hits

### Trigger
- ~5% chance on any tool use (Bash, Read, Edit, Write, etc.)
- Independent per action, pure random

### Effect
- 5x EXP for that single action

### Visual
Subtle, not disruptive:
- The floating `+EXP` text renders larger and gold instead of white
- A brief gold flash on just the pokeball (2-3 frames)
- No screen shake, no big overlay

### Stacking
- Crits during a lucky pokeball window stack multiplicatively: 5x crit * 10x lucky = 50x for that action
- This is rare but possible and should feel amazing when it happens

## Settings Panel
- Add "Lucky Pokeball" button in the Triggers section (next to startle, float, ufo)
- Clicking it forces a lucky pokeball event on a random desk-bound agent immediately

## Data Model

### EXP Tracker Changes (`src/server/agents/exp-tracker.ts`)
- Add `critChance: number` (default 0.05) to config
- Add `critMultiplier: number` (default 5)
- On each EXP award, roll for crit. If hit, multiply base EXP by critMultiplier
- Track active lucky multiplier per agent: `{ multiplier: number, usesLeft: number }`

### Store Changes (`src/components/store.ts`)
- Add `luckyMultipliers: Map<string, { multiplier: number; usesLeft: number }>` to agent state or a separate store slice
- Add `triggerLuckyPokeball()` action

### Agent State (`src/shared/types.ts`)
- Add optional `luckyMultiplier?: { multiplier: number; usesLeft: number }` to AgentState
- Add optional `isCrit?: boolean` to EXP gain events

## Files

| File | Change |
|------|--------|
| `src/components/scene/renderer.ts` | Pokeball wobble/sparkle/pulse animation for active lucky events |
| `src/components/overlay/agent-labels.tsx` | Click handler for lucky pokeball, wheel overlay component, multiplier indicator in HUD, test trigger button |
| `src/server/agents/exp-tracker.ts` | Crit roll on EXP award, lucky multiplier tracking and countdown |
| `src/components/store.ts` | Lucky multiplier state, triggerLuckyPokeball action |
| `src/shared/types.ts` | luckyMultiplier and isCrit fields |

## Not Included (future features)
- Cat tamagotchi / pet care mechanics
- Rare spawn visitors (needs more sprites)
- New currencies or items
