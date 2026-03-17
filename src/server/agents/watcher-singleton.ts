import { EventEmitter } from "events";
import { ClaudeCodeWatcher } from "./cc-watcher";
import { OpenClawWatcher } from "./openclaw-watcher";
import { ExpTracker } from "./exp-tracker";
import type { AgentState } from "../../shared/types";

class WatcherSingleton extends EventEmitter {
  private ccWatcher: ClaudeCodeWatcher;
  private ocWatcher: OpenClawWatcher;
  private ccAgents: AgentState[] = [];
  private ocAgent: AgentState | null = null;
  private started = false;
  public expTracker: ExpTracker;

  constructor(clawBaseUrl: string) {
    super();
    this.expTracker = new ExpTracker();
    this.ccWatcher = new ClaudeCodeWatcher(this.expTracker);
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
    this.expTracker.clearAll();
  }

  removeAgent(agentId: string) {
    this.ccWatcher.removeAgent(agentId);
    this.ccAgents = this.ccAgents.filter(a => a.id !== agentId);
    this.emitMerged();
  }
}

export function createWatcher(clawBaseUrl: string): WatcherSingleton {
  return new WatcherSingleton(clawBaseUrl);
}
