# Game Mode: Agent EXP & Leveling System

## Overview

A toggleable "Game Mode" that turns agent activity into a Final Fantasy-inspired EXP/leveling system. Agents earn EXP by using tools, spawn subagents, and maintain activity streaks. Levels unlock titles, golden pokeball evolution, and celebration effects including Yeelight sparkles. When an agent session ends, its progress dies with it.

## Toggle

- Settings panel: "Game Mode" on/off switch
- Stored in zustand store + localStorage (persists across reloads)
- When OFF: no EXP tracking, no bars, no effects — completely invisible
- When toggled ON mid-session: all agents start at Lv1 with 0 EXP (no retroactive calculation)
- When toggled OFF: all EXP data is discarded immediately

## EXP System (Server-Side)

### Location
All EXP logic lives in `src/server/agents/exp-tracker.ts` — a new module imported by cc-watcher.

### EXP Awards

| Action | Base EXP | Notes |
|--------|----------|-------|
| Write / Edit | 15 | Core productive work |
| Bash | 10 | Running builds, tests, commands |
| Read / Grep / Glob | 5 | Research and exploration |
| Agent spawn | 20 | Summoning subagents |
| Thinking (text gen) | 3 | Active but no tool output |
| WebFetch / WebSearch | 8 | External information gathering |

### Bonuses

| Bonus | EXP | Condition |
|-------|-----|-----------|
| First Blood | +5 | First tool use of a session |
| Streak | +10 | 5+ consecutive minutes of activity |
| Speed Combo | +5 | 3+ tools within 10 seconds |
| Rivalry Spark | +2/tick | Two+ agents both typing simultaneously |
| Critical Hit | 2x | Random 10% chance on any award |
| Subagent EXP Share | 50% | Parent gets half of subagent's earned EXP |

### Leveling Curve

- Level 1→2: 100 EXP
- Each subsequent level: `Math.floor(previous * 1.5)`
- Level 2→3: 150, Level 3→4: 225, Level 4→5: 337, Level 5→6: 506, ...
- EXP resets to 0 within each level (bar fills 0→100% then resets)
- Starting level: 1

### Data Model

```typescript
interface AgentExpData {
  exp: number;          // Current EXP within level
  level: number;        // Current level (starts at 1)
  expToNext: number;    // EXP required for next level
  totalExp: number;     // Lifetime EXP earned this session
  streak: boolean;      // Currently on activity streak
  toolCounts: Record<string, number>;  // Per-tool usage counts
  lastToolTime: number; // Timestamp of last tool use (for speed combo)
  recentTools: number[];// Timestamps of recent tools (for speed combo, keep last 10)
  firstBloodAwarded: boolean;
}
```

### AgentState Extension

Add to the existing `AgentState` interface in `src/shared/types.ts`:

```typescript
// Only present when game mode is ON
exp?: number;
level?: number;
expToNext?: number;
streak?: boolean;
title?: string;
toolMasteries?: string[];  // Tool names with 20+ uses
```

### Server Implementation Details

- `exp-tracker.ts` exports a class `ExpTracker` with methods:
  - `onToolUse(agentId, toolName, allAgents)` — main EXP award logic
  - `onThinking(agentId)` — award thinking EXP
  - `getExpData(agentId)` — returns current EXP state
  - `clearAgent(agentId)` — remove agent data on departure
  - `clearAll()` — wipe all data (for clr button)
  - `isGameMode()` — check if game mode is active
- cc-watcher calls `onToolUse` when it detects a tool change
- ExpTracker maintains a `Map<string, AgentExpData>`
- Game mode state communicated via a new API endpoint:
  - `POST /api/game-mode` with body `{ enabled: boolean }` — toggle
  - `GET /api/game-mode` — current state
- When game mode is OFF, ExpTracker skips all calculations

### Guard Rails

- Tool name `null` → no EXP awarded
- Agent in `lounging` or `departing` state → no EXP awarded
- Subagent EXP share: if parent not found → skip silently, don't error
- `clr` button calls `clearAll()` on ExpTracker
- Agent IDs are long file paths — use them as-is for map keys, they're stable within a session
- Streak detection: track `lastActivityTimestamp` per agent, streak=true when gap between activities < 30 seconds for 5+ minutes continuously
- Speed combo: check if 3+ entries in `recentTools` array fall within a 10-second window
- Critical hit: `Math.random() < 0.1` on each award, doubles the base EXP (not bonuses)

## Level Titles

```typescript
const LEVEL_TITLES: Record<number, string> = {
  1: "Fresh Spawn",
  3: "Script Kiddie",
  5: "Journeyman",
  8: "Code Wizard",
  10: "Gigachad",
  13: "Archmage",
  15: "Final Boss",
  20: "Ascended",
};
// Use highest matching: Lv12 agent gets "Gigachad" (from Lv10)
```

## Tool Mastery Titles (20+ uses)

```typescript
const TOOL_MASTERY: Record<string, string> = {
  "Bash": "Shell Lord",
  "Write": "Ink Slinger",
  "Edit": "Ink Slinger",
  "Read": "Tome Reader",
  "Grep": "Treasure Hunter",
  "Glob": "Treasure Hunter",
  "Agent": "Summoner",
  "WebFetch": "Oracle",
  "WebSearch": "Oracle",
};
```

## Visual: Canvas EXP Bar

### Bar under character (at desk)
- Position: below pokeball, horizontally centered with it
- Size: 12px wide, 1px tall
- Filled portion: solid team color (from `TEAM_COLORS[agent.teamColor]`)
- Unfilled portion: same team color at 20% opacity
- Only visible when agent has earned any EXP (hidden at 0 total)
- Hidden when agent is lounging/wandering (no desk position)
- Fill = `exp / expToNext`

### Streak indicator
- When streak is active: render a tiny 2-pixel flame shape above the EXP bar in orange (#ff8844)
- Flame flickers by alternating between 2 pixel patterns every 8 frames

## Visual: Level-Up Celebration

When an agent crosses the level threshold, fire ALL of these simultaneously:

### Screen flash
- White overlay at 15% opacity, fades out over 200ms (~12 frames at 60fps)
- Applied as a full-canvas `fillRect` with decreasing alpha

### Rising text
- "LEVEL UP!" in gold (#ffcc44) pixel font, 5px size
- Starts at agent's Y position, floats up 20px over 60 frames (1 second)
- Fades from 100% to 0% opacity over the same duration
- Text shadow for readability: 1px black outline

### Sparkle burst
- 15 particles (more than the standard poof's 10)
- Colors: team color + gold (#ffcc44) + white (#ffffff) alternating
- Expand outward from agent position, fade over 40 frames
- Slightly larger particle size than poof (2-3px vs 1-2px)

### Pokeball flash
- The pokeball does a white→gold color cycle over 20 frames
- Override the normal pokeball colors briefly, then restore

### Status bar pulse
- The agent's status bar section background briefly glows team color at 30% opacity
- Fades over 500ms

## Visual: Golden Pokeball

### Level 10+ ("Gigachad")
- Pokeball top half: red (#cc2222) replaced with gold gradient (#cc8800 base, #ffcc44 highlight)
- Highlight row shifts from #dd3333 to #ddaa22

### Level 20+ ("Ascended")
- Entire pokeball goes gold:
  - Top half: #cc8800 base, #ddaa22 highlight
  - Bottom half: #ddaa22 base, #ccaa00 shadow
- 1-pixel shimmer: one pixel cycles through brighter gold shades every 12 frames

### Theme constraint
- Golden pokeball only renders in themes with pokeball desks (pallet-town, pokemoon)
- Other themes: no pokeball evolution (EXP bar and other effects still work)

## Agent Names (Game Mode)

When game mode is ON, CC agents get fun curated names instead of "cc-1", "cc-4", etc.

### Name Pool
```typescript
const AGENT_NAMES = [
  "Ember", "Pixel", "Volt", "Nimbus", "Hex", "Rune",
  "Glyph", "Flux", "Onyx", "Nova", "Byte", "Sage",
  "Drift", "Spark", "Wren", "Echo", "Zephyr", "Ash",
  "Cosmo", "Fable", "Jinx", "Mochi", "Pip", "Quill",
];
```

### Assignment
- Assigned on first detection in cc-watcher, stored in ExpTracker alongside EXP data
- Sticky for the session — same agent keeps its name
- No duplicates until all names are used, then wraps with suffix ("Ember II")
- Added to AgentState as `gameName?: string`
- Claw agent keeps "claw-main" — not renamed
- Subagents not renamed (they're transient)
- When game mode is OFF, original "cc-1" names shown as usual

## Visual: Labels in Game Mode

### Labels ON + Game Mode ON
```
    [Tool Label]              ← above character (existing, unchanged)

        🔥 Sprite             ← character sprite, flame if streak active

    Ember "Shell Lord"        ← fun name + highest active title (level or mastery)
    ██████░░░░ Lv5            ← EXP bar + level number, team colored
```

- Title shown: prefer tool mastery title if any, otherwise level title
- Bar is wider here than canvas bar: ~20px, 2px tall
- Level number in small text right of bar

### Labels ON + Game Mode OFF
```
    cc-1                      ← name only (current behavior, no d/s info)
```

### d/s info (desk/slot)
- ONLY shown when Debug mode is ON
- Never shown in label mode alone

## Visual: Status Bar

### Per-agent display (game mode ON)
Each CC agent gets a section in the status bar:

```
● Ember Lv5  ██████████░░░░░░
```

- Colored dot (team color, existing)
- Agent name
- Level number
- EXP bar: 3px tall, ~40px wide, team colored
- Bar has depth: top 2px = team color, bottom 1px = darker shade (team color at 60% brightness) for bevel effect
- On level-up: bar section pulses with team color glow for 500ms

### Session record (localStorage)
- Track highest level ever reached in `localStorage` key `game-mode-record`
- Show a tiny crown/star indicator next to the agent that currently holds or matches the record
- Persists across sessions (the one persistent element)

## Yeelight Level-Up Sparkle

### Trigger
When an agent levels up AND has an assigned quadrant slot:

### Effect
- Push a sparkle pattern to the agent's 4 quadrant pixels
- Each pixel gets a different bright color: gold (#FFD700), white (#FFFFFF), magenta (#FF00FF), cyan (#00FFFF)
- Hold for 500ms, then cycle to a new random arrangement
- After 1.5 seconds total (3 cycles), restore original quadrant colors

### Implementation
- New function `triggerLevelUpSparkle(slotIndex)` in server.ts
- Uses `clawGet` to POST pixel colors to the claw
- Fires asynchronously, does not block level-up celebration on client
- Fails silently if claw unreachable (curl timeout)

### Guard Rails
- Rate limit: 5-second cooldown per quadrant (ignore level-up sparkle if one fired recently)
- Agent without assigned slot: skip Yeelight sparkle entirely
- Multiple agents leveling up simultaneously: each fires independently on their own quadrant

## API Changes

### New endpoints
- `GET /api/game-mode` → `{ enabled: boolean, record: number }`
- `POST /api/game-mode` → body `{ enabled: boolean }`, returns `{ ok: true }`

### Modified: AgentState SSE
When game mode is ON, each agent in the SSE stream includes the optional EXP fields. When OFF, these fields are omitted.

## File Structure

### New files
- `src/server/agents/exp-tracker.ts` — all EXP/level logic
- `src/shared/game-constants.ts` — EXP tables, titles, mastery names (shared between server and client)

### Modified files
- `src/shared/types.ts` — extend AgentState with optional EXP fields
- `src/server/agents/cc-watcher.ts` — call ExpTracker on tool changes
- `src/server/agents/watcher-singleton.ts` — pass clearAll to ExpTracker
- `src/server/server.ts` — new game-mode endpoints
- `src/components/store.ts` — gameModeOn state + toggle
- `src/components/scene/renderer.ts` — EXP bar, golden pokeball, level-up effects, streak flame
- `src/components/overlay/agent-labels.tsx` — game mode label layout, title display
- `src/components/overlay/status-bar.tsx` — per-agent EXP bars, level display, record crown
- `src/components/scene/environment.ts` — golden pokeball rendering variant

## Testing Approach

- Manual: toggle game mode on, watch agents earn EXP as they work
- Verify level-up fires correctly by temporarily lowering EXP thresholds
- Verify golden pokeball at Lv10 by manually setting level via console
- Verify Yeelight sparkle by watching the physical tower during level-up
- Verify clr wipes EXP data
- Verify game mode OFF hides everything cleanly
- Verify agent departure cleans up EXP data without errors
