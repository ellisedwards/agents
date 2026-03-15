import express from "express";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import { execFile } from "child_process";
import { loadConfig, clawBaseUrl } from "./config";
import { createWatcher } from "./agents/watcher-singleton";
import type { AgentState } from "../shared/types";

// --- Auto-recovery: reconnect matrix if socket dies ---
let lastMatrixConnected = true;
let autoRecoveryInProgress = false;

function checkAndAutoRecover(claw: string) {
  setInterval(async () => {
    if (autoRecoveryInProgress) return;
    try {
      const r = await fetch(`${claw}/status`, { signal: AbortSignal.timeout(2000) });
      if (!r.ok) return;
      const data = await r.json();
      const connected = data.connected === true;
      if (!connected && lastMatrixConnected) {
        console.log("[auto-recovery] Matrix socket died, attempting reconnect...");
        autoRecoveryInProgress = true;
        execFile("ssh", ["-T", "-o", "ConnectTimeout=5", "ellis@192.168.50.40",
          "curl -s -X POST http://localhost:9999/matrix/reconnect"], { timeout: 10000 },
          (err, stdout) => {
            autoRecoveryInProgress = false;
            if (err) console.error("[auto-recovery] Failed:", err.message);
            else console.log("[auto-recovery] Reconnect result:", stdout.trim());
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
app.get("/api/build-id", (_req, res) => {
  try {
    const buildId = fs.readFileSync(buildIdFile, "utf-8").trim();
    res.json({ buildId });
  } catch {
    res.json({ buildId: "unknown" });
  }
});

// --- SSE endpoint ---
app.get("/api/agents", (req, res) => {
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
  });

  const current = watcher.getAgents();
  res.write(`data: ${JSON.stringify(current)}\n\n`);

  const onAgents = (agents: AgentState[]) => {
    try {
      res.write(`data: ${JSON.stringify(agents)}\n\n`);
    } catch {}
  };

  watcher.on("agents", onAgents);
  req.on("close", () => watcher.off("agents", onAgents));
});

// --- Agent management ---
app.post("/api/agents/clear", (_req, res) => {
  watcher.clearAll();
  res.json({ ok: true });
});

// --- Light brightness ---
app.get("/api/brightness", async (_req, res) => {
  try {
    const r = await fetch(`${claw}/status`, { signal: AbortSignal.timeout(2000) });
    if (!r.ok) return res.status(r.status).json({ error: "claw unreachable" });
    const data = await r.json();
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
    const r = await fetch(`${claw}/brightness/${level}`, { signal: AbortSignal.timeout(2000) });
    if (!r.ok) return res.status(r.status).json({ error: "claw unreachable" });
    res.json(await r.json());
  } catch {
    res.status(502).json({ error: "claw unreachable" });
  }
});

// --- Claw health ---
app.get("/api/claw-health", async (_req, res) => {
  try {
    const [statusRes, pixelsRes] = await Promise.all([
      fetch(`${claw}/status`, { signal: AbortSignal.timeout(2000) }),
      fetch(`${claw}/pixels`, { signal: AbortSignal.timeout(2000) }).catch(() => null),
    ]);
    if (!statusRes.ok) return res.json({ reachable: false, yeelightConnected: false, slots: [], activeSlots: 0, matrixMode: null });
    const data = await statusRes.json();
    // Derive slot status from actual pixel data (source of truth)
    const quadrantIndices = [[15,16,20,21],[18,19,23,24],[0,1,5,6],[3,4,8,9]];
    let slots = data.agent_slots?.slots || ["off","off","off","off"];
    if (pixelsRes?.ok) {
      const px = await pixelsRes.json();
      const top = px.panels?.top || [];
      slots = quadrantIndices.map((indices: number[]) =>
        indices.some((i: number) => top[i] && top[i] !== "#000000") ? "active" : "off"
      );
    }
    res.json({
      reachable: true,
      yeelightConnected: data.connected === true,
      slots,
      activeSlots: slots.filter((s: string) => s !== "off").length,
      matrixMode: data.claw_activity || null,
      brightness: data.brightness ?? null,
      animationRunning: data.animation_running ?? false,
    });
  } catch {
    res.json({ reachable: false, yeelightConnected: false, slots: [], activeSlots: 0, matrixMode: null });
  }
});

// --- Relay ---
app.get("/api/relay", async (_req, res) => {
  try {
    const [outRes, inRes] = await Promise.all([
      fetch(`${claw}/relay`, { signal: AbortSignal.timeout(2000) }).catch(() => null),
      fetch(`${claw}/relay/reply`, { signal: AbortSignal.timeout(2000) }).catch(() => null),
    ]);
    const outData = outRes?.ok ? await outRes.json() : { messages: [] };
    const inData = inRes?.ok ? await inRes.json() : { replies: [] };
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
    const [pixelsRes, statusRes] = await Promise.all([
      fetch(`${claw}/pixels`, { signal: AbortSignal.timeout(2000) }),
      fetch(`${claw}/status`, { signal: AbortSignal.timeout(2000) }).catch(() => null),
    ]);
    if (!pixelsRes.ok) return res.status(pixelsRes.status).json({ error: "claw unreachable" });
    const data = await pixelsRes.json();
    if (statusRes?.ok) {
      const status = await statusRes.json();
      data.clawActivity = status.claw_activity || "idle";
    }
    res.json(data);
  } catch (e) {
    console.error("[proxy] /api/pixels error:", e);
    res.status(502).json({ error: "claw unreachable" });
  }
});

app.get("/api/uptime-kuma", async (_req, res) => {
  try {
    const r = await fetch(`${claw}/hook/uptime-kuma`, { signal: AbortSignal.timeout(2000) });
    if (!r.ok) return res.status(r.status).json({ error: "claw unreachable" });
    res.json(await r.json());
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
