import express from "express";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import { execFile } from "child_process";
import { loadConfig, clawBaseUrl } from "./config";
import { createWatcher } from "./agents/watcher-singleton";
import type { AgentState } from "../shared/types";

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

// --- Claw communication via curl ---
// Node's networking gets permanently poisoned when a destination becomes
// temporarily unreachable (macOS per-process routing cache). Both fetch()
// and http.get fail with EHOSTUNREACH even after the host comes back.
// curl is immune because each invocation is a fresh process.
function clawGet(claw: string, urlPath: string, timeoutSec = 2): Promise<unknown> {
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
function clawPost(claw: string, urlPath: string, body: object, timeoutSec = 3): Promise<unknown> {
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
      const data = await clawGet(claw, "/status") as ClawStatus;
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

// Client-triggered sparkle — perfectly timed with visual level-up
app.post("/api/sparkle", express.json(), (req, res) => {
  const { slot } = req.body;
  if (slot === undefined || slot < 0 || slot > 3) return res.status(400).json({ error: "slot 0-3 required" });
  triggerLevelUpSparkle(slot);
  res.json({ ok: true });
});

// Light test panel — simulate claw hooks for any slot
app.post("/api/light-test", express.json(), async (req, res) => {
  const { slot, action } = req.body;
  if (slot === undefined || slot < 0 || slot > 3) return res.status(400).json({ error: "slot 0-3 required" });
  try {
    switch (action) {
      case "sparkle":
        await clawPost(claw, "/hook/agent-slots/sparkle", { slot, duration: 2.0 });
        break;
      case "thinking":
        await clawPost(claw, `/hook/thinking-start?slot=${slot}`, {});
        break;
      case "thinking-stop":
        await clawPost(claw, `/hook/thinking-end?slot=${slot}`, {});
        break;
      case "active":
        await clawPost(claw, `/hook/prompt-start?slot=${slot}`, {});
        break;
      case "active-stop":
        await clawPost(claw, `/hook/prompt-end?slot=${slot}`, {});
        break;
      case "off":
        await clawPost(claw, `/hook/thinking-end?slot=${slot}`, {});
        await clawPost(claw, `/hook/prompt-end?slot=${slot}`, {});
        break;
      default:
        return res.status(400).json({ error: "unknown action" });
    }
    res.json({ ok: true, slot, action });
  } catch (err: any) {
    res.json({ ok: false, error: err.message });
  }
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
  try {
    const [statusData, pixelsData] = await Promise.all([
      clawGetSafe("/status") as Promise<ClawStatus>,
      clawGetSafe("/pixels").catch(() => null) as Promise<ClawPixels | null>,
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
      clawGetSafe("/pixels") as Promise<ClawPixels>,
      clawGetSafe("/status").catch(() => null) as Promise<ClawStatus | null>,
      clawGetSafe("/hook/agent-slots").catch(() => null) as Promise<ClawSlots | null>,
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
    const data = await clawGetSafe("/hook/uptime-kuma");
    res.json(data);
  } catch (e) {
    console.error("[proxy] /api/uptime-kuma error:", e);
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

// Level-up sparkle is now client-driven via POST /api/sparkle
// (client triggers at the exact visual moment, not on a server poll)

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
