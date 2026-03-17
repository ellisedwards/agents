// src/server/agents/exp-tracker.ts
import {
  EXP_AWARDS, BONUS_FIRST_BLOOD, BONUS_STREAK, BONUS_SPEED_COMBO,
  BONUS_RIVALRY, CRITICAL_HIT_CHANCE, SUBAGENT_EXP_SHARE,
  STREAK_GAP_MS, SPEED_COMBO_WINDOW_MS, SPEED_COMBO_COUNT,
  TOOL_MASTERY_THRESHOLD, TOOL_MASTERY, AGENT_NAMES,
  expForLevel, getLevelTitle,
} from "../../shared/game-constants";
import type { AgentState } from "../../shared/types";

interface AgentExpData {
  exp: number;
  level: number;
  expToNext: number;
  totalExp: number;
  streak: boolean;
  streakStart: number;
  lastToolTime: number;
  recentTools: number[];
  toolCounts: Record<string, number>;
  firstBloodAwarded: boolean;
  gameName: string;
  leveledUp: boolean; // flag for current tick, cleared after read
}

export class ExpTracker {
  private data = new Map<string, AgentExpData>();
  private usedNames = new Set<string>();
  private enabled = false;

  setEnabled(on: boolean) {
    if (!on) {
      this.data.clear();
      this.usedNames.clear();
    }
    this.enabled = on;
  }

  isEnabled(): boolean { return this.enabled; }

  private assignName(): string {
    const available = AGENT_NAMES.filter(n => !this.usedNames.has(n));
    if (available.length > 0) {
      const name = available[Math.floor(Math.random() * available.length)];
      this.usedNames.add(name);
      return name;
    }
    // All names used — add suffix
    const base = AGENT_NAMES[Math.floor(Math.random() * AGENT_NAMES.length)];
    let suffix = 2;
    while (this.usedNames.has(`${base} ${toRoman(suffix)}`)) suffix++;
    const name = `${base} ${toRoman(suffix)}`;
    this.usedNames.add(name);
    return name;
  }

  private getOrCreate(agentId: string): AgentExpData {
    let d = this.data.get(agentId);
    if (!d) {
      d = {
        exp: 0, level: 1, expToNext: expForLevel(1), totalExp: 0,
        streak: false, streakStart: 0, lastToolTime: 0,
        recentTools: [], toolCounts: {}, firstBloodAwarded: false,
        gameName: this.assignName(), leveledUp: false,
      };
      this.data.set(agentId, d);
    }
    return d;
  }

  onToolUse(agentId: string, toolName: string | null, allAgents: AgentState[]): void {
    if (!this.enabled || !toolName) return;

    // Don't award for lounging/departing agents
    const agent = allAgents.find(a => a.id === agentId);
    if (agent && (agent.state === "lounging" || agent.state === "departing")) return;

    const d = this.getOrCreate(agentId);
    const now = Date.now();
    let baseExp = EXP_AWARDS[toolName] ?? 3;

    // Critical hit (10% chance, doubles base EXP only — applied before bonuses)
    const isCrit = Math.random() < CRITICAL_HIT_CHANCE;
    if (isCrit) baseExp *= 2;

    // First blood (bonus, not doubled by crit)
    if (!d.firstBloodAwarded) {
      baseExp += BONUS_FIRST_BLOOD;
      d.firstBloodAwarded = true;
    }

    // Speed combo
    d.recentTools.push(now);
    d.recentTools = d.recentTools.filter(t => now - t < SPEED_COMBO_WINDOW_MS);
    if (d.recentTools.length >= SPEED_COMBO_COUNT) {
      baseExp += BONUS_SPEED_COMBO;
    }

    // Streak tracking
    if (d.lastToolTime > 0 && now - d.lastToolTime < STREAK_GAP_MS) {
      if (!d.streak && d.streakStart > 0 && now - d.streakStart >= 300000) {
        d.streak = true;
      }
      if (!d.streakStart) d.streakStart = d.lastToolTime;
    } else {
      d.streak = false;
      d.streakStart = now;
    }
    if (d.streak) baseExp += BONUS_STREAK;

    // Rivalry spark — check if 2+ agents are both typing
    const typingCount = allAgents.filter(a =>
      a.source === "cc" && a.state === "typing" && a.id !== agentId
    ).length;
    if (typingCount > 0) baseExp += BONUS_RIVALRY;

    // Tool mastery tracking
    d.toolCounts[toolName] = (d.toolCounts[toolName] || 0) + 1;

    // Award EXP
    this.awardExp(d, baseExp);
    d.lastToolTime = now;

    // Subagent EXP share — find parent and give them 50%
    if (agent?.parentId) {
      const parentData = this.data.get(agent.parentId);
      if (parentData) {
        this.awardExp(parentData, Math.floor(baseExp * SUBAGENT_EXP_SHARE));
      }
    }
  }

  onThinking(agentId: string, allAgents: AgentState[]): void {
    if (!this.enabled) return;
    const agent = allAgents.find(a => a.id === agentId);
    if (agent && (agent.state === "lounging" || agent.state === "departing")) return;
    const d = this.getOrCreate(agentId);
    this.awardExp(d, EXP_AWARDS.thinking);
  }

  private awardExp(d: AgentExpData, amount: number): void {
    d.exp += amount;
    d.totalExp += amount;
    while (d.exp >= d.expToNext) {
      d.exp -= d.expToNext;
      d.level++;
      d.expToNext = expForLevel(d.level);
      d.leveledUp = true;
    }
  }

  /** Get EXP fields to merge into AgentState. Returns null if no data or subagent. */
  getExpFields(agentId: string, isSubagent: boolean): Partial<AgentState> | null {
    if (!this.enabled) return null;
    const d = this.data.get(agentId);
    if (!d) return null;
    // Subagents don't get game names or display fields (they're transient)
    if (isSubagent) return null;

    const masteries: string[] = [];
    for (const [tool, count] of Object.entries(d.toolCounts)) {
      if (count >= TOOL_MASTERY_THRESHOLD && TOOL_MASTERY[tool]) {
        const title = TOOL_MASTERY[tool];
        if (!masteries.includes(title)) masteries.push(title);
      }
    }

    return {
      exp: d.exp,
      level: d.level,
      expToNext: d.expToNext,
      streak: d.streak,
      title: masteries[0] ?? getLevelTitle(d.level),
      gameName: d.gameName,
      toolMasteries: masteries.length > 0 ? masteries : undefined,
    };
  }

  /** Check and clear the level-up flag. Returns true if agent just leveled up. */
  consumeLevelUp(agentId: string): boolean {
    const d = this.data.get(agentId);
    if (!d || !d.leveledUp) return false;
    d.leveledUp = false;
    return true;
  }

  /** Get level for an agent (for Yeelight sparkle). */
  getLevel(agentId: string): number {
    return this.data.get(agentId)?.level ?? 1;
  }

  clearAgent(agentId: string): void {
    const d = this.data.get(agentId);
    if (d) this.usedNames.delete(d.gameName);
    this.data.delete(agentId);
  }

  clearAll(): void {
    this.data.clear();
    this.usedNames.clear();
  }
}

function toRoman(n: number): string {
  const vals = [10, 9, 5, 4, 1];
  const syms = ["X", "IX", "V", "IV", "I"];
  let result = "";
  for (let i = 0; i < vals.length; i++) {
    while (n >= vals[i]) { result += syms[i]; n -= vals[i]; }
  }
  return result;
}
