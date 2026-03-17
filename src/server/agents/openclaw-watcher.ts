import { EventEmitter } from "events";
import { execFile } from "child_process";
import type { AgentState, AgentActivityState } from "../../shared/types";

interface OpenClawStatus {
  connected: boolean;
  animation_running: boolean;
  zones: {
    thinking: string;
    display: string;
    context: string;
  };
  agent_slots: {
    active_count: number;
    activity_running: boolean;
  };
  // Dedicated claw activity field (added by claw on request)
  claw_activity?: "idle" | "thinking" | "typing";
}

export class OpenClawWatcher extends EventEmitter {
  private interval: ReturnType<typeof setInterval> | null = null;
  private readonly statusUrl: string;

  constructor(clawBaseUrl: string) {
    super();
    this.statusUrl = `${clawBaseUrl}/status`;
  }

  start() {
    this.poll();
    this.interval = setInterval(() => this.poll(), 1000);
  }

  stop() {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
  }

  private poll() {
    execFile("curl", ["-s", "--connect-timeout", "2", "--max-time", "2", this.statusUrl],
      { timeout: 3000 }, (err, stdout) => {
        if (err || !stdout.trim()) {
          this.emit("update", this.makeAgent("idle", true));
          return;
        }
        try {
          const status: OpenClawStatus = JSON.parse(stdout);
          const state = this.deriveState(status);
          this.emit("update", this.makeAgent(state));
        } catch {
          this.emit("update", this.makeAgent("idle", true));
        }
      });
  }

  private deriveState(status: OpenClawStatus): AgentActivityState {
    // Use dedicated field if claw provides it
    if (status.claw_activity) {
      return status.claw_activity;
    }
    // Fallback: assume idle — agent_slots are shared with CC and unreliable
    return "idle";
  }

  private makeAgent(
    state: AgentState["state"],
    unreachable = false
  ): AgentState {
    return {
      id: "openclaw-main",
      source: "openclaw",
      state: unreachable ? "idle" : state,
      currentTool: null,
      name: "claw-main",
      parentId: null,
      subagentClass: null,
      teamColor: 0 as import("../../shared/types").MageColorIndex,
      lastActivity: unreachable ? 0 : Date.now(),
    };
  }
}
