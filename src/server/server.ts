import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import { execFile } from "child_process";
import { loadConfig, clawBaseUrl } from "./config";
import { createWatcher } from "./agents/watcher-singleton";
import type { AgentState } from "../shared/types";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const config = loadConfig();
const claw = clawBaseUrl(config);
const watcher = createWatcher(claw);

const app = express();

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
    const r = await fetch(`${claw}/status`, { signal: AbortSignal.timeout(2000) });
    if (!r.ok) return res.json({ reachable: false, yeelightConnected: false });
    const data = await r.json();
    res.json({
      reachable: true,
      yeelightConnected: data.connected === true,
    });
  } catch {
    res.json({ reachable: false, yeelightConnected: false });
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
    const r = await fetch(`${claw}/pixels`, { signal: AbortSignal.timeout(2000) });
    if (!r.ok) return res.status(r.status).json({ error: "claw unreachable" });
    res.json(await r.json());
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
app.use(express.static(clientDir));
app.get("*", (_req, res) => {
  res.sendFile(path.join(clientDir, "index.html"));
});

// --- Start ---
watcher.start();
app.listen(config.port, () => {
  console.log(`Agent Office running at http://localhost:${config.port}`);
});
