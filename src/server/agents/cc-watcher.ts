import { EventEmitter } from "events";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { parseTranscriptLine } from "./transcript-parser";
import type { ExpTracker } from "./exp-tracker";
import type { AgentState, AgentActivityState, MageColorIndex } from "../../shared/types";

const CLAUDE_DIR = path.join(os.homedir(), ".claude", "projects");
const STALE_MS = 30 * 60 * 1000; // 30 minutes
const SUBAGENT_STALE_MS = 5 * 60 * 1000; // 5 min — subagents are short-lived
const LOUNGE_MS = 5 * 60 * 1000; // 5 minutes idle → lounging
const SCAN_INTERVAL_MS = 3_000;
const WATCH_INTERVAL_MS = 500;
const MAX_WATCHED = 20;
let nextMageColor = 0;

interface SessionInfo {
  filePath: string;
  byteOffset: number;
  state: AgentActivityState;
  currentTool: string | null;
  name: string;
  parentId: string | null;
  subagentClass: MageColorIndex | null;
  teamColor: MageColorIndex;
  lastActivity: number;
  pendingSubAgents: number;
  expectingSubAgentSince: number;
  idleSinceCheck: ReturnType<typeof setTimeout> | null;
  hasBeenActive: boolean;
}

export class ClaudeCodeWatcher extends EventEmitter {
  private sessions = new Map<string, SessionInfo>();
  private departedPaths = new Map<string, number>(); // path → departure timestamp
  private scanInterval: ReturnType<typeof setInterval> | null = null;
  private ccCounter = 0;
  private emitVersion = 0;
  private expTracker: ExpTracker;
  private rescanPending = false;

  constructor(expTracker: ExpTracker) {
    super();
    this.expTracker = expTracker;
  }

  start() {
    this.scan();
    // Mark exp tracker warm after initial log replay — only new events earn exp
    this.expTracker.markWarm();
    this.scanInterval = setInterval(() => this.scan(), SCAN_INTERVAL_MS);
  }

  stop() {
    if (this.scanInterval) clearInterval(this.scanInterval);
    for (const [filePath] of this.sessions) {
      fs.unwatchFile(filePath);
    }
    this.sessions.clear();
  }

  private scan() {
    const now = Date.now();

    // Clean up stale sessions and departed paths
    for (const [filePath, session] of this.sessions) {
      if (session.subagentClass !== null) {
        // Subagents: only remove if parent session is gone (they end via turn_end)
        if (session.parentId && !this.sessions.has(session.parentId)) {
          fs.unwatchFile(filePath);
          this.sessions.delete(filePath);
        }
      } else if (now - session.lastActivity > STALE_MS) {
        // Don't drop main agent if it has active subagents
        const hasSubagents = [...this.sessions.values()].some(
          (s) => s.parentId === filePath
        );
        if (!hasSubagents) {
          fs.unwatchFile(filePath);
          this.sessions.delete(filePath);
        }
      }
    }
    // Allow departed paths to be re-discovered after staleness window
    // Use the appropriate staleness limit so completed files don't get re-discovered
    for (const [dp, departedAt] of this.departedPaths) {
      const limit = dp.includes("/subagents/") ? SUBAGENT_STALE_MS : STALE_MS;
      if (now - departedAt > limit) {
        this.departedPaths.delete(dp);
      }
    }

    // Find active JSONL files
    if (!fs.existsSync(CLAUDE_DIR)) return;

    const projectDirs = this.getProjectDirs();
    let totalFound = 0;
    for (const dir of projectDirs) {
      const jsonlFiles = this.findJsonlFiles(dir, now);
      totalFound += jsonlFiles.length;
      for (const filePath of jsonlFiles) {
        if (this.sessions.has(filePath)) continue;
        if (this.departedPaths.has(filePath)) continue;
        if (this.sessions.size >= MAX_WATCHED) break;
        console.log(`[cc-watcher] new session: ${path.basename(filePath)} (from ${path.basename(dir)})`);
        this.startWatching(filePath, now);
      }
    }

    this.emitUpdate();
  }

  private getProjectDirs(): string[] {
    try {
      return fs
        .readdirSync(CLAUDE_DIR, { withFileTypes: true })
        .filter((d) => d.isDirectory())
        .map((d) => path.join(CLAUDE_DIR, d.name));
    } catch {
      return [];
    }
  }

  private findJsonlFiles(dir: string, now: number): string[] {
    const results: string[] = [];
    const addJsonl = (d: string) => {
      try {
        for (const f of fs.readdirSync(d)) {
          if (f.endsWith(".jsonl")) {
            const full = path.join(d, f);
            try {
              const stat = fs.statSync(full);
              // Subagents: include if modified within parent session window (they end via turn_end)
              // Main agents: filter by mtime staleness
              const limit = d.includes("/subagents/") ? SUBAGENT_STALE_MS : STALE_MS;
              if (now - stat.mtimeMs < limit) results.push(full);
            } catch {}
          }
        }
      } catch {}
    };

    // Scan top-level JSONL files
    addJsonl(dir);

    // Scan session UUID subdirectories for subagents/
    try {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        if (entry.isDirectory()) {
          const subagentsDir = path.join(dir, entry.name, "subagents");
          addJsonl(subagentsDir);
        }
      }
    } catch {}

    return results;
  }

  private startWatching(filePath: string, now: number) {
    let parentId: string | null = null;
    let subagentClass: MageColorIndex | null = null;
    let teamColor: MageColorIndex = (nextMageColor++ % 6) as MageColorIndex;

    // Only match subagents that live in a /subagents/ subdirectory
    // of a known parent session's UUID folder
    const isInSubagentsDir = filePath.includes("/subagents/");
    if (isInSubagentsDir) {
      // Quick check: if the last line has stop_reason "end_turn", it already completed
      let fd: number | undefined;
      try {
        fd = fs.openSync(filePath, "r");
        const stat = fs.fstatSync(fd);
        const tailSize = Math.min(4096, stat.size);
        const buf = Buffer.alloc(tailSize);
        fs.readSync(fd, buf, 0, tailSize, stat.size - tailSize);
        const tail = buf.toString("utf-8");
        if (tail.includes('"stop_reason":"end_turn"') || tail.includes('"stop_reason": "end_turn"') || tail.includes('"turn_duration"')) {
          this.departedPaths.set(filePath, Date.now());
          return;
        }
      } catch {
      } finally {
        if (fd !== undefined) try { fs.closeSync(fd); } catch {}
      }

      // Try to match to a parent by path: .../projects/<proj>/<uuid>/subagents/<file>.jsonl
      // Parent would be: .../projects/<proj>/<uuid>.jsonl
      const subagentsDir = path.dirname(filePath);        // .../subagents
      const uuidDir = path.dirname(subagentsDir);          // .../<uuid>
      const parentCandidate = uuidDir + ".jsonl";
      const parentSession = this.sessions.get(parentCandidate);
      if (parentSession) {
        parentId = parentCandidate;
        subagentClass = parentSession.teamColor;
        teamColor = parentSession.teamColor;
        if (parentSession.pendingSubAgents > 0) {
          parentSession.pendingSubAgents--;
        }
      } else {
        // No parent found but it's in a subagents dir — still mark as subagent
        subagentClass = teamColor;
      }
    }

    this.ccCounter++;
    const session: SessionInfo = {
      filePath,
      byteOffset: 0,
      state: "idle",
      currentTool: null,
      name: subagentClass !== null ? `sub-${this.ccCounter}` : `cc-${this.ccCounter}`,
      parentId,
      subagentClass,
      teamColor,
      lastActivity: now,
      pendingSubAgents: 0,
      expectingSubAgentSince: 0,
      idleSinceCheck: null,
      hasBeenActive: false,
    };

    this.sessions.set(filePath, session);

    // Read existing content to catch up
    this.tailFile(session);

    // Watch for changes
    fs.watchFile(filePath, { interval: WATCH_INTERVAL_MS }, () => {
      this.tailFile(session);
      this.emitUpdate();
    });

    // Schedule idle check immediately for path-detected subagents
    if (session.subagentClass !== null) {
      this.scheduleSubagentIdleCheck(session);
    }
  }

  private tailFile(session: SessionInfo) {
    let stat: fs.Stats;
    try {
      stat = fs.statSync(session.filePath);
    } catch {
      return;
    }

    if (stat.size <= session.byteOffset) return;

    // Use synchronous read to avoid race condition where emitUpdate()
    // fires before async stream finishes processing new lines
    let buffer: string;
    let fd: number | undefined;
    try {
      fd = fs.openSync(session.filePath, "r");
      const length = stat.size - session.byteOffset;
      const buf = Buffer.alloc(length);
      fs.readSync(fd, buf, 0, length, session.byteOffset);
      buffer = buf.toString("utf-8");
    } catch {
      return;
    } finally {
      if (fd !== undefined) try { fs.closeSync(fd); } catch {}
    }

    session.byteOffset = stat.size;
    const lines = buffer.split("\n").filter((l) => l.trim());

    for (const line of lines) {
      const event = parseTranscriptLine(line);
      if (!event) continue;

      session.lastActivity = Date.now();

      if (event.type === "state_change" && event.state) {
        session.state = event.state;
        session.currentTool = event.toolName ?? null;
        session.hasBeenActive = true;
        // EXP tracking — key by project dir so progress persists across sessions
        const currentAgents = this.getAgentList();
        const expId = session.subagentClass !== null ? session.filePath : path.dirname(session.filePath);
        if (event.toolName) {
          this.expTracker.onToolUse(expId, event.toolName, currentAgents);
        } else if (event.state === "thinking") {
          this.expTracker.onThinking(expId, currentAgents);
        }
      } else if (event.type === "sub_agent_spawn") {
        session.pendingSubAgents++;
        session.expectingSubAgentSince = Date.now();
        // Quickly rescan to pick up the subagent's JSONL file (deduped)
        if (!this.rescanPending) {
          this.rescanPending = true;
          setTimeout(() => { this.rescanPending = false; this.scan(); }, 500);
          setTimeout(() => this.scan(), 2000);
        }
      } else if (event.type === "turn_end") {
        if (session.subagentClass !== null) {
          this.departSubagent(session);
        } else {
          session.state = "idle";
          session.currentTool = null;
        }
      }
    }

    // Schedule idle check for subagents only after they've been seen active
    if (session.subagentClass !== null && session.hasBeenActive && session.state !== "departing") {
      this.scheduleSubagentIdleCheck(session);
    }
  }

  private departSubagent(session: SessionInfo) {
    if (session.state === "departing") return;
    session.state = "departing";
    session.currentTool = null;
    this.departedPaths.set(session.filePath, Date.now());
    this.expTracker.clearAgent(session.filePath);
    this.emitUpdate();
    setTimeout(() => {
      if (session.idleSinceCheck) clearTimeout(session.idleSinceCheck);
      fs.unwatchFile(session.filePath);
      this.sessions.delete(session.filePath);
      this.emitUpdate();
    }, 500);
  }

  private scheduleSubagentIdleCheck(session: SessionInfo) {
    // Reset any existing check
    if (session.idleSinceCheck) clearTimeout(session.idleSinceCheck);
    // If file doesn't grow in 5s, subagent is done
    const sizeAtCheck = session.byteOffset;
    session.idleSinceCheck = setTimeout(() => {
      if (session.byteOffset === sizeAtCheck && session.state !== "departing") {
        this.departSubagent(session);
      }
    }, 5000);
  }

  /** Immediately remove all CC sessions. Active ones will be re-discovered on next scan. */
  clearAll() {
    // Remove idle/lounging/stale agents — keep only agents actively doing work right now
    const now = Date.now();
    const activeStates = new Set(["typing", "thinking", "reading"]);
    for (const [filePath, session] of this.sessions) {
      if (activeStates.has(session.state) && now - session.lastActivity < 60_000) continue;
      if (session.idleSinceCheck) clearTimeout(session.idleSinceCheck);
      fs.unwatchFile(filePath);
      this.sessions.delete(filePath);
      // Only block re-discovery for subagents — main agents should be re-discovered
      if (session.subagentClass !== null) {
        this.departedPaths.set(filePath, now);
      }
    }
    this.emitUpdate();
  }

  /** Kill a specific agent session. Will reappear if CC is still active on next tool event. */
  removeAgent(agentId: string) {
    const session = this.sessions.get(agentId);
    if (session) {
      if (session.idleSinceCheck) clearTimeout(session.idleSinceCheck);
      fs.unwatchFile(agentId);
      this.sessions.delete(agentId);
      this.departedPaths.set(agentId, Date.now());
    }
    this.emitUpdate();
  }

  /** Build current agent list (for EXP tracker context). */
  private getAgentList(): AgentState[] {
    const now = Date.now();
    const agents: AgentState[] = [];
    for (const [filePath, session] of this.sessions) {
      const hasActiveSubagents = [...this.sessions.values()].some(
        (s) => s.parentId === filePath
      );
      const isLounging =
        session.subagentClass === null &&
        session.state === "idle" &&
        !hasActiveSubagents &&
        now - session.lastActivity > LOUNGE_MS;
      const effectiveState = (session.state === "idle" && hasActiveSubagents) ? "thinking" : session.state;
      agents.push({
        id: filePath,
        source: "cc",
        state: isLounging ? "lounging" : effectiveState,
        currentTool: session.currentTool,
        name: session.name,
        parentId: session.parentId,
        subagentClass: session.subagentClass,
        teamColor: session.teamColor,
        lastActivity: session.lastActivity,
      });
    }
    return agents;
  }

  private emitUpdate() {
    this.emitVersion++;
    const now = Date.now();
    const agents: AgentState[] = [];
    for (const [filePath, session] of this.sessions) {
      // Main agents (not subagents) idle for 2+ min → lounging
      // But don't lounge if this agent has active subagents running
      const hasActiveSubagents = [...this.sessions.values()].some(
        (s) => s.parentId === filePath
      );
      const isLounging =
        session.subagentClass === null &&
        session.state === "idle" &&
        !hasActiveSubagents &&
        now - session.lastActivity > LOUNGE_MS;
      // Re-link orphaned subagents to parent if parent now exists
      if (session.subagentClass !== null && session.parentId) {
        const parentSession = this.sessions.get(session.parentId);
        if (parentSession && session.teamColor !== parentSession.teamColor) {
          session.teamColor = parentSession.teamColor;
          session.subagentClass = parentSession.teamColor;
        }
      }

      // Show as "thinking" while subagents work (main session idles during background tasks)
      const effectiveState = (session.state === "idle" && hasActiveSubagents) ? "thinking" : session.state;

      agents.push({
        id: filePath,
        source: "cc",
        state: isLounging ? "lounging" : effectiveState,
        currentTool: session.currentTool,
        name: session.name,
        parentId: session.parentId,
        subagentClass: session.subagentClass,
        teamColor: session.teamColor,
        lastActivity: session.lastActivity,
        stateVersion: this.emitVersion,
        ...this.expTracker.getExpFields(session.subagentClass !== null ? filePath : path.dirname(filePath), session.subagentClass !== null),
      });
    }
    this.emit("update", agents);
  }
}
