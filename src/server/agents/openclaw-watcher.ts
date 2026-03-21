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
  private polling = false;
  private readonly primaryUrl: string;
  private readonly fallbackUrl: string | null;
  private usingFallback = false;
  private pollsSinceFallback = 0;

  constructor(clawBaseUrl: string, fallbackBaseUrl?: string) {
    super();
    this.primaryUrl = `${clawBaseUrl}/status`;
    this.fallbackUrl = fallbackBaseUrl ? `${fallbackBaseUrl}/status` : null;
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
    if (this.polling) return; // previous curl still in-flight
    this.polling = true;
    // Every 60 polls (~60s) on fallback, try primary again
    if (this.usingFallback && ++this.pollsSinceFallback % 60 === 0) {
      this.curlStatus(this.primaryUrl, (ok) => {
        if (ok) {
          this.usingFallback = false;
          this.pollsSinceFallback = 0;
          console.log("[openclaw-watcher] switched back to primary");
        }
      });
    }
    const url = this.usingFallback ? this.fallbackUrl! : this.primaryUrl;
    this.curlStatus(url, (ok, status) => {
      this.polling = false;
      if (ok && status) {
        const state = this.deriveState(status);
        this.emit("update", this.makeAgent(state));
        return;
      }
      // Primary failed — try fallback
      if (!this.usingFallback && this.fallbackUrl) {
        this.curlStatus(this.fallbackUrl, (ok2, status2) => {
          if (ok2 && status2) {
            this.usingFallback = true;
            console.log("[openclaw-watcher] switched to fallback");
            this.emit("update", this.makeAgent(this.deriveState(status2)));
          } else {
            this.emit("update", this.makeAgent("idle", true));
          }
        });
      } else {
        this.emit("update", this.makeAgent("idle", true));
      }
    });
  }

  private curlStatus(url: string, cb: (ok: boolean, status?: OpenClawStatus) => void) {
    execFile("curl", ["-s", "--connect-timeout", "2", "--max-time", "2", url],
      { timeout: 3000 }, (err, stdout) => {
        if (err || !stdout.trim()) return cb(false);
        try {
          cb(true, JSON.parse(stdout));
        } catch {
          cb(false);
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
