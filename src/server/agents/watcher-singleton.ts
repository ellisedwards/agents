import { EventEmitter } from "events";
import { ClaudeCodeWatcher } from "./cc-watcher";
import { OpenClawWatcher } from "./openclaw-watcher";
import type { AgentState } from "../../shared/types";

class WatcherSingleton extends EventEmitter {
  private ccWatcher = new ClaudeCodeWatcher();
  private ocWatcher: OpenClawWatcher;
  private ccAgents: AgentState[] = [];
  private ocAgent: AgentState | null = null;
  private started = false;

  constructor(clawBaseUrl: string) {
    super();
    this.ocWatcher = new OpenClawWatcher(clawBaseUrl);
  }

  start() {
    if (this.started) return;
    this.started = true;

    this.ccWatcher.on("update", (agents: AgentState[]) => {
      this.ccAgents = agents;
      this.emitMerged();
    });

    this.ocWatcher.on("update", (agent: AgentState) => {
      this.ocAgent = agent;
      this.emitMerged();
    });

    this.ccWatcher.start();
    this.ocWatcher.start();
  }

  private emitMerged() {
    const all = [...this.ccAgents];
    if (this.ocAgent) all.push(this.ocAgent);
    this.emit("agents", all);
  }

  getAgents(): AgentState[] {
    const all = [...this.ccAgents];
    if (this.ocAgent) all.push(this.ocAgent);
    return all;
  }

  clearAll() {
    this.ccWatcher.clearAll();
  }
}

export function createWatcher(clawBaseUrl: string): WatcherSingleton {
  return new WatcherSingleton(clawBaseUrl);
}
