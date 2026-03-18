# Audit Fixes & Game Features Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix all bugs found in the adversarial audit, clean up code quality issues, add game design features (achievements, enhanced rivalry, rare events, pokeball tiers), and improve architecture resilience.

**Architecture:** Server-side fixes (exp-tracker, cc-watcher, server.ts) are independent of client-side fixes (renderer, store, agent-labels). Game features build on the existing exp-tracker and shared game-constants. Claw circuit breaker is server-only.

**Tech Stack:** TypeScript, Express, Zustand, Canvas 2D, SSE

---

## Phase 1: Bug Fixes (quick wins, no dependencies)

### Task 1: Fix `lastThinkingExp` memory leak

**Files:**
- Modify: `src/server/agents/exp-tracker.ts:300-305`

- [ ] **Step 1: Add cleanup to `clearAgent()`**

In `clearAgent()`, also delete from `lastThinkingExp`:

```typescript
clearAgent(agentId: string): void {
  const d = this.data.get(agentId);
  if (d) this.usedNames.delete(d.gameName);
  this.data.delete(agentId);
  this.lastThinkingExp.delete(agentId);
  this.scheduleSave();
}
```

- [ ] **Step 2: Build to verify**

Run: `npm run build 2>&1 | tail -3`
Expected: `built in ~1.5s`

- [ ] **Step 3: Commit**

```bash
git add src/server/agents/exp-tracker.ts
git commit -m "fix: clean up lastThinkingExp on agent departure (memory leak)"
```

---

### Task 2: Clean ghost `stickyQuadrants` in renderer

**Files:**
- Modify: `src/components/scene/renderer.ts` — find the cleanup section near end of `renderScene` (around line 2357+)

- [ ] **Step 1: Find the existing cleanup loop**

Search for where `knownAgentIds` or `walkStates` are cleaned. There should be a block that iterates active agent IDs and cleans stale maps. Add `stickyQuadrants` cleanup there.

- [ ] **Step 2: Add cleanup**

In the cleanup section of `renderScene`, add:

```typescript
for (const id of stickyQuadrants.keys()) {
  if (!activeIds.has(id)) stickyQuadrants.delete(id);
}
```

Where `activeIds` is the set of currently active agent IDs already computed in that section.

- [ ] **Step 3: Build to verify**

Run: `npm run build 2>&1 | tail -3`
Expected: clean build

- [ ] **Step 4: Commit**

```bash
git add src/components/scene/renderer.ts
git commit -m "fix: clean stickyQuadrants for departed agents"
```

---

### Task 3: Fix subagent race condition

**Files:**
- Modify: `src/server/agents/cc-watcher.ts:160-186`

- [ ] **Step 1: Only set `subagentClass` when parent is found**

Change lines 182-185 from:

```typescript
} else {
  // No parent found but it's in a subagents dir — still mark as subagent
  subagentClass = teamColor;
}
```

To:

```typescript
} else {
  // No parent found yet — defer subagent detection.
  // It will be re-scanned on next cycle when parent may exist.
  // Still mark as subagent with orphaned color so it renders.
  subagentClass = teamColor;
  // Set parentId to the expected parent path so it can be matched later
  parentId = uuidDir + ".jsonl";
}
```

This is actually already reasonable — the subagent still needs a class to render. The real fix is ensuring the parent's `teamColor` is used when the parent eventually appears. Add a re-link check in `emitUpdate()`:

- [ ] **Step 2: Add parent re-link in `emitUpdate()`**

Before the agent push in `emitUpdate()`, add:

```typescript
// Re-link orphaned subagents to parent if parent now exists
if (session.subagentClass !== null && session.parentId) {
  const parentSession = this.sessions.get(session.parentId);
  if (parentSession && session.teamColor !== parentSession.teamColor) {
    session.teamColor = parentSession.teamColor;
    session.subagentClass = parentSession.teamColor;
  }
}
```

- [ ] **Step 3: Build to verify**

Run: `npm run build 2>&1 | tail -3`

- [ ] **Step 4: Commit**

```bash
git add src/server/agents/cc-watcher.ts
git commit -m "fix: re-link orphaned subagents to parent when parent appears"
```

---

### Task 4: Implement rename or remove dead button

**Files:**
- Modify: `src/components/overlay/agent-labels.tsx:252-253`
- Modify: `src/server/agents/exp-tracker.ts` — add `renameAgent()` method
- Modify: `src/server/server.ts` — add `/api/rename-agent` endpoint

- [ ] **Step 1: Add `renameAgent` to exp-tracker**

```typescript
renameAgent(agentId: string, newName: string): boolean {
  const d = this.data.get(agentId);
  if (!d) return false;
  this.usedNames.delete(d.gameName);
  d.gameName = newName;
  this.usedNames.add(newName);
  this.saveToDisk();
  return true;
}
```

- [ ] **Step 2: Add API endpoint**

In `server.ts`, after the kill-agent endpoint:

```typescript
app.post("/api/rename-agent", express.json(), (req, res) => {
  const { agentId, name } = req.body;
  if (!agentId || !name) return res.status(400).json({ error: "agentId and name required" });
  // Use dirname for main agents (same key as exp tracking)
  const expId = agentId.includes("/subagents/") ? agentId : path.dirname(agentId);
  const ok = watcher.expTracker.renameAgent(expId, name);
  res.json({ ok });
});
```

- [ ] **Step 3: Wire up the button**

In `agent-labels.tsx`, replace the TODO:

```typescript
onClick={() => {
  const name = prompt("Rename:", a.gameName ?? a.name);
  if (name) {
    fetch("/api/rename-agent", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ agentId: a.id, name }),
    }).catch(() => {});
  }
  setHudMenuId(null);
}}
```

- [ ] **Step 4: Build and test manually**

Run: `npm run build 2>&1 | tail -3`

- [ ] **Step 5: Commit**

```bash
git add src/server/agents/exp-tracker.ts src/server/server.ts src/components/overlay/agent-labels.tsx
git commit -m "feat: implement agent rename from HUD menu"
```

---

## Phase 2: Code Quality

### Task 5: Standardize temp paths

**Files:**
- Modify: `src/server/agents/exp-tracker.ts:12-13`

- [ ] **Step 1: Use os.tmpdir()**

```typescript
import os from "os";
import path from "path";

const STATE_FILE = path.join(os.tmpdir(), "agent-office-game-mode");
const EXP_FILE = path.join(os.tmpdir(), "agent-office-exp.json");
```

- [ ] **Step 2: Build, commit**

```bash
git add src/server/agents/exp-tracker.ts
git commit -m "refactor: use os.tmpdir() instead of hardcoded /tmp/"
```

---

### Task 6: Remove dead `screenFlashAlpha` code

**Files:**
- Modify: `src/components/scene/renderer.ts`

- [ ] **Step 1: Find and remove all `screenFlashAlpha` references**

Search for `screenFlashAlpha` in renderer.ts. Remove the variable declaration, any decrement logic, and any draw call that uses it.

- [ ] **Step 2: Build, commit**

```bash
git add src/components/scene/renderer.ts
git commit -m "refactor: remove dead screenFlashAlpha code"
```

---

### Task 7: Add claw circuit breaker

**Files:**
- Modify: `src/server/server.ts`

- [ ] **Step 1: Add circuit breaker state**

After the claw variable declaration:

```typescript
// Circuit breaker for claw communication
let clawCircuitOpen = false;
let clawFailCount = 0;
let clawLastFailTime = 0;
const CLAW_FAIL_THRESHOLD = 3;
const CLAW_RECOVERY_MS = 30_000; // 30s before retrying after circuit opens

async function clawGetSafe(urlPath: string, timeoutSec = 2): Promise<any> {
  if (clawCircuitOpen) {
    if (Date.now() - clawLastFailTime < CLAW_RECOVERY_MS) {
      throw new Error("claw circuit open");
    }
    // Try to recover
    clawCircuitOpen = false;
    clawFailCount = 0;
  }
  try {
    const result = await clawGet(claw, urlPath, timeoutSec);
    clawFailCount = 0;
    return result;
  } catch (err) {
    clawFailCount++;
    clawLastFailTime = Date.now();
    if (clawFailCount >= CLAW_FAIL_THRESHOLD) {
      clawCircuitOpen = true;
      console.log("[claw] circuit breaker OPEN — pausing requests for 30s");
    }
    throw err;
  }
}
```

- [ ] **Step 2: Replace `clawGet(claw, ...)` calls with `clawGetSafe(...)`**

Update all claw-health, pixels, uptime-kuma, brightness endpoints to use `clawGetSafe` instead of `clawGet(claw, ...)`.

- [ ] **Step 3: Build, commit**

```bash
git add src/server/server.ts
git commit -m "feat: add circuit breaker for claw communication"
```

---

## Phase 3: Game Features

### Task 8: Achievements system

**Files:**
- Create: `src/shared/achievements.ts`
- Modify: `src/server/agents/exp-tracker.ts` — track achievement state
- Modify: `src/shared/types.ts` — add achievements to AgentState
- Modify: `src/components/overlay/agent-labels.tsx` — display achievements

- [ ] **Step 1: Define achievements**

Create `src/shared/achievements.ts`:

```typescript
export interface Achievement {
  id: string;
  name: string;
  description: string;
  icon: string; // emoji
}

export const ACHIEVEMENTS: Achievement[] = [
  { id: "first-blood", name: "First Blood", description: "Use your first tool", icon: "🩸" },
  { id: "speed-runner", name: "Speed Runner", description: "Reach level 5 in under 30 minutes", icon: "⚡" },
  { id: "polymath", name: "Polymath", description: "Master 3+ different tools", icon: "🧠" },
  { id: "marathon", name: "Marathon", description: "Maintain a streak for 30+ minutes", icon: "🏃" },
  { id: "critical-master", name: "Critical Master", description: "Land 10 critical hits", icon: "💥" },
  { id: "team-player", name: "Team Player", description: "Earn 100+ rivalry bonus exp", icon: "🤝" },
  { id: "shell-shocked", name: "Shell Shocked", description: "Use Bash 200 times", icon: "🐚" },
  { id: "bookworm", name: "Bookworm", description: "Use Read 200 times", icon: "📚" },
];

export function checkAchievements(data: {
  level: number;
  sessionStartTime: number;
  toolCounts: Record<string, number>;
  masteryCount: number;
  streakDurationMs: number;
  critCount: number;
  rivalryExp: number;
  firstBloodAwarded: boolean;
}): string[] {
  const earned: string[] = [];
  if (data.firstBloodAwarded) earned.push("first-blood");
  if (data.level >= 5 && Date.now() - data.sessionStartTime < 30 * 60 * 1000) earned.push("speed-runner");
  if (data.masteryCount >= 3) earned.push("polymath");
  if (data.streakDurationMs >= 30 * 60 * 1000) earned.push("marathon");
  if (data.critCount >= 10) earned.push("critical-master");
  if (data.rivalryExp >= 100) earned.push("team-player");
  if ((data.toolCounts["Bash"] ?? 0) >= 200) earned.push("shell-shocked");
  if ((data.toolCounts["Read"] ?? 0) >= 200) earned.push("bookworm");
  return earned;
}
```

- [ ] **Step 2: Add tracking fields to exp-tracker**

Add to `AgentExpData`:
```typescript
critCount: number;
rivalryExp: number;
sessionStartTime: number;
achievements: string[];
```

Update `getOrCreate` to initialize these. Update `onToolUse` to increment `critCount` on crits and `rivalryExp` on rivalry bonus. Call `checkAchievements()` in `awardExp()` and store new achievements.

- [ ] **Step 3: Add achievements to AgentState**

In `types.ts`, add: `achievements?: string[];`

In `getExpFields`, include: `achievements: d.achievements`

- [ ] **Step 4: Display in HUD**

In `agent-labels.tsx`, below the title row, show earned achievement icons as a row of emoji.

- [ ] **Step 5: Persist achievements**

Add `achievements` to `PersistedAgent` interface and save/restore logic.

- [ ] **Step 6: Build, test manually, commit**

```bash
git add src/shared/achievements.ts src/server/agents/exp-tracker.ts src/shared/types.ts src/components/overlay/agent-labels.tsx
git commit -m "feat: achievements system — 8 earnable badges"
```

---

### Task 9: Enhanced rivalry tracking

**Files:**
- Modify: `src/server/agents/exp-tracker.ts`
- Modify: `src/shared/game-constants.ts`

- [ ] **Step 1: Increase rivalry bonus from 1 to 3**

In `game-constants.ts`:
```typescript
export const BONUS_RIVALRY = 3;
```

- [ ] **Step 2: Track rivalry stats**

In `AgentExpData`, add:
```typescript
rivalryWindows: number; // count of 1-min windows with another agent active
```

In `onToolUse`, when rivalry triggers, also increment `rivalryWindows`.

- [ ] **Step 3: Build, commit**

```bash
git add src/shared/game-constants.ts src/server/agents/exp-tracker.ts
git commit -m "feat: enhanced rivalry — 3x bonus, track rivalry windows"
```

---

### Task 10: Rare events — Lucky Break

**Files:**
- Modify: `src/server/agents/exp-tracker.ts`
- Modify: `src/shared/game-constants.ts`

- [ ] **Step 1: Add lucky break constant**

In `game-constants.ts`:
```typescript
export const LUCKY_BREAK_CHANCE = 0.02; // 2% chance
export const LUCKY_BREAK_MULTIPLIER = 3; // 3x exp on lucky break
```

- [ ] **Step 2: Implement in onToolUse**

After the critical hit check:

```typescript
// Lucky Break (2% chance, stacks with crit)
const isLucky = Math.random() < LUCKY_BREAK_CHANCE;
if (isLucky) baseExp *= LUCKY_BREAK_MULTIPLIER;
```

- [ ] **Step 3: Build, commit**

```bash
git add src/shared/game-constants.ts src/server/agents/exp-tracker.ts
git commit -m "feat: rare event — Lucky Break (2% chance for 3x exp)"
```

---

### Task 11: Pokeball progression tiers

**Files:**
- Modify: `src/shared/game-constants.ts`
- Modify: `src/components/scene/renderer.ts` — update pokeball drawing

- [ ] **Step 1: Define tier thresholds**

In `game-constants.ts`, replace the two constants:

```typescript
export const POKEBALL_TIERS = [
  { level: 1, name: "standard", colors: { top: "#cc3333", bottom: "#ffffff", band: "#222222" } },
  { level: 10, name: "great", colors: { top: "#3366cc", bottom: "#ffffff", band: "#cc3333" } },
  { level: 20, name: "ultra", colors: { top: "#222222", bottom: "#ffcc00", band: "#222222" } },
  { level: 40, name: "master", colors: { top: "#9933cc", bottom: "#ffffff", band: "#ff44aa" } },
];

export function getPokeballTier(level: number) {
  let tier = POKEBALL_TIERS[0];
  for (const t of POKEBALL_TIERS) {
    if (level >= t.level) tier = t;
  }
  return tier;
}
```

- [ ] **Step 2: Update pokeball rendering**

In `renderer.ts`, find the pokeball drawing code and use `getPokeballTier(agentLevel)` to determine colors instead of the current gold/standard binary.

- [ ] **Step 3: Build, test manually (check pokeballs change color at level thresholds), commit**

```bash
git add src/shared/game-constants.ts src/components/scene/renderer.ts
git commit -m "feat: pokeball progression tiers — standard/great/ultra/master"
```

---

## Phase 4: Architecture (lower priority, can defer)

### Task 12: Add version to AgentState for SSE ordering

**Files:**
- Modify: `src/shared/types.ts`
- Modify: `src/server/agents/cc-watcher.ts`
- Modify: `src/components/store.ts`

- [ ] **Step 1: Add `stateVersion` to AgentState**

In `types.ts`:
```typescript
stateVersion?: number;
```

- [ ] **Step 2: Increment on each emit**

In `cc-watcher.ts`, add a counter and include in each agent pushed to the emit array.

- [ ] **Step 3: Reject stale updates in store**

In `store.ts` `setAgents()`, when merging, skip incoming agents whose `stateVersion` is lower than the current stored version.

- [ ] **Step 4: Build, commit**

```bash
git add src/shared/types.ts src/server/agents/cc-watcher.ts src/components/store.ts
git commit -m "feat: add stateVersion to prevent out-of-order SSE updates"
```

---

## Summary

| Phase | Tasks | Est. Time | Impact |
|-------|-------|-----------|--------|
| 1: Bug Fixes | Tasks 1-4 | 30 min | High — prevents leaks, collisions, dead UI |
| 2: Code Quality | Tasks 5-7 | 20 min | Medium — cleaner, more resilient |
| 3: Game Features | Tasks 8-11 | 1-2 hours | High — makes game mode engaging |
| 4: Architecture | Task 12 | 15 min | Low — edge case prevention |

**Recommended order:** Phase 1 (all tasks parallel) → Phase 2 (all parallel) → Phase 3 (sequential, 8 first) → Phase 4
