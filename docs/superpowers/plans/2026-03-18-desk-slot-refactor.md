# Desk/Slot Assignment Refactor

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace fragile dual-map desk/slot system with a single source of truth, correct slot→desk mapping, and one computation per frame.

**Architecture:** One module (`desk-layout.ts`) owns all assignment state. It takes claw's `slotsDetail` directly, matches agents by exact `session_id`, maps claw slots to desks via a lookup table (skipping desk 2), and exposes both desk positions and slot numbers through a single result object. Renderer and overlay components read from a cached result — no independent `assignDesks` calls, no `stickyQuadrants`.

**Tech Stack:** TypeScript, React (Zustand store consumers)

---

## Background

### The Problem

Two independent in-memory maps track the same concept (which agent sits where):

- `stickyDesks` in `desk-layout.ts` — determines physical desk position
- `stickyQuadrants` in `renderer.ts` — determines claw quadrant / debug label

They have separate assignment logic, separate cleanup, separate fallbacks, and can diverge. Three components independently call `assignDesks()` mutating shared module state. Fuzzy substring matching can match the wrong agent. The slot→desk mapping assumes slot N = desk N, which conflicts with desk 2 being reserved for the trainer.

### The Correct Model

```
6 physical desks: 0(FL) 1(FC) 2(FR) 3(BL) 4(BC) 5(BR)
4 claw quadrants: 0(BL) 1(BR) 2(TL) 3(TR)

Desk 2 = trainer (openclaw-main). ALWAYS. No CC agent can sit here.

Claw slot → Desk mapping (SLOT_TO_DESK):
  Claw slot 0 → Desk 0
  Claw slot 1 → Desk 1
  Claw slot 2 → Desk 3  (skip desk 2)
  Claw slot 3 → Desk 4

CC fill order (no claw slot): 0, 1, 3, 4, 5  (skip desk 2)
Desk 5 = overflow CC, no claw quadrant.

Inverse (DESK_TO_SLOT):
  Desk 0 → Slot 0
  Desk 1 → Slot 1
  Desk 3 → Slot 2
  Desk 4 → Slot 3
  Desk 2, 5 → no slot
```

### What Changes

| File | Change |
|------|--------|
| `src/components/scene/desk-layout.ts` | Rewrite: single source of truth with slot→desk mapping, exact matching, returns `AssignmentResult` |
| `src/components/scene/renderer.ts` | Delete `stickyQuadrants` and all related code. Use cached assignment result. |
| `src/components/overlay/agent-labels.tsx` | Read from cached result instead of calling `assignDesks` + `getSlotMap` |
| `src/components/overlay/speech-bubble.tsx` | Read from cached result instead of calling `assignDesks` + `getSlotMap` |

---

**Note on commit ordering:** Tasks 1-4 should be done as a single atomic refactor. The build will be broken between Task 1 (deleting old exports) and Tasks 2-4 (updating consumers). If working incrementally, keep old exports as pass-throughs until all consumers are updated, then delete in Task 5.

### Task 1: Rewrite `desk-layout.ts` — single source of truth

**Files:**
- Rewrite: `src/components/scene/desk-layout.ts`

The new module exports a mapping table, an `AssignmentResult` type, and a single `computeAssignments` function that takes agents + slotsDetail and returns everything callers need.

- [ ] **Step 1: Define the mapping constants and result type**

Replace the current `stickyDesks`, `OPENCLAW_DESK`, and `assignDesks` with:

```typescript
// Claw slot → physical desk (skip desk 2 = trainer)
export const SLOT_TO_DESK = [0, 1, 3, 4] as const;

// Physical desk → claw slot (inverse, only for desks with quadrants)
export const DESK_TO_SLOT: Partial<Record<number, number>> = { 0: 0, 1: 1, 3: 2, 4: 3 };

// Desk 2 is ALWAYS the trainer. This is structural, not a reservation.
export const TRAINER_DESK = 2;

// CC agents fill these desks in order when no claw slot is available
const CC_FILL_ORDER = [0, 1, 3, 4, 5];

export interface AgentAssignment {
  desk: DeskPosition;    // physical desk position
  deskIndex: number;     // physical desk index (0-5)
  clawSlot?: number;     // claw quadrant (0-3), undefined for overflow agents
}

export interface AssignmentResult {
  assignments: Map<string, AgentAssignment>;  // agentId → assignment
  getDesk(agentId: string): DeskPosition | undefined;
  getSlot(agentId: string): number | undefined;
  getDeskIndex(agentId: string): number | undefined;
}
```

- [ ] **Step 2: Write `computeAssignments` function**

This replaces both `assignDesks` AND the `stickyQuadrants` logic in renderer.ts. One function, one map, one cleanup, one fallback.

```typescript
import type { SlotDetail } from "../../hooks/use-pixel-tower";

// Single sticky map — replaces both stickyDesks and stickyQuadrants
const stickyAssignments = new Map<string, number>(); // agentId → deskIndex

// Cache the last result so multiple consumers can read it without recomputing
let cachedResult: AssignmentResult | null = null;

export function computeAssignments(
  agentIds: string[],          // desk-eligible agent IDs (no subagents, no lounging/departing)
  slotsDetail?: SlotDetail[],  // raw claw data — NOT a pre-processed map
): AssignmentResult {
  const activeIds = new Set(agentIds);

  // 1. Clean up departed agents
  for (const id of stickyAssignments.keys()) {
    if (!activeIds.has(id)) stickyAssignments.delete(id);
  }

  // 2. Build taken set from surviving assignments
  const taken = new Set<number>();
  for (const deskIdx of stickyAssignments.values()) taken.add(deskIdx);

  // 3. Trainer desk is ALWAYS taken — also evict any CC agent stuck there
  taken.add(TRAINER_DESK);
  for (const [id, deskIdx] of stickyAssignments) {
    if (id !== "openclaw-main" && deskIdx === TRAINER_DESK) {
      stickyAssignments.delete(id);
    }
  }

  // 4. Match agents to desks from claw slotsDetail (authoritative)
  //    Matches by session_id first, falls back to name if session_id is absent.
  //    session_id is a UUID suffix embedded in agent IDs like "cc-{session_id}".
  if (slotsDetail && slotsDetail.length > 0) {
    const matchedAgentIds = new Set<string>();
    for (let s = 0; s < slotsDetail.length && s < SLOT_TO_DESK.length; s++) {
      const detail = slotsDetail[s];
      if (!detail.session_id && !detail.name) continue;

      for (const id of agentIds) {
        if (matchedAgentIds.has(id)) continue;
        if (id === "openclaw-main") continue;
        const matchById = detail.session_id && id.includes(detail.session_id);
        const matchByName = !matchById && detail.name && id.includes(detail.name);
        if (!matchById && !matchByName) continue;

        matchedAgentIds.add(id);
        const targetDesk = SLOT_TO_DESK[s];

        const currentDesk = stickyAssignments.get(id);
        if (currentDesk === targetDesk) break; // already correct

        // Only move if target is free (avoid double-booking)
        // IMPORTANT: free old desk ONLY after confirming move succeeds
        if (!taken.has(targetDesk)) {
          if (currentDesk !== undefined) taken.delete(currentDesk);
          stickyAssignments.set(id, targetDesk);
          taken.add(targetDesk);
        }
        break;
      }
    }
  }

  // 5. Fallback: assign unmatched CC agents to first available desk (skip desk 2)
  for (const id of agentIds) {
    if (id === "openclaw-main") continue;
    if (stickyAssignments.has(id)) continue;

    for (const deskIdx of CC_FILL_ORDER) {
      if (!taken.has(deskIdx)) {
        stickyAssignments.set(id, deskIdx);
        taken.add(deskIdx);
        break;
      }
    }
  }

  // 6. Openclaw-main always gets desk 2
  if (activeIds.has("openclaw-main")) {
    stickyAssignments.set("openclaw-main", TRAINER_DESK);
  }

  // 7. Build result
  const assignments = new Map<string, AgentAssignment>();
  for (const id of agentIds) {
    const deskIdx = stickyAssignments.get(id);
    if (deskIdx !== undefined && deskIdx < DESK_POSITIONS.length) {
      assignments.set(id, {
        desk: DESK_POSITIONS[deskIdx],
        deskIndex: deskIdx,
        clawSlot: DESK_TO_SLOT[deskIdx],
      });
    } else {
      // Count how many agents are already in overflow to avoid stacking
      let overflowCount = 0;
      for (const a of assignments.values()) if (a.deskIndex === -1) overflowCount++;
      assignments.set(id, {
        desk: getOverflowPosition(overflowCount),
        deskIndex: -1,
        clawSlot: undefined,
      });
    }
  }

  cachedResult = {
    assignments,
    getDesk: (id) => assignments.get(id)?.desk,
    getSlot: (id) => assignments.get(id)?.clawSlot,
    getDeskIndex: (id) => assignments.get(id)?.deskIndex,
  };

  return cachedResult;
}

export function getCachedAssignments(): AssignmentResult | null {
  return cachedResult;
}
```

- [ ] **Step 3: Keep `DESK_POSITIONS` and `getOverflowPosition` unchanged**

These are pure geometry — no logic changes needed.

- [ ] **Step 4: Remove old exports**

Delete: `assignDesks`, `getSlotMap`, `getAgentSlot`, `OPENCLAW_DESK`, `stickyDesks`.

Keep exports: `DESK_POSITIONS`, `DeskPosition`, `getOverflowPosition`, `SLOT_TO_DESK`, `DESK_TO_SLOT`, `TRAINER_DESK`, `AgentAssignment`, `AssignmentResult`, `computeAssignments`, `getCachedAssignments`.

- [ ] **Step 5: Commit**

```bash
git add src/components/scene/desk-layout.ts
git commit -m "refactor: rewrite desk-layout with single source of truth and slot→desk mapping"
```

---

### Task 2: Update `renderer.ts` — delete `stickyQuadrants`, use new assignment system

**Files:**
- Modify: `src/components/scene/renderer.ts`

This is the biggest change. We delete ~50 lines of `stickyQuadrants` logic and replace it with reads from the cached assignment result.

- [ ] **Step 1: Update imports**

Replace:
```typescript
import { assignDesks, DESK_POSITIONS } from "./desk-layout";
```
With:
```typescript
import { computeAssignments, getCachedAssignments, DESK_POSITIONS, DESK_TO_SLOT, TRAINER_DESK, type AssignmentResult } from "./desk-layout";
```

- [ ] **Step 2: Delete `stickyQuadrants` and its exports**

Delete these lines (around lines 96-107):
```typescript
const stickyQuadrants = new Map<string, number>();
// ...
export function getAgentSlot(agentId: string): number | undefined { ... }
export function getSlotMap(): Map<string, number> { ... }
```

Delete all three exports (`getAgentSlot`, `getSlotMap`, `getAgentDeskIndex` if it existed). No pass-throughs needed — consumers read directly from `getCachedAssignments()`.

- [ ] **Step 3: Update desk assignment computation (~line 1378-1386)**

Replace:
```typescript
const deskEligible = agents.filter((a) =>
  a.state !== "lounging" && a.state !== "departing" &&
  (a.subagentClass === null || a.subagentClass === undefined)
);
const rawDeskMap = assignDesks(deskEligible.map((a) => a.id), stickyQuadrants);
const deskMap = new Map<...>();
for (const [id, pos] of rawDeskMap) {
  deskMap.set(id, { x: pos.x, y: pos.y + oY, ... });
}
```

With:
```typescript
const deskEligible = agents.filter((a) =>
  a.state !== "lounging" && a.state !== "departing" &&
  (a.subagentClass === null || a.subagentClass === undefined)
);
const towerInfo = getPixelTowerData();
const assignResult = computeAssignments(
  deskEligible.map((a) => a.id),
  towerInfo.data.slotsDetail,
);
const deskMap = new Map<string, { x: number; y: number; characterX: number; characterY: number }>();
for (const [id, asgn] of assignResult.assignments) {
  const d = asgn.desk;
  deskMap.set(id, { x: d.x, y: d.y + oY, characterX: d.characterX, characterY: d.characterY + oY });
}
```

Note: `getPixelTowerData()` is already called at ~line 2049. Move the call up to here (~line 1382). Then at ~line 2049, DELETE the `const towerInfo = getPixelTowerData();` line — `towerInfo` is already in scope from here.

IMPORTANT: `assignResult` is declared at function scope and is referenced again in Steps 5 and 6 (hundreds of lines later in the same `renderScene` function body). Do NOT declare it inside a narrower block.

- [ ] **Step 3b: Update `occupiedDeskIndices` and `agentLevelAtDesk` (~lines 1388-1408)**

These blocks currently use `rawDeskMap.get(agent.id)` and `DESK_POSITIONS.indexOf(rawPos)` to find desk indices. Since `rawDeskMap` no longer exists, update to use `assignResult`:

Replace:
```typescript
const rawPos = rawDeskMap.get(agent.id);
if (!rawPos) continue;
const idx = DESK_POSITIONS.indexOf(rawPos);
```
With:
```typescript
const asgn = assignResult.assignments.get(agent.id);
if (!asgn) continue;
const idx = asgn.deskIndex;
```

Apply this pattern in both the `occupiedDeskIndices` loop (~line 1390) and the `agentLevelAtDesk` loop (~line 1400).

- [ ] **Step 4: Delete the `stickyQuadrants` assignment block (~lines 2062-2107)**

Delete the section labeled "--- Authoritative slot assignment from claw's slots_detail ---" which includes:
- The `activeMainIds` cleanup (lines 2066-2070)
- The claw slotsDetail matching loop (lines 2072-2093)
- The fallback sequential fill loop (lines 2096-2107)

All of this is now handled by `computeAssignments` in step 3.

**KEEP the `mainCCs` definition** (lines 2058-2060) — it is still used by the pokeball glow code in Step 5.

- [ ] **Step 5: Update pokeball glow code (~lines 2108-2160)**

The pokeball glow iterates `mainCCs` and reads `stickyQuadrants.get(agent.id)` to find the slot, then checks `SLOT_PIXELS[slot]` for quadrant activity.

Replace `stickyQuadrants.get(agent.id)` with `assignResult.getSlot(agent.id)`:

```typescript
for (const agent of mainCCs) {
  const slot = assignResult.getSlot(agent.id);
  if (slot === undefined) continue;
  // ... rest unchanged (SLOT_PIXELS[slot], quadrantLit check, etc.)
}
```

Note: `mainCCs` is still needed here (filter CC mains for pokeball glow). But the slot comes from the assignment result, not `stickyQuadrants`.

- [ ] **Step 6: Update sparkle trigger (~line 2233)**

Replace:
```typescript
const sparkleSlot = stickyQuadrants.get(agent.id);
```
With:
```typescript
const sparkleSlot = assignResult.getSlot(agent.id);
```

- [ ] **Step 7: Delete the second `stickyQuadrants` cleanup (~lines 2388-2389)**

Delete:
```typescript
for (const id of stickyQuadrants.keys()) {
  if (!activeIds.has(id)) stickyQuadrants.delete(id);
}
```

This is no longer needed — cleanup happens in `computeAssignments`.

- [ ] **Step 8: Add `lastDeskPos` cleanup in the departure cleanup block (~line 2387)**

Add after the existing cleanup loops:
```typescript
for (const id of lastDeskPos.keys()) {
  if (!activeIds.has(id)) lastDeskPos.delete(id);
}
```

- [ ] **Step 9: Commit**

```bash
git add src/components/scene/renderer.ts
git commit -m "refactor: delete stickyQuadrants, use single assignment source from desk-layout"
```

---

### Task 3: Update `agent-labels.tsx` — read from cached result

**Files:**
- Modify: `src/components/overlay/agent-labels.tsx`

- [ ] **Step 1: Update imports**

Replace:
```typescript
import { assignDesks } from "../scene/desk-layout";
import { ..., getAgentSlot, getSlotMap, ..., getLastDeskPos } from "../scene/renderer";
```
With:
```typescript
import { getCachedAssignments } from "../scene/desk-layout";
import { ..., getLastDeskPos } from "../scene/renderer";
```

Remove `getSlotMap` and `getAgentSlot` from imports — both replaced by `cached?.getSlot()` / `cached?.getDeskIndex()`. Remove `assignDesks` import (deleted).

- [ ] **Step 2: Replace `assignDesks` call with cached result**

Replace:
```typescript
const deskEligible = agents.filter((a) =>
  a.state !== "lounging" && a.state !== "departing" &&
  (a.subagentClass === null || a.subagentClass === undefined)
);
const deskMap = assignDesks(deskEligible.map((a) => a.id), getSlotMap());
```
With:
```typescript
const cached = getCachedAssignments();
const deskMap = new Map<string, { x: number; y: number; characterX: number; characterY: number }>();
if (cached) {
  for (const [id, asgn] of cached.assignments) {
    deskMap.set(id, asgn.desk);
  }
}
```

Note: The `deskEligible` filter is no longer needed here — the renderer already computed assignments for the correct set of agents.

**First-frame safety:** `getCachedAssignments()` returns `null` before the renderer's first frame runs. The `if (cached)` guard handles this — agents simply have no labels for that frame. This matches existing behavior (labels don't render until desk positions are known). The canvas `requestAnimationFrame` runs before React's commit phase, so in practice the cache is populated before labels render.

- [ ] **Step 3: Update debug label to show desk index and claw slot separately**

Replace:
```typescript
{debugOn && (() => {
  const slot = getAgentSlot(agent.id);
  if (slot === undefined) return null;
  return <span style={{ fontSize: "11px", color: "rgba(255,255,255,0.7)" }}>d{slot} s{slot}</span>;
})()}
```
With:
```typescript
{debugOn && (() => {
  const deskIdx = cached?.getDeskIndex(agent.id);
  const slot = cached?.getSlot(agent.id);
  if (deskIdx === undefined) return null;
  return <span style={{ fontSize: "11px", color: "rgba(255,255,255,0.7)" }}>
    d{deskIdx}{slot !== undefined ? ` q${slot}` : ""}
  </span>;
})()}
```

This shows `d{deskIndex}` always, plus `q{quadrant}` when the agent has a claw quadrant (e.g., `d3 q2` for the agent at desk 3 with claw quadrant 2). Desk 5 agents show just `d5` (no quadrant).

- [ ] **Step 4: Commit**

```bash
git add src/components/overlay/agent-labels.tsx
git commit -m "refactor: agent-labels reads from cached assignment result"
```

---

### Task 4: Update `speech-bubble.tsx` — read from cached result

**Files:**
- Modify: `src/components/overlay/speech-bubble.tsx`

- [ ] **Step 1: Update imports and assignment call**

Replace:
```typescript
import { assignDesks } from "../scene/desk-layout";
import { getAgentPosition, getSlotMap } from "../scene/renderer";
```
With:
```typescript
import { getCachedAssignments } from "../scene/desk-layout";
import { getAgentPosition } from "../scene/renderer";
```

Replace:
```typescript
const deskEligible = agents.filter((a) =>
  a.state !== "lounging" && a.state !== "departing" &&
  (a.subagentClass === null || a.subagentClass === undefined)
);
const deskMap = assignDesks(deskEligible.map((a) => a.id), getSlotMap());
```
With:
```typescript
const cached = getCachedAssignments();
const deskMap = new Map<string, { x: number; y: number; characterX: number; characterY: number }>();
if (cached) {
  for (const [id, asgn] of cached.assignments) {
    deskMap.set(id, asgn.desk);
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/overlay/speech-bubble.tsx
git commit -m "refactor: speech-bubble reads from cached assignment result"
```

---

### Task 5: Verify and clean up

- [ ] **Step 1: Type check**

```bash
npx tsc --noEmit 2>&1 | grep -E "desk-layout|renderer|agent-labels|speech-bubble"
```

Expected: No errors from these files (pre-existing errors in other files are OK).

- [ ] **Step 2: Search for any remaining references to deleted exports**

```bash
grep -rn "getSlotMap\|stickyQuadrants\|assignDesks\|OPENCLAW_DESK" src/
```

Expected: No results. All references should be gone.

- [ ] **Step 3: Build**

```bash
npm run build
```

Expected: Builds successfully.

- [ ] **Step 4: Manual test checklist**

Open `localhost:4747` and verify:
- [ ] CC agents sit at desks 0, 1, 3, 4, 5 (never desk 2)
- [ ] Trainer is always at desk 2
- [ ] Debug labels show `d{desk} q{quadrant}` (e.g., `d3 q2` for agent at desk 3 with claw quadrant 2)
- [ ] Pokeball glow matches the correct claw quadrant
- [ ] Labels, speech bubbles, and character positions all agree
- [ ] Refresh preserves correct assignments (no swapping)
- [ ] Adding/removing CC agents doesn't cause stacking

- [ ] **Step 5: Final commit**

```bash
git add -A
git commit -m "refactor: complete desk/slot refactor — single source of truth"
```
