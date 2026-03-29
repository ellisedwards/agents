import express from "express";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import { execFile } from "child_process";
import { EventEmitter } from "events";
const debugEmitter = new EventEmitter();
debugEmitter.setMaxListeners(20);
import { loadConfig, clawBaseUrl } from "./config";
import { createWatcher } from "./agents/watcher-singleton";
import type { AgentState } from "../shared/types";
import { startBleBridge, updateBleState, isBleConnected } from "./ble-bridge";
import { TowerEngine } from "./tower-engine";
import { MAGE_COLORS, MAGE_WIDTH, MAGE_HEIGHT, makeMageSprite, makeMageWalk1, makeMageWalk2 } from "../components/characters/colored-mages";
import { CLAWD_SPRITES, CLAWD_WIDTH, CLAWD_HEIGHT } from "../components/characters/clawd";
import type { PixelRect } from "../components/characters/clawd";
import { CHARMANDER_SPRITES, CHARMANDER_WIDTH, CHARMANDER_HEIGHT } from "../components/characters/charmander";
import { SQUIRTLE_SPRITES, SQUIRTLE_WIDTH, SQUIRTLE_HEIGHT } from "../components/characters/squirtle";
import { BULBASAUR_SPRITES, BULBASAUR_WIDTH, BULBASAUR_HEIGHT } from "../components/characters/bulbasaur";
import { MEW_SPRITES, MEW_WIDTH, MEW_HEIGHT, MEW_WALK1, MEW_WALK2, MEW_SLEEP } from "../components/characters/mew";
import { TRAINER_SPRITES, TRAINER_BLINK, TRAINER_WIDTH, TRAINER_HEIGHT } from "../components/characters/trainer";
import { PIKACHU_SPRITES, PIKACHU_WIDTH, PIKACHU_HEIGHT, PIKACHU_WALK1, PIKACHU_WALK2 } from "../components/characters/pikachu";
import { CLAW_SPRITES, CLAW_WIDTH, CLAW_HEIGHT } from "../components/characters/claw";

// --- Claw API response types ---
interface ClawStatus {
  connected: boolean;
  brightness?: number;
  claw_activity?: string;
  animation_running?: boolean;
  agent_slots?: { slots: string[] };
}

interface ClawPixels {
  panels?: { top?: string[]; bottom?: string[] };
  clawActivity?: string;
  slotsDetail?: Array<{ session_id?: string; name?: string }>;
}

interface ClawSlots {
  slots_detail?: Array<{ session_id?: string; name?: string }>;
}

interface ClawRelay {
  messages?: Array<{ from?: string; msg: string; time: string }>;
}

interface ClawReplyRelay {
  replies?: Array<{ msg: string; time: string }>;
}

interface RelayMessage {
  from: string;
  msg: string;
  time: string;
}

// --- Claw cache ---
// Single source of truth for all claw data. Refreshed once per second.
// All endpoints and internal loops read from here instead of hitting the claw.
interface ClawCache {
  tower1: {
    pixels: ClawPixels | null;
    status: ClawStatus | null;
    slots: ClawSlots | null;
    agentSlots: { slots: string[]; waiting_count: number; active_count: number } | null;
    lastUpdated: number;
  };
  tower2: {
    data: any | null;
    lastUpdated: number;
  };
  uptimeKuma: {
    data: any | null;
    lastUpdated: number;
  };
  relay: {
    messages: RelayMessage[];
    replies: Array<{ msg: string; time: string }>;
    lastUpdated: number;
  };
}

const clawCache: ClawCache = {
  tower1: { pixels: null, status: null, slots: null, agentSlots: null, lastUpdated: 0 },
  tower2: { data: null, lastUpdated: 0 },
  uptimeKuma: { data: null, lastUpdated: 0 },
  relay: { messages: [], replies: [], lastUpdated: 0 },
};

// --- Claw communication via curl ---
// Node's networking gets permanently poisoned when a destination becomes
// temporarily unreachable (macOS per-process routing cache). Both fetch()
// and http.get fail with EHOSTUNREACH even after the host comes back.
// curl is immune because each invocation is a fresh process.

// --- Connection mode ---
// Agent Office knows what mode it's in. Everything else reads this.
type ConnectionMode = "home" | "away" | "offline";
let connectionMode: ConnectionMode = "offline";
let activeClaw: "primary" | "fallback" = "primary";
let primaryCheckTimer: ReturnType<typeof setTimeout> | null = null;
let homePollFailCount = 0;
const HOME_POLL_FAIL_THRESHOLD = 5; // consecutive failures before switching to away

/** Current mode — exposed to all endpoints and downstream tools */
export function getConnectionMode(): ConnectionMode { return connectionMode; }
function isHome(): boolean { return connectionMode === "home"; }
function isAway(): boolean { return connectionMode === "away"; }

function getClawUrl(): string {
  return activeClaw === "primary" ? claw : clawFallback;
}

function setMode(mode: ConnectionMode) {
  if (mode !== connectionMode) {
    connectionMode = mode;
    console.log(`[mode] ${mode.toUpperCase()}${mode === "home" ? ` (${claw})` : mode === "away" ? ` (${clawFallback})` : ""}`);
  }
}

function switchToFallback() {
  if (activeClaw === "fallback") return;
  activeClaw = "fallback";
  setMode(clawFallback ? "away" : "offline");
  // Periodically try primary again
  if (!primaryCheckTimer) {
    primaryCheckTimer = setInterval(() => {
      curlRaw(claw, "/status", 1).then(() => {
        activeClaw = "primary";
        homePollFailCount = 0;
        setMode("home");
        if (primaryCheckTimer) { clearInterval(primaryCheckTimer); primaryCheckTimer = null; }
      }).catch(() => {}); // still down, stay on fallback/away
    }, 60_000);
  }
}

function curlRaw(baseUrl: string, urlPath: string, timeoutSec = 2): Promise<unknown> {
  const url = `${baseUrl}${urlPath}`;
  return new Promise((resolve, reject) => {
    execFile("curl", [
      "-s",
      "--connect-timeout", String(timeoutSec),
      "--max-time", String(timeoutSec),
      url,
    ], { timeout: (timeoutSec * 1000) + 1000 }, (err, stdout) => {
      if (err) return reject(new Error(`claw unreachable: ${urlPath}`));
      const trimmed = stdout.trim();
      if (!trimmed) return reject(new Error("empty response"));
      try { resolve(JSON.parse(trimmed)); }
      catch { reject(new Error("bad json")); }
    });
  });
}

async function clawGet(_claw: string, urlPath: string, timeoutSec = 2): Promise<unknown> {
  try {
    return await curlRaw(getClawUrl(), urlPath, timeoutSec);
  } catch (err) {
    // If primary failed, try fallback
    if (activeClaw === "primary" && clawFallback) {
      try {
        const result = await curlRaw(clawFallback, urlPath, timeoutSec);
        switchToFallback();
        return result;
      } catch { /* fallback also failed */ }
    }
    throw err;
  }
}

function clawPost(_claw: string, urlPath: string, body: object, timeoutSec = 3): Promise<unknown> {
  const doPost = (baseUrl: string) => {
    const url = `${baseUrl}${urlPath}`;
    return new Promise<unknown>((resolve, reject) => {
      execFile("curl", [
        "-s", "-X", "POST",
        "-H", "Content-Type: application/json",
        "-d", JSON.stringify(body),
        "--connect-timeout", String(timeoutSec),
        "--max-time", String(timeoutSec),
        url,
      ], { timeout: (timeoutSec * 1000) + 1000 }, (err, stdout) => {
        if (err) return reject(new Error(`claw unreachable: ${urlPath}`));
        try { resolve(JSON.parse(stdout || "{}")); }
        catch { resolve({}); }
      });
    });
  };

  return doPost(getClawUrl()).catch((err) => {
    if (activeClaw === "primary" && clawFallback) {
      return doPost(clawFallback).then((result) => {
        switchToFallback();
        return result;
      });
    }
    throw err;
  });
}

// Circuit breaker for claw communication
let clawCircuitOpen = false;
let clawFailCount = 0;
let clawLastFailTime = 0;
const CLAW_FAIL_THRESHOLD = 3;
const CLAW_RECOVERY_MS = 30_000;

async function clawGetSafe(urlPath: string, timeoutSec = 2): Promise<unknown> {
  if (clawCircuitOpen) {
    if (Date.now() - clawLastFailTime < CLAW_RECOVERY_MS) {
      throw new Error("claw circuit open");
    }
    clawCircuitOpen = false;
    clawFailCount = 0;
    console.log("[claw] circuit breaker CLOSED — retrying");
  }
  try {
    const result = await clawGet(claw, urlPath, timeoutSec);
    clawFailCount = 0;
    return result;
  } catch (err) {
    clawFailCount++;
    clawLastFailTime = Date.now();
    if (clawFailCount >= CLAW_FAIL_THRESHOLD && !clawCircuitOpen) {
      clawCircuitOpen = true;
      console.log("[claw] circuit breaker OPEN — pausing requests for 30s");
    }
    throw err;
  }
}

// Yeelight level-up sparkle — fire-and-forget
const lastSparkleTime = new Map<number, number>();
function triggerLevelUpSparkle(slotIndex: number) {
  const now = Date.now();
  const last = lastSparkleTime.get(slotIndex) ?? 0;
  if (now - last < 5000) return; // 5s cooldown
  lastSparkleTime.set(slotIndex, now);
  clawPost(claw, "/hook/agent-slots/sparkle", {
    slot: slotIndex,
    duration: 2.0,
  }).catch(() => {}); // silent fail
}

// --- Auto-recovery: reconnect Yeelight if connection drops ---
let lastMatrixConnected = true;
let autoRecoveryInProgress = false;
let lastRecoveryAttempt = 0;
const RECOVERY_COOLDOWN = 300_000; // 5 minutes between recovery attempts
const DISCONNECT_GRACE = 30_000; // 30s grace period before attempting recovery
let disconnectedSince = 0;

function getActiveClawHost(): string {
  return activeClaw === "fallback" && config.clawHostFallback
    ? config.clawHostFallback : config.clawHost;
}

function checkAndAutoRecover(_claw: string) {
  setInterval(async () => {
    if (autoRecoveryInProgress) return;
    if (!isHome()) return;

    const statusData = clawCache.tower1.status;
    if (!statusData) return;

    const connected = statusData.connected === true;

    if (!connected && lastMatrixConnected) {
      // Just went disconnected — start grace timer
      disconnectedSince = Date.now();
    }

    if (connected) {
      disconnectedSince = 0;
      if (!lastMatrixConnected) {
        console.log("[auto-recovery] Yeelight reconnected");
      }
    }

    // Only attempt recovery after grace period and cooldown
    if (!connected && disconnectedSince > 0 &&
        (Date.now() - disconnectedSince) > DISCONNECT_GRACE &&
        (Date.now() - lastRecoveryAttempt) > RECOVERY_COOLDOWN) {

      console.log("[auto-recovery] Yeelight disconnected for 30s, attempting /reconnect...");
      autoRecoveryInProgress = true;
      lastRecoveryAttempt = Date.now();

      try {
        const result = await curlRaw(claw, "/reconnect", 5) as any;
        console.log("[auto-recovery] Reconnect result:", JSON.stringify(result));
        if (!result?.ok) {
          // Reconnect failed — try full tower-reset as last resort
          console.log("[auto-recovery] Reconnect failed, trying tower-reset...");
          execFile("ssh", ["-T", "-o", "ConnectTimeout=5", "-o", "StrictHostKeyChecking=accept-new", `ellis@${getActiveClawHost()}`,
            "~/clawd/scripts/tower-reset"], { timeout: 15000 },
            (err, stdout) => {
              autoRecoveryInProgress = false;
              if (err) console.error("[auto-recovery] Reset failed:", err.message);
              else console.log("[auto-recovery] Reset result:", stdout.trim());
            });
          return; // let the callback clear autoRecoveryInProgress
        }
      } catch {
        console.log("[auto-recovery] /reconnect endpoint unreachable");
      }
      autoRecoveryInProgress = false;
    }

    lastMatrixConnected = connected;
  }, 10000); // check every 10s
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const config = loadConfig();
const claw = clawBaseUrl(config);
const clawFallback = config.clawHostFallback
  ? `http://${config.clawHostFallback}:${config.clawPort}`
  : "";
const watcher = createWatcher(claw, clawFallback || undefined);

const app = express();

// --- Build ID (for stale-build detection) ---
// Read from disk so rebuilds are detected without restarting the server
// Vite writes to <root>/dist/.build-id
// In dev (__dirname=src/server) → ../../dist, in prod (__dirname=dist) → ./
const buildIdFile = __dirname.includes("src" + path.sep + "server")
  ? path.join(__dirname, "..", "..", "dist", ".build-id")
  : path.join(__dirname, ".build-id");
const serverStartedAt = new Date().toISOString();
app.get("/api/build-id", (_req, res) => {
  try {
    const buildId = fs.readFileSync(buildIdFile, "utf-8").trim();
    res.json({ buildId, serverStartedAt });
  } catch {
    res.json({ buildId: "unknown", serverStartedAt });
  }
});

// --- SSE endpoint ---
app.get("/api/agents", (req, res) => {
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
  });

  const heartbeat = setInterval(() => {
    res.write(":keepalive\n\n");
  }, 15000);

  console.log("[sse] client connected");
  const current = watcher.getAgents();
  res.write(`data: ${JSON.stringify(current)}\n\n`);

  const cleanup = () => {
    console.log("[sse] client disconnected");
    clearInterval(heartbeat);
    watcher.off("agents", onAgents);
  };

  const onAgents = (agents: AgentState[]) => {
    try {
      res.write(`data: ${JSON.stringify(agents)}\n\n`);
    } catch {
      cleanup();
    }
  };

  watcher.on("agents", onAgents);
  req.on("close", cleanup);
});

// --- Agent management ---
app.post("/api/agents/clear", (_req, res) => {
  watcher.clearAll();
  res.json({ ok: true });
});

// Compact — reassign active agents to lowest slots (0,1,2,3)
app.post("/api/agents/compact", (_req, res) => {
  // Clear cc-slot.sh assignment files so next hook call reassigns from slot 0
  for (let s = 0; s < 4; s++) {
    try { fs.unlinkSync(`/tmp/.cc-active-${s}`); } catch {}
  }
  // Clear per-TTY slot files
  try {
    const tmpFiles = fs.readdirSync("/tmp");
    for (const f of tmpFiles) {
      if (f.startsWith(".cc-slot-")) {
        try { fs.unlinkSync(`/tmp/${f}`); } catch {}
      }
    }
  } catch {}
  // Reset tower engine slots + hook slot map
  towerEngine.clearSlots();
  hookSlotMap.clear();
  console.log("[compact] cleared slot assignments — agents will reassign on next hook");
  res.json({ ok: true });
});

// Kill a specific agent — remove from watcher + clear exp
app.post("/api/kill-agent", express.json(), (req, res) => {
  const { agentId } = req.body;
  if (!agentId) return res.status(400).json({ error: "agentId required" });
  watcher.expTracker.clearAgent(agentId);
  watcher.removeAgent(agentId);
  res.json({ ok: true });
});

// Rename an agent's game name
app.post("/api/rename-agent", express.json(), (req, res) => {
  const { agentId, name } = req.body;
  if (!agentId || !name) return res.status(400).json({ error: "agentId and name required" });
  const expId = agentId.includes("/subagents/") ? agentId : path.dirname(agentId);
  const ok = watcher.expTracker.renameAgent(expId, name);
  res.json({ ok });
});

// --- ESP32 combined status endpoint ---
// Single endpoint for ESP32 Buddy — agents, body colors, and state in one call.
// Agents are mapped to slot states (active/waiting/off) to match the 4-slot model.
const MAGE_SPRITE_NAMES = ["mage-blue", "mage-red", "mage-purple", "mage-orange", "mage-gold", "mage-teal"];
let lastBodyColors: string[] = [];
let lastHirstState = "off";

// Tower engine (imported above) replaces the old crude simulation.
// Hook events drive the engine state machine, which produces proper 75-pixel
// hirst animations matching the physical tower 1:1.

// --- Single claw poll loop — refreshes cache once per second ---
// All consumers (endpoints, BLE, body colors) read from clawCache instead.
setInterval(async () => {
  // Local tower engine is always source of truth for body colors + hirst state (all modes)
  if (towerEngine.isActive()) {
    const ep = towerEngine.getPixels();
    lastBodyColors = [...ep.middle, ...ep.bottom];
    lastHirstState = "running";
  } else {
    lastBodyColors = Array(50).fill("#000000");
    lastHirstState = "off";
  }
  clawCache.tower1.lastUpdated = Date.now();

  if (isHome()) {
    // Only poll /status for Yeelight auto-recovery (no pixels/slots — local engine is brain)
    try {
      const statusData = await curlRaw(claw, "/status", 2).catch(() => null) as any;
      if (statusData) {
        clawCache.tower1.status = statusData;
        homePollFailCount = 0;
      } else {
        homePollFailCount++;
      }
      if (homePollFailCount >= HOME_POLL_FAIL_THRESHOLD) {
        switchToFallback();
        homePollFailCount = 0;
      }
    } catch {
      homePollFailCount++;
      if (homePollFailCount >= HOME_POLL_FAIL_THRESHOLD) {
        switchToFallback();
        homePollFailCount = 0;
      }
    }

    // Tower 2: auxiliary display (separate system, keep reading)
    try {
      const tower2Url = `http://${getActiveClawHost()}:9998`;
      const t2data = await curlRaw(tower2Url, "/pixels", 2).catch(() => null) as any;
      clawCache.tower2.data = t2data;
      clawCache.tower2.lastUpdated = Date.now();
    } catch {}
  }

  clawCache.tower2.lastUpdated = Date.now();
}, 1000);

// Push local tower engine slot states to physical tower every 500ms (HOME mode only)
// Same pattern as ESP32 — claw is a dumb display, local engine is the brain.
setInterval(() => {
  if (!isHome()) return;
  const slots = towerEngine.getSlotStates();
  const body = JSON.stringify({ slots });
  execFile("curl", [
    "-s", "-X", "POST",
    "-H", "Content-Type: application/json",
    "-d", body,
    "--connect-timeout", "1",
    "--max-time", "1",
    `${claw}/state`,
  ], { timeout: 2000 }, () => {}); // fire-and-forget is fine — next push self-heals
}, 500);

let espLastPoll = 0;

// Sticky starter assignment for ESP32 — mirrors client-side logic
const ESP_STARTERS = ["charmander", "squirtle", "bulbasaur", "mew"];
const espStickyStarters = new Map<string, string>();
function espAssignStarter(agentId: string, activeIds: Set<string>): string {
  if (espStickyStarters.has(agentId)) return espStickyStarters.get(agentId)!;
  // Clean up departed agents
  for (const id of espStickyStarters.keys()) {
    if (!activeIds.has(id)) espStickyStarters.delete(id);
  }
  const used = new Set(espStickyStarters.values());
  let pick = ESP_STARTERS.find(s => !used.has(s));
  if (!pick) pick = ESP_STARTERS[espStickyStarters.size % ESP_STARTERS.length];
  espStickyStarters.set(agentId, pick);
  return pick;
}

app.get("/api/esp32-status", (_req, res) => {
  espLastPoll = Date.now();
  const allAgents = watcher.getAgents();
  const ccMain = allAgents
    .filter(a => a.source === "cc" && (a.subagentClass === null || a.subagentClass === undefined))
    .slice(0, 4); // max 4 slots

  const activeIds = new Set(ccMain.map(a => a.id));

  const agents = ccMain.map(a => {
    const state = a.state === "thinking" ? "thinking"
      : (a.state === "typing" || a.state === "reading") ? "active"
      : a.state === "idle" || a.state === "lounging" ? "waiting"
      : "off";
    // Extract short project name from id path
    // id is like: /Users/ellis/.claude/projects/-Users-ellis-Code-workspace-myproject/uuid.jsonl
    // We want the directory name, which is the encoded project path
    const dirName = a.id.split("/").find(p => p.startsWith("-")) || "";
    const projectParts = dirName.replace(/^-/, "").split("-");
    const project = projectParts[projectParts.length - 1] || "unknown";

    const entry: Record<string, any> = {
      name: a.gameName || a.name,
      level: a.level ?? 0,
      state,
      sprite: espAssignStarter(a.id, activeIds),
      progress: a.exp ?? 0,
      progressMax: a.expToNext ?? 100,
      tc: a.teamColor ?? 0,
      project,
      slot: ccMain.indexOf(a),
    };
    if (state === "active") {
      entry.activity = a.currentTool || a.state;
    }
    return entry;
  });

  // Find which slot is most recently active
  let activeSlot = 0;
  let latestActivity = 0;
  for (let i = 0; i < ccMain.length; i++) {
    if (ccMain[i].lastActivity > latestActivity) {
      latestActivity = ccMain[i].lastActivity;
      activeSlot = i;
    }
  }

  // Tower-engine slot states are authoritative — driven by hooks with explicit slot numbers.
  // ESP32 should use these directly instead of deriving from agent array index.
  const engineSlots = towerEngine.getSlotStates();

  debugEmitter.emit("event", { source: "esp", text: `poll agents=${agents.length} slots=[${engineSlots.join(",")}] mode=${connectionMode}`, time: Date.now() });

  res.json({
    agents,
    activeSlot,
    bodyColors: lastBodyColors,
    hirstState: lastHirstState,
    mode: connectionMode,
    slotStates: engineSlots,
  });
});

// --- Tower 2 proxy (same host as claw, port 9998) ---
app.get("/api/tower2-status", async (_req, res) => {
  if (isHome()) {
    try {
      const tower2Url = `http://${getActiveClawHost()}:9998`;
      const data = await curlRaw(tower2Url, "/status", 2);
      return res.json(data);
    } catch {}
  }
  res.json({ ok: false, mode: "offline", animating: false, dots: [], pixels: [] });
});

app.get("/api/tower2-pixels", async (_req, res) => {
  if (isHome() && clawCache.tower2.data) {
    return res.json(clawCache.tower2.data);
  }
  res.json({ ok: false, pixels: [], width: 5, height: 10, mode: "offline" });
});

// Client-triggered sparkle — perfectly timed with visual level-up
app.post("/api/sparkle", express.json(), (req, res) => {
  const { slot } = req.body;
  if (slot === undefined || slot < 0 || slot > 3) return res.status(400).json({ error: "slot 0-3 required" });
  triggerLevelUpSparkle(slot);
  res.json({ ok: true });
});

// Light test panel — simulate claw hooks for any slot
// Note: claw hook endpoints are GET, not POST (except sparkle)
app.post("/api/light-test", express.json(), async (req, res) => {
  const { slot, action } = req.body;
  if (slot === undefined || slot < 0 || slot > 3) return res.status(400).json({ error: "slot 0-3 required" });
  try {
    switch (action) {
      case "sparkle":
        await clawPost(claw, "/hook/agent-slots/sparkle", { slot, duration: 2.0 });
        break;
      case "thinking":
        await clawGet(claw, `/hook/thinking-start?slot=${slot}`);
        break;
      case "thinking-stop":
        await clawGet(claw, `/hook/thinking-end?slot=${slot}`);
        break;
      case "active":
        await clawGet(claw, `/hook/prompt-start?slot=${slot}`);
        break;
      case "active-stop":
        await clawGet(claw, `/hook/prompt-end?slot=${slot}`);
        break;
      case "off":
        await clawGet(claw, `/hook/thinking-end?slot=${slot}`);
        await clawGet(claw, `/hook/prompt-end?slot=${slot}`);
        break;
      default:
        return res.status(400).json({ error: "unknown action" });
    }
    res.json({ ok: true, slot, action });
  } catch (err: any) {
    res.json({ ok: false, error: err.message });
  }
});

// --- Hook proxy endpoints ---
// Claude Code hooks fire here. Always updates local tower engine + forwards to claw.
// Hooks carry slot numbers from cc-slot.sh. Tower engine is source of truth for both
// digital tower and ESP32 — no claw dependency in away mode.

// Local slot→session map — built from hook events, used for desk assignment
const hookSlotMap = new Map<number, string>(); // slot → session_id

app.get("/hook/prompt-start", (req, res) => {
  const slot = parseInt(req.query.slot as string, 10) || 0;
  const session_id = req.query.session_id || "";
  const name = req.query.name || "";
  towerEngine.onPromptStart(slot);
  if (session_id && slot >= 0 && slot <= 3) hookSlotMap.set(slot, String(session_id));
  debugEmitter.emit("event", { source: "hooks", text: `prompt-start slot=${slot} sid=${session_id} name=${name}`, time: Date.now() });
  // Fire-and-forget to primary claw only — never failover (that would flip mode to AWAY)
  curlRaw(claw, `/hook/prompt-start?slot=${slot}&session_id=${session_id}&name=${name}`, 2).catch(() => {});
  res.json({ ok: true });
});

app.get("/hook/thinking-start", (req, res) => {
  const slot = parseInt(req.query.slot as string, 10) || 0;
  const session_id = req.query.session_id || "";
  const name = req.query.name || "";
  towerEngine.onThinkingStart(slot);
  if (session_id && slot >= 0 && slot <= 3) hookSlotMap.set(slot, String(session_id));
  debugEmitter.emit("event", { source: "hooks", text: `thinking-start slot=${slot} sid=${session_id} name=${name}`, time: Date.now() });
  curlRaw(claw, `/hook/thinking-start?slot=${slot}&session_id=${session_id}&name=${name}`, 2).catch(() => {});
  res.json({ ok: true });
});

app.get("/hook/thinking-end", (req, res) => {
  const slot = parseInt(req.query.slot as string, 10) || 0;
  const session_id = req.query.session_id || "";
  const name = req.query.name || "";
  towerEngine.onThinkingEnd(slot);
  debugEmitter.emit("event", { source: "hooks", text: `thinking-end slot=${slot} sid=${session_id} name=${name}`, time: Date.now() });
  curlRaw(claw, `/hook/thinking-end?slot=${slot}&session_id=${session_id}&name=${name}`, 2).catch(() => {});
  res.json({ ok: true });
});

app.get("/hook/prompt-end", (req, res) => {
  const slot = parseInt(req.query.slot as string, 10) || 0;
  const session_id = req.query.session_id || "";
  const name = req.query.name || "";
  towerEngine.onPromptEnd(slot);
  // Don't clear hookSlotMap on prompt-end — agent keeps its slot for desk assignment
  // Slot is only freed when cc-slot.sh reassigns it to a different session
  debugEmitter.emit("event", { source: "hooks", text: `prompt-end slot=${slot} sid=${session_id} name=${name}`, time: Date.now() });
  curlRaw(claw, `/hook/prompt-end?slot=${slot}&session_id=${session_id}&name=${name}`, 2).catch(() => {});
  res.json({ ok: true });
});

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

// --- Lucky Pokeball multiplier ---
app.post("/api/lucky-multiplier", express.json(), (req, res) => {
  const { agentId, multiplier, uses } = req.body;
  if (!agentId || !multiplier) return res.status(400).json({ error: "agentId and multiplier required" });
  watcher.expTracker.setLuckyMultiplier(agentId, multiplier, uses ?? 10);
  res.json({ ok: true });
});

// --- Game mode toggle ---
app.get("/api/game-mode", (_req, res) => {
  const tracker = watcher.expTracker;
  const record = 0; // TODO: track from client via POST
  res.json({ enabled: tracker.isEnabled(), record });
});

app.post("/api/game-mode", express.json(), (req, res) => {
  const { enabled } = req.body;
  watcher.expTracker.setEnabled(!!enabled);
  res.json({ ok: true });
});

app.post("/api/game-kill", (_req, res) => {
  watcher.expTracker.clearAll();
  watcher.expTracker.setEnabled(false);
  res.json({ ok: true });
});

// --- Claw connection mode ---
app.get("/api/claw-mode", (_req, res) => {
  res.json({
    mode: connectionMode,
    active: activeClaw,
    primary: claw,
    fallback: clawFallback || null,
    circuitOpen: clawCircuitOpen,
    failCount: clawFailCount,
  });
});

app.post("/api/claw-mode", express.json(), (req, res) => {
  const { mode } = req.body;
  if (mode === "primary") {
    activeClaw = "primary";
    clawCircuitOpen = false;
    clawFailCount = 0;
    if (primaryCheckTimer) { clearInterval(primaryCheckTimer); primaryCheckTimer = null; }
    setMode("home");
  } else if (mode === "fallback" || mode === "tailscale" || mode === "away") {
    if (!clawFallback) return res.status(400).json({ error: "no fallback configured" });
    activeClaw = "fallback";
    clawCircuitOpen = false;
    clawFailCount = 0;
    setMode("away");
  } else if (mode === "auto") {
    // Reset to auto-detect: try primary, fail over naturally
    activeClaw = "primary";
    clawCircuitOpen = false;
    clawFailCount = 0;
    if (primaryCheckTimer) { clearInterval(primaryCheckTimer); primaryCheckTimer = null; }
    setMode("offline"); // will re-detect on next poll
  } else {
    return res.status(400).json({ error: "mode must be primary, tailscale, or auto" });
  }
  res.json({ ok: true, active: activeClaw });
});

// --- Light brightness ---
app.get("/api/brightness", async (_req, res) => {
  try {
    const data = await clawGetSafe("/status") as ClawStatus;
    res.json({ brightness: data.brightness ?? null });
  } catch {
    res.status(502).json({ error: "claw unreachable" });
  }
});

app.get("/api/brightness/:level", async (req, res) => {
  const level = parseInt(req.params.level, 10);
  if (isNaN(level) || level < 0 || level > 100) {
    return res.status(400).json({ error: "brightness must be 0-100" });
  }
  try {
    const data = await clawGetSafe(`/brightness/${level}`);
    res.json(data);
  } catch {
    res.status(502).json({ error: "claw unreachable" });
  }
});

// --- Claw health ---
app.get("/api/claw-health", async (_req, res) => {
  const base = {
    clawMode: activeClaw,
    mode: connectionMode,
    circuitBreakerOpen: clawCircuitOpen,
    bleConnected: isBleConnected(),
    espConnected: (Date.now() - espLastPoll) < 5000,
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

  if (!isHome() || !clawCache.tower1.status) {
    return res.json({
      ...base,
      reachable: !isHome() ? false : clawCache.tower1.lastUpdated > 0,
      yeelightConnected: false,
      slots: [],
      activeSlots: 0,
      matrixMode: null,
    });
  }

  const statusData = clawCache.tower1.status;
  const pixelsData = clawCache.tower1.pixels;
  const slotsData = clawCache.tower1.slots;

  const quadrantIndices = [[15,16,20,21],[18,19,23,24],[0,1,5,6],[3,4,8,9]];
  let slots = statusData.agent_slots?.slots || ["off","off","off","off"];
  if (pixelsData?.panels) {
    const top = (pixelsData.panels as any).top || [];
    slots = quadrantIndices.map((indices: number[]) =>
      indices.some((i: number) => top[i] && top[i] !== "#000000") ? "active" : "off"
    );
  }
  res.json({
    ...base,
    reachable: true,
    yeelightConnected: statusData.connected === true,
    slots,
    activeSlots: slots.filter((s: string) => s !== "off").length,
    matrixMode: statusData.claw_activity || null,
    brightness: statusData.brightness ?? null,
    animationRunning: statusData.animation_running ?? false,
    slotsDetail: slotsData?.slots_detail ?? undefined,
    waitingCount: (slotsData as any)?.waiting_count ?? 0,
    transitionInProgress: (slotsData as any)?.transition_in_progress ?? false,
    zones: (statusData as any).zones ? {
      thinking: (statusData as any).zones.thinking,
      display: (statusData as any).zones.display,
      context: (statusData as any).zones.context,
    } : undefined,
  });
});

// --- Relay ---
app.get("/api/relay", async (_req, res) => {
  try {
    const [outData, inData] = await Promise.all([
      clawGetSafe("/relay").catch(() => ({ messages: [] })) as Promise<ClawRelay>,
      clawGetSafe("/relay/reply").catch(() => ({ replies: [] })) as Promise<ClawReplyRelay>,
    ]);
    // Normalize into unified format
    const messages: RelayMessage[] = [
      ...(outData.messages || []).filter((m) => m.msg).map((m) => ({ from: m.from || "agent-office", msg: m.msg, time: m.time })),
      ...(inData.replies || []).map((m) => ({ from: "claw" as const, msg: m.msg, time: m.time })),
    ].sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime());
    res.json({ messages, count: messages.length });
  } catch (e) {
    console.error("[proxy] /api/relay error:", e);
    res.status(502).json({ error: "claw unreachable" });
  }
});

// --- Tower reset ---
app.post("/api/tower-reset", (_req, res) => {
  execFile("ssh", ["-T", "-o", "ConnectTimeout=5", "-o", "StrictHostKeyChecking=accept-new", `ellis@${getActiveClawHost()}`, "~/clawd/scripts/tower-reset"], { timeout: 15000 }, (err, stdout, stderr) => {
    if (err) {
      console.error("[tower-reset] error:", err.message, stderr);
      return res.status(500).json({ ok: false, error: err.message });
    }
    console.log("[tower-reset] done:", stdout);
    res.json({ ok: true, output: stdout.trim() });
  });
});

// --- Claw proxy endpoints ---
app.get("/api/pixels", async (_req, res) => {
  // Local tower engine is always source of truth (all modes)
  const enginePixels = towerEngine.getPixels();
  const slotStates = towerEngine.getSlotStates();
  // Build slotsDetail from local hook data (cc-slot.sh → hooks → hookSlotMap)
  const slotsDetail = [];
  for (let s = 0; s < 4; s++) {
    slotsDetail.push({ session_id: hookSlotMap.get(s) || "", state: slotStates[s] });
  }
  res.json({
    panels: enginePixels,
    slotsDetail,
    simulated: !isHome(),
  });
});

app.get("/api/uptime-kuma", async (_req, res) => {
  try {
    const data = await clawGetSafe("/hook/uptime-kuma");
    res.json(data);
  } catch {
    res.status(502).json({ error: "claw unreachable" });
  }
});

// --- AI pixel-art clean endpoint ---
app.post("/api/ai/pixel-clean", express.json({ limit: "10mb" }), async (req, res) => {
  const { imageBase64, currentPixels, palette, width, height, apiKey } = req.body;
  if (!apiKey || !imageBase64 || !currentPixels || !palette || !width || !height) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  // Determine media type from base64 header or default to png
  let mediaType = "image/png";
  let rawBase64 = imageBase64;
  if (imageBase64.startsWith("data:")) {
    const match = imageBase64.match(/^data:(image\/[^;]+);base64,(.*)$/);
    if (match) {
      mediaType = match[1];
      rawBase64 = match[2];
    }
  }

  // Build the rasterized grid description
  const gridDesc = currentPixels.map((p: [number, number, string]) => `[${p[0]},${p[1]},"${p[2]}"]`).join(",");

  const systemPrompt = `You are a pixel art cleanup assistant. You receive a rasterized pixel grid and the original reference image. Your job is to clean up the rasterized result:
- Fix broken outlines (1px thick, connected)
- Remove anti-aliasing artifacts (stray semi-transparent or off-palette pixels)
- Snap every pixel color to the nearest color in the provided palette, or make it transparent (omit it)
- Preserve the overall shape and recognizable features from the reference image
- Keep the result within the ${width}x${height} grid

Respond with ONLY a JSON array of [x, y, "#hexcolor"] tuples for non-transparent pixels. No markdown, no explanation, just the JSON array.`;

  const userContent = [
    {
      type: "image",
      source: {
        type: "base64",
        media_type: mediaType,
        data: rawBase64,
      },
    },
    {
      type: "text",
      text: `Reference image above. Grid size: ${width}x${height}. Palette: ${JSON.stringify(palette)}.

Current rasterized pixels (may have artifacts):
[${gridDesc}]

Clean up this pixel art. Return ONLY a JSON array of [x,y,"#hexcolor"] tuples.`,
    },
  ];

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 4096,
        messages: [{ role: "user", content: userContent }],
        system: systemPrompt,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("[ai/pixel-clean] API error:", response.status, errText);
      return res.status(response.status).json({ error: `Claude API error: ${response.status}` });
    }

    const data = await response.json() as { content: Array<{ type: string; text?: string }> };
    const textBlock = data.content?.find((b: { type: string }) => b.type === "text");
    if (!textBlock?.text) {
      return res.status(500).json({ error: "No text response from Claude" });
    }

    // Parse the JSON array from the response (strip any markdown fences)
    let cleaned = textBlock.text.trim();
    if (cleaned.startsWith("```")) {
      cleaned = cleaned.replace(/^```[^\n]*\n?/, "").replace(/\n?```$/, "").trim();
    }

    const pixels = JSON.parse(cleaned);
    res.json({ pixels });
  } catch (err: any) {
    console.error("[ai/pixel-clean] Error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// --- Save sprite patches to staging file ---
app.post("/api/save-sprite", express.json({ limit: "10mb" }), (req, res) => {
  const { patches } = req.body;
  if (!Array.isArray(patches)) return res.status(400).json({ error: "patches array required" });

  // Save to a staging file that Claude can pick up
  const stagingFile = "/tmp/agent-office-sprite-patches.json";
  try {
    fs.writeFileSync(stagingFile, JSON.stringify(patches, null, 2));
    res.json({ ok: true, file: stagingFile, count: patches.length });
  } catch (err: any) {
    res.json({ ok: false, error: err.message });
  }
});

// --- Sprite data endpoint for ESP32 ---
// Serves PixelRect[] sprite data for all character types.
type SpriteEntry = { width: number; height: number; frames: { name: string; pixels: PixelRect[] }[] };

const AGENT_STATES = ["idle", "typing", "reading", "thinking", "waiting"] as const;
function agentFrames(sprites: Record<string, PixelRect[]>): { name: string; pixels: PixelRect[] }[] {
  return AGENT_STATES.map(s => ({ name: s, pixels: sprites[s] }));
}

const spriteRegistry: Record<string, SpriteEntry> = {};

// CC main agents (starter pokemon + mew)
spriteRegistry["charmander"] = { width: CHARMANDER_WIDTH, height: CHARMANDER_HEIGHT, frames: agentFrames(CHARMANDER_SPRITES) };
spriteRegistry["squirtle"] = { width: SQUIRTLE_WIDTH, height: SQUIRTLE_HEIGHT, frames: agentFrames(SQUIRTLE_SPRITES) };
spriteRegistry["bulbasaur"] = { width: BULBASAUR_WIDTH, height: BULBASAUR_HEIGHT, frames: agentFrames(BULBASAUR_SPRITES) };
spriteRegistry["mew"] = {
  width: MEW_WIDTH, height: MEW_HEIGHT,
  frames: [...agentFrames(MEW_SPRITES), { name: "walk1", pixels: MEW_WALK1 }, { name: "walk2", pixels: MEW_WALK2 }, { name: "sleep", pixels: MEW_SLEEP }],
};
spriteRegistry["clawd"] = { width: CLAWD_WIDTH, height: CLAWD_HEIGHT, frames: agentFrames(CLAWD_SPRITES) };

// Manager
spriteRegistry["trainer"] = {
  width: TRAINER_WIDTH, height: TRAINER_HEIGHT,
  frames: [...agentFrames(TRAINER_SPRITES), { name: "blink", pixels: TRAINER_BLINK }],
};

// Subagents
spriteRegistry["claw"] = { width: CLAW_WIDTH, height: CLAW_HEIGHT, frames: agentFrames(CLAW_SPRITES) };
spriteRegistry["pikachu"] = {
  width: PIKACHU_WIDTH, height: PIKACHU_HEIGHT,
  frames: [...agentFrames(PIKACHU_SPRITES), { name: "walk1", pixels: PIKACHU_WALK1 }, { name: "walk2", pixels: PIKACHU_WALK2 }],
};

// Mages
const MAGE_NAME_MAP: Record<string, number> = {
  "mage-blue": 0, "mage-red": 1, "mage-purple": 2,
  "mage-orange": 3, "mage-gold": 4, "mage-teal": 5,
};
for (const [name, idx] of Object.entries(MAGE_NAME_MAP)) {
  const color = MAGE_COLORS[idx];
  spriteRegistry[name] = {
    width: MAGE_WIDTH, height: MAGE_HEIGHT,
    frames: [
      { name: "idle", pixels: makeMageSprite(color) },
      { name: "walk1", pixels: makeMageWalk1(color) },
      { name: "walk2", pixels: makeMageWalk2(color) },
    ],
  };
}

app.get("/api/sprites/:name", (req, res) => {
  const { name } = req.params;
  const sprite = spriteRegistry[name];
  if (!sprite) {
    return res.status(404).json({ error: `Unknown sprite: ${name}`, available: Object.keys(spriteRegistry) });
  }

  // Optional: ?frame=idle to get just one frame
  const frameName = req.query.frame as string | undefined;
  if (frameName) {
    const frame = sprite.frames.find(f => f.name === frameName);
    if (!frame) {
      return res.status(404).json({ error: `Unknown frame: ${frameName}`, available: sprite.frames.map(f => f.name) });
    }
    return res.json({ name, width: sprite.width, height: sprite.height, frame: frame.name, pixels: frame.pixels });
  }

  res.json({ name, ...sprite });
});

// List all available sprites
app.get("/api/sprites", (_req, res) => {
  const list = Object.entries(spriteRegistry).map(([name, s]) => ({
    name, width: s.width, height: s.height, frames: s.frames.map(f => f.name),
  }));
  res.json(list);
});

// --- Static files (production) ---
const clientDir = path.join(__dirname, "client");
if (fs.existsSync(clientDir)) {
  app.use(express.static(clientDir, {
    etag: false,
    maxAge: 0,
    setHeaders: (res, filePath) => {
      if (filePath.endsWith(".html")) {
        res.setHeader("Cache-Control", "no-store");
      }
    },
  }));
  app.get("*", (_req, res) => {
    res.setHeader("Cache-Control", "no-store");
    res.sendFile(path.join(clientDir, "index.html"));
  });
}

// --- Start ---
watcher.start();

// Tower engine — 30fps animation, driven by CC hooks via /hook/* endpoints above
const towerEngine = new TowerEngine();
towerEngine.start();

towerEngine.on("debug", (evt: { source: string; text: string; time: number }) => {
  debugEmitter.emit("event", evt);
});

// Level-up sparkle is now client-driven via POST /api/sparkle
// (client triggers at the exact visual moment, not on a server poll)

checkAndAutoRecover(claw);

startBleBridge();

// Push data to BLE subscribers at ~4Hz (matches ESP32 poll rate)
setInterval(async () => {
  if (!isBleConnected()) return;

  // Read from cache — no claw requests
  const pixelsData = isHome() ? clawCache.tower1.pixels : null;
  const statusData = isHome() ? clawCache.tower1.status : null;

  let bodyColors: number[];
  let slotStates = [0, 0, 0, 0];
  let hirstState = 0;

  if (pixelsData?.panels) {
    const middle = (pixelsData.panels as any).middle || [];
    const bottom = (pixelsData.panels as any).bottom || [];
    bodyColors = [];
    for (let i = 0; i < 25; i++) {
      bodyColors.push(parseInt((middle[i] || "#000000").slice(1), 16));
    }
    for (let i = 0; i < 25; i++) {
      bodyColors.push(parseInt((bottom[i] || "#000000").slice(1), 16));
    }
  } else {
    // AWAY/OFFLINE — use tower engine colors
    bodyColors = lastBodyColors.map(c => parseInt(c.slice(1), 16));
  }

  if (statusData?.agent_slots?.slots) {
    const agentSlots = statusData.agent_slots.slots;
    for (let i = 0; i < 4 && i < agentSlots.length; i++) {
      if (agentSlots[i] === "active") slotStates[i] = 2;
      else if (agentSlots[i] === "waiting") slotStates[i] = 1;
      else slotStates[i] = 0;
    }
  }

  const activity = statusData?.claw_activity || "idle";
  hirstState = activity === "typing" ? 2 : activity === "thinking" ? 1 : 0;

  updateBleState({ bodyColors, slotStates, hirstState });
}, 250);

// Determine initial mode on startup (retry — claw can be slow to respond)
(async () => {
  let found = false;
  for (let attempt = 0; attempt < 3 && !found; attempt++) {
    try {
      await curlRaw(claw, "/status", 3);
      setMode("home");
      found = true;
    } catch {
      if (attempt < 2) await new Promise(r => setTimeout(r, 2000));
    }
  }
  if (!found) {
    if (clawFallback) {
      try {
        await curlRaw(clawFallback, "/status", 3);
        activeClaw = "fallback";
        setMode("away");
      } catch {
        setMode("offline");
      }
    } else {
      setMode("offline");
    }
  }
})();

const server = app.listen(config.port, () => {
  console.log(`Agent Office running at http://localhost:${config.port}  claw=${claw}  fallback=${clawFallback || "none"} mode=${connectionMode}`);
});
server.on("error", (err: NodeJS.ErrnoException) => {
  if (err.code === "EADDRINUSE") {
    console.error(`Port ${config.port} already in use. Kill the other process and retry.`);
  } else {
    console.error("Server error:", err.message);
  }
  process.exit(1);
});
