import express from "express";
import path from "path";
import { fileURLToPath } from "url";
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
