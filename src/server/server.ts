import express from "express";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import { execFile } from "child_process";
import { loadConfig, clawBaseUrl } from "./config";
import { createWatcher } from "./agents/watcher-singleton";
import type { AgentState } from "../shared/types";

// --- Claw communication via curl ---
// Node's networking gets permanently poisoned when a destination becomes
// temporarily unreachable (macOS per-process routing cache). Both fetch()
// and http.get fail with EHOSTUNREACH even after the host comes back.
// curl is immune because each invocation is a fresh process.
function clawGet(claw: string, urlPath: string, timeoutSec = 2): Promise<any> {
  const url = `${claw}${urlPath}`;
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

// POST to claw via curl (for sparkle endpoint etc.)
function clawPost(claw: string, urlPath: string, body: object, timeoutSec = 3): Promise<any> {
  const url = `${claw}${urlPath}`;
  return new Promise((resolve, reject) => {
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

// --- Auto-recovery: reconnect matrix if socket dies ---
let lastMatrixConnected = true;
let autoRecoveryInProgress = false;

function checkAndAutoRecover(claw: string) {
  setInterval(async () => {
    if (autoRecoveryInProgress) return;
    try {
      const data = await clawGet(claw, "/status");
      const connected = data.connected === true;
      if (!connected && lastMatrixConnected) {
        console.log("[auto-recovery] Yeelight disconnected, running tower-reset...");
        autoRecoveryInProgress = true;
        execFile("ssh", ["-T", "-o", "ConnectTimeout=5", "ellis@192.168.50.40",
          "~/clawd/scripts/tower-reset"], { timeout: 15000 },
          (err, stdout) => {
            autoRecoveryInProgress = false;
            if (err) console.error("[auto-recovery] Failed:", err.message);
            else console.log("[auto-recovery] Reset result:", stdout.trim());
          });
      }
      lastMatrixConnected = connected;
    } catch {
      // claw unreachable — nothing to recover
    }
  }, 10000); // check every 10s
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const config = loadConfig();
const claw = clawBaseUrl(config);
const watcher = createWatcher(claw);

const app = express();

// --- Build ID (for stale-build detection) ---
// Read from disk so rebuilds are detected without restarting the server
const buildIdFile = path.join(__dirname, ".build-id");
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

  const current = watcher.getAgents();
  res.write(`data: ${JSON.stringify(current)}\n\n`);

  const onAgents = (agents: AgentState[]) => {
    try {
      res.write(`data: ${JSON.stringify(agents)}\n\n`);
    } catch {}
  };

  watcher.on("agents", onAgents);
  req.on("close", () => {
    clearInterval(heartbeat);
    watcher.off("agents", onAgents);
  });
});

// --- Agent management ---
app.post("/api/agents/clear", (_req, res) => {
  watcher.clearAll();
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

// --- Light brightness ---
app.get("/api/brightness", async (_req, res) => {
  try {
    const data = await clawGet(claw, "/status");
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
    const data = await clawGet(claw, `/brightness/${level}`);
    res.json(data);
  } catch {
    res.status(502).json({ error: "claw unreachable" });
  }
});

// --- Claw health ---
app.get("/api/claw-health", async (_req, res) => {
  try {
    const [statusData, pixelsData] = await Promise.all([
      clawGet(claw, "/status"),
      clawGet(claw, "/pixels").catch(() => null),
    ]);
    // Derive slot status from actual pixel data (source of truth)
    const quadrantIndices = [[15,16,20,21],[18,19,23,24],[0,1,5,6],[3,4,8,9]];
    let slots = statusData.agent_slots?.slots || ["off","off","off","off"];
    if (pixelsData?.panels) {
      const top = pixelsData.panels.top || [];
      slots = quadrantIndices.map((indices: number[]) =>
        indices.some((i: number) => top[i] && top[i] !== "#000000") ? "active" : "off"
      );
    }
    res.json({
      reachable: true,
      yeelightConnected: statusData.connected === true,
      slots,
      activeSlots: slots.filter((s: string) => s !== "off").length,
      matrixMode: statusData.claw_activity || null,
      brightness: statusData.brightness ?? null,
      animationRunning: statusData.animation_running ?? false,
    });
  } catch {
    res.json({ reachable: false, yeelightConnected: false, slots: [], activeSlots: 0, matrixMode: null });
  }
});

// --- Relay ---
app.get("/api/relay", async (_req, res) => {
  try {
    const [outData, inData] = await Promise.all([
      clawGet(claw, "/relay").catch(() => ({ messages: [] })),
      clawGet(claw, "/relay/reply").catch(() => ({ replies: [] })),
    ]);
    // Normalize into unified format
    const messages = [
      ...(outData.messages || []).filter((m: any) => m.msg).map((m: any) => ({ from: m.from || "agent-office", msg: m.msg, time: m.time })),
      ...(inData.replies || []).map((m: any) => ({ from: "claw", msg: m.msg, time: m.time })),
    ].sort((a: any, b: any) => new Date(a.time).getTime() - new Date(b.time).getTime());
    res.json({ messages, count: messages.length });
  } catch (e) {
    console.error("[proxy] /api/relay error:", e);
    res.status(502).json({ error: "claw unreachable" });
  }
});

// --- Tower reset ---
app.post("/api/tower-reset", (_req, res) => {
  execFile("ssh", ["-T", "-o", "ConnectTimeout=5", "ellis@192.168.50.40", "~/clawd/scripts/tower-reset"], { timeout: 15000 }, (err, stdout, stderr) => {
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
  try {
    const [pixelsData, statusData, slotsData] = await Promise.all([
      clawGet(claw, "/pixels"),
      clawGet(claw, "/status").catch(() => null),
      clawGet(claw, "/hook/agent-slots").catch(() => null),
    ]);
    if (!pixelsData?.panels) return res.status(502).json({ error: "claw unreachable" });
    const data = pixelsData;
    if (statusData) {
      data.clawActivity = statusData.claw_activity || "idle";
    }
    if (slotsData?.slots_detail) {
      data.slotsDetail = slotsData.slots_detail;
    }
    res.json(data);
  } catch (e) {
    console.error("[proxy] /api/pixels error:", e);
    res.status(502).json({ error: "claw unreachable" });
  }
});

app.get("/api/uptime-kuma", async (_req, res) => {
  try {
    const data = await clawGet(claw, "/hook/uptime-kuma");
    res.json(data);
  } catch (e) {
    console.error("[proxy] /api/uptime-kuma error:", e);
    res.status(502).json({ error: "claw unreachable" });
  }
});

// --- Static files (production) ---
const clientDir = path.join(__dirname, "client");
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

// --- Start ---
watcher.start();

// Level-up sparkle: check for level-ups on each agent emission
watcher.on("agents", (agents: AgentState[]) => {
  if (!watcher.expTracker.isEnabled()) return;
  for (const agent of agents) {
    if (agent.source !== "cc") continue;
    if (watcher.expTracker.consumeLevelUp(agent.id)) {
      // Find this agent's claw slot by querying slot detail
      // Use cached slot data from the last /api/pixels fetch if available
      // Simple approach: query claw for slot info, match by project dir name
      const projectsIdx = agent.id.indexOf("/.claude/projects/");
      if (projectsIdx < 0) continue;
      const projectDir = agent.id.slice(projectsIdx + 18).split("/")[0];
      clawGet(claw, "/hook/agent-slots").then((data) => {
        if (!data?.slots_detail) return;
        for (let s = 0; s < data.slots_detail.length; s++) {
          const detail = data.slots_detail[s];
          if (detail.name && projectDir.includes(detail.name)) {
            triggerLevelUpSparkle(s);
            return;
          }
          if (detail.session_id && agent.id.includes(detail.session_id)) {
            triggerLevelUpSparkle(s);
            return;
          }
        }
      }).catch(() => {});
    }
  }
});

checkAndAutoRecover(claw);
const server = app.listen(config.port, () => {
  console.log(`Agent Office running at http://localhost:${config.port}`);
});
server.on("error", (err: NodeJS.ErrnoException) => {
  if (err.code === "EADDRINUSE") {
    console.error(`Port ${config.port} already in use. Kill the other process and retry.`);
  } else {
    console.error("Server error:", err.message);
  }
  process.exit(1);
});
