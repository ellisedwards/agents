# System Status Panel + Debug Signal Overhaul — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace "Claw Server Diagnostics" with a unified System Status accordion panel, add purple AWAY lights to the health poster sign, and expand the debug panel with SSE-backed signal sources and toggle-pill filters.

**Architecture:** Server emits debug events via a new SSE endpoint (`/api/debug-events`) driven by an EventEmitter. The `/api/claw-health` response is extended with tower engine, ESP32, and recovery state. The frontend gets a new `SystemStatusPanel` component (accordion) and an upgraded `DebugPanel` with SSE subscription and filter pills.

**Tech Stack:** TypeScript, React, Zustand, Express, SSE (EventSource), Node EventEmitter

**Spec:** `docs/superpowers/specs/2026-03-24-system-status-panel-design.md`

---

### Task 1: Sign lights — purple AWAY mode

**Files:**
- Modify: `src/components/scene/renderer.ts:595-686`

- [ ] **Step 1: Add STATUS_AWAY color constant**

At line ~497 alongside existing `STATUS_UP` / `STATUS_DOWN`:

```typescript
const STATUS_AWAY = "#a855f7";
```

- [ ] **Step 2: Update top light to use connection mode**

Replace the top light color logic at line 673:

```typescript
// Old:
ctx.fillStyle = clawHealth.reachable ? STATUS_UP : STATUS_DOWN;

// New:
const modeColor = clawHealth.mode === "home" ? STATUS_UP
  : clawHealth.mode === "away" ? STATUS_AWAY
  : STATUS_DOWN; // offline or null
ctx.fillStyle = modeColor;
```

- [ ] **Step 3: Bottom light stays as Yeelight status (no change needed)**

Verify line 684 still reads `clawHealth.yeelightConnected ? STATUS_UP : STATUS_DOWN`. No edit. (Note: the spec incorrectly called this "claw reachability" — it's actually Yeelight status and should stay that way.)

- [ ] **Step 4: Verify visually**

Open `localhost:5173`, confirm:
- AWAY mode → top light is purple
- Bottom light remains red (claw unreachable in away mode)

- [ ] **Step 5: Commit**

```bash
git add src/components/scene/renderer.ts
git commit -m "feat: sign lights show purple for AWAY mode"
```

---

### Task 2: Extend `/api/claw-health` with tower, ESP32, recovery state

**Files:**
- Modify: `src/server/server.ts:651-716` (claw-health endpoint)
- Modify: `src/server/tower-engine.ts` (add `getStatus()` method)
- Modify: `src/components/store.ts:32-50` (extend `ClawHealth` interface)

- [ ] **Step 1: Add `getStatus()` to TowerEngine**

In `src/server/tower-engine.ts`, after the existing `getSlotStates()` method:

```typescript
/** Summary for status panel */
getStatus(): { active: boolean; hirstPhase: string; slotStates: string[] } {
  return {
    active: this.isActive(),
    hirstPhase: this.hirstPhase,
    slotStates: [...this.slotStates],
  };
}
```

- [ ] **Step 2: Add tower, ESP32, recovery fields to claw-health response**

In `src/server/server.ts`, the `base` object in `/api/claw-health` (line 653):

```typescript
const base = {
  clawMode: activeClaw,
  mode: connectionMode,
  circuitBreakerOpen: clawCircuitOpen,
  bleConnected: isBleConnected(),
  espConnected: (Date.now() - espLastPoll) < 5000,
  // New fields:
  towerEngine: towerEngine.getStatus(),
  esp32: {
    polling: (Date.now() - espLastPoll) < 5000,
    lastPoll: espLastPoll > 0 ? espLastPoll : null,
  },
  recovery: {
    enabled: isHome(),
    inProgress: autoRecoveryInProgress,
  },
};
```

- [ ] **Step 3: Extend `ClawHealth` interface in store**

In `src/components/store.ts`, add to the `ClawHealth` interface:

```typescript
towerEngine?: {
  active: boolean;
  hirstPhase: string;
  slotStates: string[];
};
esp32?: {
  polling: boolean;
  lastPoll: number | null;
};
recovery?: {
  enabled: boolean;
  inProgress: boolean;
};
```

- [ ] **Step 4: Verify endpoint returns new data**

```bash
curl -s http://localhost:4747/api/claw-health | python3 -m json.tool | grep -A5 towerEngine
```

Expected: `towerEngine`, `esp32`, `recovery` fields present.

- [ ] **Step 5: Commit**

```bash
git add src/server/tower-engine.ts src/server/server.ts src/components/store.ts
git commit -m "feat: extend claw-health with tower engine, ESP32, recovery state"
```

---

### Task 3: Create SystemStatusPanel component

**Files:**
- Create: `src/components/overlay/system-status-panel.tsx`
- Modify: `src/App.tsx` (replace inline diagnostics JSX with new component)

- [ ] **Step 1: Create `system-status-panel.tsx`**

Extract and overhaul the existing diagnostics panel from `App.tsx` lines 84-195. The new component:

```typescript
import { useState, useCallback, useRef, useEffect } from "react";
import { useAgentOfficeStore } from "@/components/store";

type Section = "claw" | "tower" | "agents" | "esp" | "recovery";

export function SystemStatusPanel() {
  const clawHealth = useAgentOfficeStore((s) => s.clawHealth);
  const agents = useAgentOfficeStore((s) => s.agents);
  const toggleClawDetail = useAgentOfficeStore((s) => s.toggleClawDetail);

  const [expanded, setExpanded] = useState<Set<Section>>(new Set(["claw"]));
  const [pos, setPos] = useState({ x: 12, y: 12 });
  const dragging = useRef(false);
  const dragOffset = useRef({ x: 0, y: 0 });

  const toggle = (section: Section) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(section) ? next.delete(section) : next.add(section);
      return next;
    });
  };

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    dragging.current = true;
    dragOffset.current = { x: e.clientX - pos.x, y: e.clientY - pos.y };
    const onMove = (ev: MouseEvent) => {
      if (!dragging.current) return;
      setPos({ x: ev.clientX - dragOffset.current.x, y: ev.clientY - dragOffset.current.y });
    };
    const onUp = () => { dragging.current = false; window.removeEventListener("mousemove", onMove); window.removeEventListener("mouseup", onUp); };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }, [pos]);

  if (!clawHealth) return null;

  const mode = clawHealth.mode || "offline";
  const modeBg = mode === "home" ? "rgba(34,197,94,0.1)" : mode === "away" ? "rgba(168,85,247,0.1)" : "rgba(239,68,68,0.1)";
  const modeColor = mode === "home" ? "text-green-400" : mode === "away" ? "text-purple-400" : "text-red-400";
  const modeHost = mode === "home" ? "LAN" : mode === "away" ? "Tailscale" : "—";

  const ccAgents = agents.filter((a) => a.source === "cc" && a.subagentClass == null);
  const subAgents = agents.filter((a) => a.source === "cc" && a.subagentClass != null);
  const ocAgents = agents.filter((a) => a.source === "openclaw");

  const te = clawHealth.towerEngine;
  const esp = clawHealth.esp32;
  const rec = clawHealth.recovery;

  return (
    <div
      className="absolute bg-[#12121e]/95 border border-white/10 rounded-md p-3 min-w-[240px] font-mono text-[10px] space-y-0 z-50 select-none"
      style={{ left: pos.x, top: pos.y }}
      onMouseDown={onMouseDown}
    >
      {/* Header */}
      <div className="flex justify-between items-center border-b border-white/10 pb-1 mb-1">
        <span className="text-white/50 text-[9px] uppercase tracking-widest">System Status</span>
        <button onClick={toggleClawDetail} className="text-neutral-500 hover:text-white text-[9px] ml-4">x</button>
      </div>

      {/* Mode banner */}
      <div className="rounded px-2 py-1 mb-1" style={{ background: modeBg }}>
        <div className="flex justify-between">
          <span className={modeColor}>● {mode.toUpperCase()}</span>
          <span className="text-neutral-500 text-[9px]">{modeHost}</span>
        </div>
      </div>

      {/* --- Claw Server --- */}
      <SectionHeader label="Claw Server" expanded={expanded.has("claw")} onClick={() => toggle("claw")}
        summary={clawHealth.reachable ? <span className="text-green-400 text-[9px]">reachable</span> : <span className="text-red-400 text-[9px]">unreachable</span>} />
      {expanded.has("claw") && (
        <div className="pl-2 space-y-0.5 pb-1">
          <Row label="Server" value={clawHealth.reachable ? "reachable" : "unreachable"} ok={clawHealth.reachable} />
          <Row label="Yeelight" value={clawHealth.yeelightConnected ? "connected" : "disconnected"} ok={clawHealth.yeelightConnected} />
          {clawHealth.matrixMode && <Row label="Mode" value={clawHealth.matrixMode} />}
          {clawHealth.brightness != null && <Row label="Brightness" value={`${clawHealth.brightness}%`} />}
          <div className="flex justify-between">
            <span className="text-neutral-400">Slots</span>
            <span className="flex gap-1">
              {clawHealth.slots.map((s, i) => (
                <span key={i} className={`w-2 h-2 rounded-sm inline-block ${s === "active" ? "bg-green-400" : s === "off" ? "bg-neutral-600" : "bg-yellow-400"}`} title={`Slot ${i}: ${s}`} />
              ))}
            </span>
          </div>
          {clawHealth.slotsDetail?.some((s) => s.name) && (
            <div className="space-y-0.5 pt-0.5 border-t border-white/5">
              {clawHealth.slotsDetail.map((sd, i) => sd.name ? (
                <div key={i} className="flex justify-between">
                  <span className="text-neutral-500">S{i}: {sd.name}</span>
                  <span className="text-neutral-400">{sd.ttl_remaining != null && sd.ttl_remaining > 0 ? `${sd.ttl_remaining}s` : sd.state}</span>
                </div>
              ) : null)}
              {(clawHealth.waitingCount ?? 0) > 0 && <Row label="Waiting" value={String(clawHealth.waitingCount)} warn />}
            </div>
          )}
          {clawHealth.zones && (
            <div className="text-neutral-500 text-[8px] pt-0.5 border-t border-white/5">
              {[clawHealth.zones.thinking !== "off" && `think:${clawHealth.zones.thinking}`, clawHealth.zones.display !== "clear" && `disp:${clawHealth.zones.display}`, `ctx:${clawHealth.zones.context}`].filter(Boolean).join(" ")}
            </div>
          )}
          {clawHealth.animationRunning && <Row label="Animation" value="running" warn />}
          {clawHealth.transitionInProgress && <Row label="Transition" value="in progress" cyan />}
        </div>
      )}

      {/* --- Tower Engine --- */}
      <SectionHeader label="Tower Engine" expanded={expanded.has("tower")} onClick={() => toggle("tower")}
        summary={te?.active ? <span className="text-green-400 text-[9px]">active</span> : <span className="text-neutral-500 text-[9px]">idle</span>} />
      {expanded.has("tower") && te && (
        <div className="pl-2 space-y-0.5 pb-1">
          <Row label="Hirst" value={te.hirstPhase} warn={te.hirstPhase !== "off"} />
          <div className="flex justify-between">
            <span className="text-neutral-400">Slots</span>
            <span className="flex gap-1">
              {te.slotStates.map((s, i) => (
                <span key={i} className={`w-2 h-2 rounded-sm inline-block ${s === "active" ? "bg-green-400" : s === "off" ? "bg-neutral-600" : "bg-yellow-400"}`} title={`Slot ${i}: ${s}`} />
              ))}
            </span>
          </div>
          {mode !== "home" && <div className="text-neutral-500 text-[8px]">simulated (local engine)</div>}
        </div>
      )}

      {/* --- Agents --- */}
      <SectionHeader label="Agents" expanded={expanded.has("agents")} onClick={() => toggle("agents")}
        summary={<span className="text-[#c4856c] text-[9px]">CC:{ccAgents.length} OC:{ocAgents.length}</span>} />
      {expanded.has("agents") && (
        <div className="pl-2 space-y-0.5 pb-1">
          {agents.map((a) => (
            <div key={a.id} className="flex justify-between">
              <span className="text-neutral-400 truncate max-w-[120px]">{a.name}</span>
              <span className={a.state === "thinking" ? "text-amber-400" : a.state === "typing" || a.state === "reading" ? "text-sky-400" : "text-neutral-500"}>
                {a.state}{a.currentTool ? `(${a.currentTool})` : ""}
              </span>
            </div>
          ))}
          {subAgents.length > 0 && <div className="text-neutral-500 text-[8px]">{subAgents.length} subagent{subAgents.length > 1 ? "s" : ""}</div>}
        </div>
      )}

      {/* --- ESP32 --- */}
      <SectionHeader label="ESP32 Buddy" expanded={expanded.has("esp")} onClick={() => toggle("esp")}
        summary={esp?.polling ? <span className="text-teal-400 text-[9px]">polling {esp.lastPoll ? `${Math.round((Date.now() - esp.lastPoll) / 1000)}s ago` : ""}</span> : <span className="text-neutral-500 text-[9px]">idle</span>} />
      {expanded.has("esp") && esp && (
        <div className="pl-2 space-y-0.5 pb-1">
          <Row label="Status" value={esp.polling ? "polling" : "idle"} ok={esp.polling} />
          {esp.lastPoll && <Row label="Last poll" value={`${Math.round((Date.now() - esp.lastPoll) / 1000)}s ago`} />}
        </div>
      )}

      {/* --- Recovery --- */}
      <SectionHeader label="Recovery" expanded={expanded.has("recovery")} onClick={() => toggle("recovery")}
        summary={<span className="text-neutral-500 text-[9px]">{rec?.enabled ? "enabled" : "disabled"}</span>} />
      {expanded.has("recovery") && rec && (
        <div className="pl-2 space-y-0.5 pb-1">
          <Row label="Status" value={rec.enabled ? `active (${mode})` : `disabled (${mode})`} ok={rec.enabled} />
          {rec.inProgress && <Row label="Action" value="in progress" warn />}
        </div>
      )}
    </div>
  );
}

// --- Helpers ---

function SectionHeader({ label, expanded, onClick, summary }: { label: string; expanded: boolean; onClick: () => void; summary: React.ReactNode }) {
  return (
    <div className="flex justify-between items-center py-1 cursor-pointer border-b border-white/5 hover:bg-white/[0.03]" onClick={onClick}>
      <span className={expanded ? "text-neutral-200" : "text-neutral-400"}>
        {expanded ? "▾" : "▸"} {label}
      </span>
      {!expanded && summary}
    </div>
  );
}

function Row({ label, value, ok, warn, cyan }: { label: string; value: string; ok?: boolean; warn?: boolean; cyan?: boolean }) {
  const color = ok === true ? "text-green-400" : ok === false ? "text-red-400" : warn ? "text-yellow-400" : cyan ? "text-cyan-400" : "text-neutral-300";
  return (
    <div className="flex justify-between">
      <span className="text-neutral-400">{label}</span>
      <span className={color}>{value}</span>
    </div>
  );
}
```

- [ ] **Step 2: Replace inline diagnostics in App.tsx**

Remove the entire `{clawDetailOpen && clawHealth && ( ... )}` block (lines 84-195) and replace with:

```typescript
// Add import at top:
import { SystemStatusPanel } from "@/components/overlay/system-status-panel";

// In JSX, replace the old block with:
{clawDetailOpen && <SystemStatusPanel />}
```

- [ ] **Step 3: Verify visually**

Open `localhost:5173`, click the health poster sign. Confirm:
- "System Status" title with mode banner
- Claw Server section expanded by default
- Other sections collapsed with summaries
- Click to expand/collapse works
- Draggable

- [ ] **Step 4: Commit**

```bash
git add src/components/overlay/system-status-panel.tsx src/App.tsx
git commit -m "feat: System Status panel replaces Claw Server Diagnostics"
```

---

### Task 4: Server-side debug event emitter + SSE endpoint

**Files:**
- Modify: `src/server/server.ts` (add debugEmitter, SSE endpoint, emit from hooks/esp)
- Modify: `src/server/tower-engine.ts` (extend EventEmitter, emit debug events)

- [ ] **Step 1: Make TowerEngine extend EventEmitter**

In `src/server/tower-engine.ts`, add import and extend:

```typescript
import { EventEmitter } from "events";

export class TowerEngine extends EventEmitter {
  constructor() {
    super();
    // ... existing init code
  }
```

- [ ] **Step 2: Emit debug events on tower state transitions**

In `onPromptStart`:
```typescript
onPromptStart(slot: number): void {
  if (slot < 0 || slot > 3) return;
  const prev = this.slotStates[slot];
  if (this.slotStates[slot] === "off") {
    this.slotStates[slot] = "waiting";
  }
  this.slotLastActivity[slot] = Date.now();
  if (this.slotStates[slot] !== prev) {
    this.emit("debug", { source: "tower", text: `slot${slot} ${prev}→${this.slotStates[slot]}`, time: Date.now() });
  }
}
```

In `onThinkingStart`:
```typescript
onThinkingStart(slot: number): void {
  if (slot < 0 || slot > 3) return;
  const wasAnyActive = this.slotStates.some(s => s === "active");
  const prev = this.slotStates[slot];
  this.slotStates[slot] = "active";
  this.slotLastActivity[slot] = Date.now();
  if (prev !== "active") {
    this.emit("debug", { source: "tower", text: `slot${slot} ${prev}→active${!wasAnyActive && this.hirstPhase === "off" ? " hirst:off→in" : ""}`, time: Date.now() });
  }
  if (!wasAnyActive && this.hirstPhase === "off") {
    this.hirstPhase = "in";
    this.hirstTransitionStart = Date.now();
    this.hirstColumnOffsets = [0, 0, 0, 0, 0];
  }
}
```

In `onThinkingEnd`:
```typescript
onThinkingEnd(slot: number): void {
  if (slot < 0 || slot > 3) return;
  const prev = this.slotStates[slot];
  this.slotStates[slot] = "off";
  this.slotLastActivity[slot] = Date.now();
  if (prev !== "off") {
    this.emit("debug", { source: "tower", text: `slot${slot} ${prev}→off`, time: Date.now() });
  }
  const anyActive = this.slotStates.some(s => s === "active");
  if (!anyActive && (this.hirstPhase === "running" || this.hirstPhase === "in")) {
    this.emit("debug", { source: "tower", text: `hirst:${this.hirstPhase}→out`, time: Date.now() });
    this.hirstPhase = "out";
    this.hirstTransitionStart = Date.now();
  }
}
```

In `updateHirstPhase`, emit on phase transitions:
```typescript
private updateHirstPhase(now: number): void {
  if (this.hirstPhase === "in") {
    if (now - this.hirstTransitionStart >= 600) {
      this.emit("debug", { source: "tower", text: "hirst:in→running", time: now });
      this.hirstPhase = "running";
    }
  } else if (this.hirstPhase === "out") {
    if (now - this.hirstTransitionStart >= 450) {
      this.emit("debug", { source: "tower", text: "hirst:out→off", time: now });
      this.hirstPhase = "off";
    }
  }
}
```

In TTL check (inside `tick()`), emit on auto-deactivate. Note: the TTL block emits its own debug event and then calls `onThinkingEnd` which would emit again — so suppress the duplicate by setting the slot to "off" before calling `onThinkingEnd` (which will see no state change and skip its emit):
```typescript
for (let i = 0; i < 4; i++) {
  if (this.slotStates[i] !== "off" && now - this.slotLastActivity[i] > TTL_MS) {
    const prev = this.slotStates[i];
    this.emit("debug", { source: "tower", text: `slot${i} TTL expired (${prev}→off)`, time: now });
    this.slotStates[i] = "off"; // set off first so onThinkingEnd sees no change
    this.onThinkingEnd(i);      // handles hirst-out logic
  }
}
```

Also add debug emission to `onPromptEnd` (currently missing — it also transitions slots to "off"):
```typescript
onPromptEnd(slot: number): void {
  if (slot < 0 || slot > 3) return;
  const prev = this.slotStates[slot];
  this.slotStates[slot] = "off";
  this.slotLastActivity[slot] = Date.now();
  if (prev !== "off") {
    this.emit("debug", { source: "tower", text: `slot${slot} ${prev}→off (prompt-end)`, time: Date.now() });
  }
}
```

- [ ] **Step 3: Add debugEmitter and SSE endpoint in server.ts**

Near the top of server.ts (after imports):
```typescript
import { EventEmitter } from "events";
const debugEmitter = new EventEmitter();
debugEmitter.setMaxListeners(20);
```

After hook endpoints, add the SSE endpoint:
```typescript
// --- Debug SSE stream ---
app.get("/api/debug-events", (req, res) => {
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
  });

  const onEvent = (evt: { source: string; text: string; time: number }) => {
    res.write(`data: ${JSON.stringify(evt)}\n\n`);
  };
  debugEmitter.on("event", onEvent);

  req.on("close", () => {
    debugEmitter.off("event", onEvent);
  });
});
```

- [ ] **Step 4: Emit from hook endpoints**

In each `/hook/*` handler, after the tower engine call, add:
```typescript
// In /hook/prompt-start:
debugEmitter.emit("event", { source: "hooks", text: `prompt-start slot=${slot} sid=${session_id} name=${name}`, time: Date.now() });

// In /hook/thinking-start:
debugEmitter.emit("event", { source: "hooks", text: `thinking-start slot=${slot} sid=${session_id} name=${name}`, time: Date.now() });

// In /hook/thinking-end:
debugEmitter.emit("event", { source: "hooks", text: `thinking-end slot=${slot} sid=${session_id} name=${name}`, time: Date.now() });

// In /hook/prompt-end:
debugEmitter.emit("event", { source: "hooks", text: `prompt-end slot=${slot} sid=${session_id} name=${name}`, time: Date.now() });
```

- [ ] **Step 5: Emit from ESP32 status endpoint**

In the `/api/esp32-status` handler, after building the response:
```typescript
debugEmitter.emit("event", { source: "esp", text: `poll agents=${agents.length} slots=[${engineSlots.join(",")}] mode=${connectionMode}`, time: Date.now() });
```

- [ ] **Step 6: Forward tower engine debug events to debugEmitter**

After `towerEngine.start()` (near bottom of server.ts):
```typescript
towerEngine.on("debug", (evt: { source: string; text: string; time: number }) => {
  debugEmitter.emit("event", evt);
});
```

- [ ] **Step 7: Verify SSE stream**

```bash
curl -N -s http://localhost:4747/api/debug-events &
# Trigger a hook:
curl -s "http://localhost:4747/hook/thinking-start?slot=0&session_id=test&name=test"
# Should see SSE events printed
kill %1
```

- [ ] **Step 8: Commit**

```bash
git add src/server/server.ts src/server/tower-engine.ts
git commit -m "feat: debug event emitter + SSE endpoint for hooks, tower, ESP"
```

---

### Task 5: Upgrade debug panel with SSE subscription + filter pills

**Files:**
- Modify: `src/components/overlay/debug-panel.tsx`

- [ ] **Step 1: Update source type and colors**

Replace the `LogEntry` interface and `SRC_COLORS`:

```typescript
type DebugSource = "pixels" | "agents" | "hooks" | "tower" | "esp" | "seats" | "claw" | "net";

interface LogEntry {
  time: number;
  source: DebugSource;
  text: string;
}

const SRC_COLORS: Record<DebugSource, string> = {
  pixels: "text-fuchsia-400",
  agents: "text-lime-400",
  hooks: "text-blue-400",
  tower: "text-orange-400",
  esp: "text-teal-400",
  seats: "text-amber-400",
  claw: "text-rose-400",
  net: "text-violet-400",
};

const ALL_SOURCES: DebugSource[] = ["pixels", "agents", "hooks", "tower", "esp", "seats", "claw", "net"];
```

- [ ] **Step 2: Rename existing source references**

In the claw health effect, change `source: "claw"` (already correct).
In the slot detail effect, change `source: "slots"` to `source: "seats"`.
In the network effect, change `source: "network"` to `source: "net"`.

- [ ] **Step 3: Add filter state**

Inside `DebugPanel` component:

```typescript
const [activeFilters, setActiveFilters] = useState<Set<DebugSource>>(new Set(ALL_SOURCES));

const toggleFilter = (src: DebugSource) => {
  setActiveFilters((prev) => {
    const next = new Set(prev);
    next.has(src) ? next.delete(src) : next.add(src);
    return next;
  });
};
```

- [ ] **Step 4: Add SSE subscription**

Inside `DebugPanel`, add an effect:

```typescript
useEffect(() => {
  const es = new EventSource("/api/debug-events");
  es.onmessage = (e) => {
    try {
      const evt = JSON.parse(e.data) as { source: DebugSource; text: string; time: number };
      setLog((prev) => [...prev.slice(-MAX_LINES), { time: evt.time, source: evt.source, text: evt.text }]);
    } catch {}
  };
  return () => es.close();
}, []);
```

- [ ] **Step 5: Replace static source labels with toggle pills**

Replace the header `<span>` list with:

```typescript
<span className="flex gap-1 text-[8px]">
  {ALL_SOURCES.map((src) => {
    const active = activeFilters.has(src);
    return (
      <span
        key={src}
        onClick={() => toggleFilter(src)}
        className={`cursor-pointer px-1.5 py-0.5 rounded-full transition-all ${
          active
            ? SRC_COLORS[src]
            : "text-neutral-600 line-through"
        }`}
        style={active ? { backgroundColor: `color-mix(in srgb, currentColor 15%, transparent)` } : undefined}
      >
        {src}
      </span>
    );
  })}
</span>
```

- [ ] **Step 6: Apply filter to log rendering**

Change the log map to filter:

```typescript
{log.filter((entry) => activeFilters.has(entry.source)).map((entry, i) => (
  // ... existing row rendering
))}
```

- [ ] **Step 7: Update colorizeText regex for new keywords**

Add new state keywords to the regex pattern: `prompt-start|thinking-start|thinking-end|prompt-end|poll|assign|TTL`.

- [ ] **Step 8: Verify visually**

Open `localhost:5173`, press D for debug panel. Confirm:
- 8 colored toggle pills in header
- Click a pill to disable → entries hidden, pill dimmed with strikethrough
- SSE events appear for hooks, tower, esp when activity occurs
- Existing client-side signals still work

- [ ] **Step 9: Commit**

```bash
git add src/components/overlay/debug-panel.tsx
git commit -m "feat: debug panel with SSE signals, toggle-pill filters, new sources"
```

---

### Task 6: Seat assignment debug signals

**Files:**
- Modify: `src/components/scene/desk-layout.ts` (emit seat assignments)
- Modify: `src/components/overlay/debug-panel.tsx` (consume seat events)

- [ ] **Step 1: Expose seat assignment changes**

In `src/components/scene/desk-layout.ts`, after `computeAssignments` returns, store the result in a module-level variable that the debug panel can read. Add a callback mechanism:

```typescript
// At module level (after existing module-scoped vars like cachedResult):
let prevSeatSummary = "";
let seatChangeCallback: ((text: string) => void) | null = null;
export function onSeatChange(cb: ((text: string) => void) | null) { seatChangeCallback = cb; }

// Inside computeAssignments, just before the final `return` statement,
// after `assignments` Map is fully built, add:
const summary = [...assignments.entries()].map(([id, asgn]) => {
  return `${asgn.name || "?"}→desk${asgn.deskIndex}`;
}).join(" ");
if (summary !== prevSeatSummary) {
  prevSeatSummary = summary;
  if (seatChangeCallback && summary) seatChangeCallback(`assign ${summary}`);
}
```

Note: check the actual return type of `computeAssignments` to confirm the shape of `asgn` — the `deskIndex` and `name` fields may differ. Read the function to verify before implementing.

- [ ] **Step 2: Subscribe in debug panel**

```typescript
import { onSeatChange } from "@/components/scene/desk-layout";

// In DebugPanel useEffect:
useEffect(() => {
  onSeatChange((text) => {
    setLog((prev) => [...prev.slice(-MAX_LINES), { time: Date.now(), source: "seats" as DebugSource, text }]);
  });
  return () => onSeatChange(null);
}, []);
```

- [ ] **Step 3: Verify**

Open debug panel, watch for `seats` entries when agents change desks.

- [ ] **Step 4: Commit**

```bash
git add src/components/scene/desk-layout.ts src/components/overlay/debug-panel.tsx
git commit -m "feat: seat assignment debug signals"
```

---

### Task 7: Final cleanup + verification

- [ ] **Step 1: Remove stale references**

Search for any remaining references to "Claw Server Diagnostics" and update/remove.

- [ ] **Step 2: Full visual walkthrough**

1. Start in AWAY mode — sign top light should be purple
2. Click sign → System Status panel opens with mode banner purple/AWAY
3. Expand each section, verify data populates
4. Press D → debug panel with 8 filter pills
5. Toggle filters on/off
6. Trigger a hook (start a claude code session) → see hooks/tower/agents signals flow in

- [ ] **Step 3: Commit**

```bash
# Add only the specific files that were cleaned up — do NOT use git add -A
git add <specific files changed>
git commit -m "chore: cleanup stale references after status panel overhaul"
```
