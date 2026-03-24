# System Status Panel + Debug Signal Overhaul

**Date:** 2026-03-24
**Scope:** Replace "Claw Server Diagnostics" with unified System Status panel, add purple AWAY lights to health poster sign, expand debug panel with new signal sources and toggle-pill filters.

---

## 1. Sign Lights

The health poster sign currently has 2 indicator lights (top: claw server, bottom: Yeelight), both red/green only.

**Changes:**
- **Top light** — repurposed as connection mode indicator:
  - Green (#22c55e): HOME
  - Purple (#a855f7): AWAY
  - Red (#ef4444): OFFLINE (also used when `clawHealth` is null/loading)
- **Bottom light** — claw server reachability (unchanged logic, green/red)
- Icon shapes remain: "C" shape (top), rays/dot (bottom)
- Renderer reads `clawHealth.mode` for the top light color. When `clawHealth` is null (initial load), default to red (OFFLINE).

**File:** `src/components/scene/renderer.ts` — the sign rendering section (~lines 595-686)

---

## 2. System Status Panel

Replaces the "Claw Server Diagnostics" popup in App.tsx. Same trigger (click health poster), same draggable behavior.

### Layout
- Width: ~240px (same as current)
- Style: accordion with collapsible sections
- Background: `#12121e/95`, monospace `10px`, same aesthetic as current
- Default position: top-left (same as current diagnostics)
- Accordion default state: Claw Server expanded, all others collapsed. Resets on panel close.

### Structure

**Header (always visible):**
- Title: "System Status" + close button
- Mode banner: colored background strip
  - HOME: green tint, shows primary claw host
  - AWAY: purple tint, shows fallback host (Tailscale IP)
  - OFFLINE: red tint, shows "no connection"

**Sections (collapsible, each shows one-line summary when collapsed):**

#### Claw Server
- Collapsed summary: reachable/unreachable status
- Expanded:
  - Server: reachable/unreachable
  - Yeelight: connected/disconnected
  - Matrix mode (if available)
  - Brightness % (if available)
  - Slot squares (colored: green=active, gray=off, yellow=waiting)
  - Slot detail: per-slot owner name + TTL
  - Waiting count
  - Zones (thinking, display, context)
  - Animation/transition status

#### Tower Engine
- Collapsed summary: active/idle
- Expanded:
  - Hirst phase: off/in/running/out
  - Slot states: 4 colored squares + per-slot owner/TTL from tower engine
  - Simulated flag (when in AWAY mode)

#### Agents
- Collapsed summary: CC:{n} OC:{n}
- Expanded:
  - Per-agent: name, state, current tool, source (cc/openclaw)
  - Subagent count

#### ESP32 Buddy
- Collapsed summary: polling/idle + last poll time
- Expanded:
  - Last poll timestamp (relative: "2s ago")
  - Connection status

#### Recovery
- Collapsed summary: enabled/disabled (based on mode)
- Expanded:
  - Mode-gated status: "disabled (away)" or "active (home)"
  - No action history tracking (keep it simple — console logs are sufficient for recovery debugging)

### Data Sources

**Tower engine state** — add to `/api/claw-health` response. The tower engine is local (no extra HTTP call), so the claw-health endpoint adds a `towerEngine` field:
```json
{
  "towerEngine": {
    "active": true,
    "hirstPhase": "running",
    "slotStates": ["active", "off", "waiting", "off"]
  }
}
```
Store gets a matching `towerEngine` field on `ClawHealth`.

**ESP32 poll tracking** — add to `/api/claw-health` response:
```json
{
  "esp32": {
    "polling": true,
    "lastPoll": 1774386126000
  }
}
```

**Recovery status** — add to `/api/claw-health` response:
```json
{
  "recovery": {
    "enabled": true,
    "inProgress": false
  }
}
```

**All other data** already exists on `clawHealth` store state (agents come from the agent store).

### Component Location
- Extract from inline JSX in App.tsx into `src/components/overlay/system-status-panel.tsx`
- Accordion state is local component state (not in store — resets on close/reopen)

---

## 3. Debug Panel — New Signals + Filters

### Source Name Reconciliation

Existing debug panel uses source names that need updating to match the new unified set:
- `"network"` → rename to `"net"`
- `"slots"` → rename to `"seats"` (and repurpose: now logs desk assignments, not claw slot ownership)

Claw slot detail logging stays under `"claw"` source (it's claw server data).

### Final `LogEntry.source` Type
```typescript
type DebugSource = "pixels" | "agents" | "hooks" | "tower" | "esp" | "seats" | "claw" | "net";
```

### New SSE Endpoint: `GET /api/debug-events`

Server-sent events stream that pushes debug signals in real-time. Only active when a client subscribes (debug panel open).

**Event format:**
```json
{
  "source": "hooks" | "tower" | "esp" | "seats",
  "text": "thinking-start slot=0 sid=ab3ce07",
  "time": 1774386128000
}
```

**Rate limiting:** Only transition edges are emitted (state changes, not per-frame ticks). The tower engine runs at 30fps but only emits when a slot state or hirst phase actually changes. This keeps the event stream sparse.

**Server-side emission points:**

#### hooks
- Every `/hook/*` endpoint handler logs: hook name, slot number, session ID, agent name
- Example: `thinking-start slot=0 sid=ab3ce07 name=Ash`

#### tower
- `TowerEngine` emits on: slot state transitions (off→waiting, waiting→active, active→off), hirst phase changes (off→in, in→running, running→out, out→off), TTL expirations
- Only emits on actual state changes, not every frame
- Example: `slot0 off→active hirst:off→in`

#### esp
- `/api/esp32-status` handler logs each poll: agent count, slot states, mode
- Example: `poll agents=2 slots=[active,off,waiting,off]`

#### seats
- Desk assignment computation logs results when assignments change
- Example: `assign Ash→desk0 Jinx→desk2`

### Existing Client-Side Signals (renamed where noted)
- **agents**: CC state changes, departures, subagent spawn
- **claw**: health changes (Yeelight, mode, slots, slot ownership detail, transitions)
- **pixels**: quadrant activity, hirst state
- **net**: uptime monitor changes (renamed from "network")

### Filter UI

Toggle pills in the debug panel header bar, replacing the current static source labels.

**8 sources, each color-coded:**
| Source | Color |
|--------|-------|
| pixels | fuchsia-400 (#d946ef) |
| agents | lime-400 (#84cc16) |
| hooks | blue-400 (#3b82f6) |
| tower | orange-400 (#f97316) |
| esp | teal-400 (#2dd4bf) |
| seats | amber-400 (#fbbf24) |
| claw | rose-400 (#f43f5e) |
| net | violet-400 (#8b5cf6) |

**Behavior:**
- All sources active by default
- Click pill to toggle on/off
- Active: colored background tint + text
- Disabled: dimmed text, strikethrough, no background
- Filter applies to existing log entries (not just new ones)
- Filter state resets on panel close/reopen

### Implementation

**Server side:**
- Add `debugEmitter` EventEmitter in server.ts
- Each emission point calls `debugEmitter.emit("event", { source, text, time })`
- `/api/debug-events` SSE endpoint: subscribes to debugEmitter, streams events
- `TowerEngine` extends EventEmitter. Emits `"debug"` events on state transitions. Server subscribes and forwards to `debugEmitter`.

**Client side:**
- Debug panel subscribes to `EventSource("/api/debug-events")` on mount, disconnects on unmount
- SSE events merge into the same log array as client-side signals
- Filter state: `Set<DebugSource>` in component state, initialized with all sources
- Log rendering: `log.filter(e => activeFilters.has(e.source))`

---

## 4. Files Changed

| File | Change |
|------|--------|
| `src/components/scene/renderer.ts` | Sign light colors: read `clawHealth.mode` for top light (green/purple/red) |
| `src/App.tsx` | Remove inline diagnostics panel JSX, render `<SystemStatusPanel />` |
| `src/components/overlay/system-status-panel.tsx` | **New** — extracted + overhauled accordion panel |
| `src/components/store.ts` | Add `towerEngine`, `esp32`, `recovery` fields to `ClawHealth` type |
| `src/components/overlay/debug-panel.tsx` | SSE subscription, toggle-pill filters, rename sources, new `DebugSource` type |
| `src/server/server.ts` | Add `/api/debug-events` SSE, emit from hooks/esp, add tower/esp/recovery to claw-health response |
| `src/server/tower-engine.ts` | Extend EventEmitter, emit debug events on state transitions |

---

## 5. What's NOT Changing

- Network/uptime monitors stay in their current location (not moved into status panel)
- Status bar at bottom stays as-is (it's the quick-glance view; panel is the detail view)
- Debug panel toggle (press D) stays the same
- Claw health polling interval (5s) stays the same
- Pixel tower polling (100ms) stays the same
- Seat assignments are NOT shown in the status panel (removed — too much plumbing for a detail that's visible in the debug log)
