// src/server/agents/exp-tracker.ts
import {
  EXP_AWARDS, BONUS_FIRST_BLOOD, BONUS_STREAK, BONUS_SPEED_COMBO,
  BONUS_RIVALRY, CRITICAL_HIT_CHANCE, LUCKY_BREAK_CHANCE, LUCKY_BREAK_MULTIPLIER, SUBAGENT_EXP_SHARE,
  STREAK_GAP_MS, SPEED_COMBO_WINDOW_MS, SPEED_COMBO_COUNT,
  TOOL_MASTERY_THRESHOLD, TOOL_MASTERY, AGENT_NAMES,
  expForLevel, getLevelTitle,
} from "../../shared/game-constants";
import type { AgentState } from "../../shared/types";
import fs from "fs";

const STATE_FILE = "/tmp/agent-office-game-mode";
const EXP_FILE = "/tmp/agent-office-exp.json";

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
  critCount: number;
  rivalryExp: number;
  sessionStartTime: number;
  achievements: string[];
}

/** Serializable subset of AgentExpData for persistence */
interface PersistedAgent {
  exp: number;
  level: number;
  expToNext: number;
  totalExp: number;
  toolCounts: Record<string, number>;
  firstBloodAwarded: boolean;
  gameName: string;
  achievements?: string[];
}

export class ExpTracker {
  private data = new Map<string, AgentExpData>();
  private usedNames = new Set<string>();
  private enabled: boolean;
  private savePending = false;
  private lastSaveTime = 0;
  private warm = false; // false during initial log replay, true after first full scan
  private static readonly SAVE_INTERVAL_MS = 5000;

  constructor() {
    // Restore game mode state from previous server run
    try { this.enabled = fs.readFileSync(STATE_FILE, "utf-8").trim() === "true"; }
    catch { this.enabled = false; }
    // Restore exp data — skip re-awarding during log replay
    if (this.enabled) this.loadFromDisk();
  }

  /** Call after initial log scan is complete to start awarding new exp */
  markWarm(): void {
    this.warm = true;
    console.log("[exp-tracker] warm — awarding new exp only");
  }

  setEnabled(on: boolean) {
    if (!on) {
      this.data.clear();
      this.usedNames.clear();
      this.deleteFromDisk();
    }
    this.enabled = on;
    try { fs.writeFileSync(STATE_FILE, String(on)); } catch {}
  }

  private loadFromDisk(): void {
    try {
      const raw = fs.readFileSync(EXP_FILE, "utf-8");
      const saved: Record<string, PersistedAgent> = JSON.parse(raw);
      for (const [id, p] of Object.entries(saved)) {
        this.usedNames.add(p.gameName);
        this.data.set(id, {
          exp: p.exp,
          level: p.level,
          expToNext: p.expToNext,
          totalExp: p.totalExp,
          streak: false,
          streakStart: 0,
          lastToolTime: 0,
          recentTools: [],
          toolCounts: p.toolCounts ?? {},
          firstBloodAwarded: p.firstBloodAwarded,
          gameName: p.gameName,
          leveledUp: false, // never flash on restore
          critCount: 0, rivalryExp: 0, sessionStartTime: Date.now(),
          achievements: p.achievements ?? [],
        });
      }
      console.log(`[exp-tracker] restored ${this.data.size} agents from disk`);
    } catch {
      // No saved data or corrupt — start fresh
    }
  }

  private scheduleSave(): void {
    if (this.savePending) return;
    const elapsed = Date.now() - this.lastSaveTime;
    if (elapsed >= ExpTracker.SAVE_INTERVAL_MS) {
      this.saveToDisk();
    } else {
      this.savePending = true;
      setTimeout(() => {
        this.savePending = false;
        this.saveToDisk();
      }, ExpTracker.SAVE_INTERVAL_MS - elapsed);
    }
  }

  private saveToDisk(): void {
    this.lastSaveTime = Date.now();
    const out: Record<string, PersistedAgent> = {};
    for (const [id, d] of this.data) {
      out[id] = {
        exp: d.exp, level: d.level, expToNext: d.expToNext,
        totalExp: d.totalExp, toolCounts: d.toolCounts,
        firstBloodAwarded: d.firstBloodAwarded, gameName: d.gameName,
        achievements: d.achievements,
      };
    }
    try { fs.writeFileSync(EXP_FILE, JSON.stringify(out)); } catch {}
  }

  private deleteFromDisk(): void {
    try { fs.unlinkSync(EXP_FILE); } catch {}
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
        critCount: 0, rivalryExp: 0, sessionStartTime: Date.now(), achievements: [],
      };
      this.data.set(agentId, d);
    }
    return d;
  }

  onToolUse(agentId: string, toolName: string | null, allAgents: AgentState[]): void {
    if (!this.enabled || !toolName || !this.warm) return;

    // Don't award for lounging/departing agents
    const agent = allAgents.find(a => a.id === agentId);
    if (agent && (agent.state === "lounging" || agent.state === "departing")) return;

    const d = this.getOrCreate(agentId);
    const now = Date.now();
    let baseExp = EXP_AWARDS[toolName] ?? 3;

    // Critical hit (10% chance, doubles base EXP only — applied before bonuses)
    const isCrit = Math.random() < CRITICAL_HIT_CHANCE;
    if (isCrit) { baseExp *= 2; d.critCount = (d.critCount ?? 0) + 1; }

    // Lucky Break (2% chance, 3x exp — stacks with crit)
    const isLucky = Math.random() < LUCKY_BREAK_CHANCE;
    if (isLucky) baseExp *= LUCKY_BREAK_MULTIPLIER;

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
    if (typingCount > 0) { baseExp += BONUS_RIVALRY; d.rivalryExp = (d.rivalryExp ?? 0) + BONUS_RIVALRY; }

    // Tool mastery tracking
    d.toolCounts[toolName] = (d.toolCounts[toolName] || 0) + 1;

    // Award EXP
    this.awardExp(d, baseExp);
    d.lastToolTime = now;

    // Check achievements
    const newAchievements = this.checkAchievements(d);
    if (newAchievements.length > d.achievements.length) {
      d.achievements = newAchievements;
    }

    // Subagent EXP share — find parent and give them 50%
    if (agent?.parentId) {
      const parentData = this.data.get(agent.parentId);
      if (parentData) {
        this.awardExp(parentData, Math.floor(baseExp * SUBAGENT_EXP_SHARE));
      }
    }
  }

  private lastThinkingExp = new Map<string, number>(); // agentId → timestamp
  private static readonly THINKING_COOLDOWN_MS = 30_000; // 30s between thinking exp

  onThinking(agentId: string, allAgents: AgentState[]): void {
    if (!this.enabled || !this.warm) return;
    const agent = allAgents.find(a => a.id === agentId);
    if (agent && (agent.state === "lounging" || agent.state === "departing")) return;
    const now = Date.now();
    const last = this.lastThinkingExp.get(agentId) ?? 0;
    if (now - last < ExpTracker.THINKING_COOLDOWN_MS) return;
    this.lastThinkingExp.set(agentId, now);
    const d = this.getOrCreate(agentId);
    this.awardExp(d, EXP_AWARDS.thinking);
  }

  private awardExp(d: AgentExpData, amount: number): void {
    d.exp += amount;
    d.totalExp += amount;
    let didLevel = false;
    while (d.exp >= d.expToNext) {
      d.exp -= d.expToNext;
      d.level++;
      d.expToNext = expForLevel(d.level);
      d.leveledUp = true;
      didLevel = true;
    }
    // Save immediately on level-up, debounced otherwise
    if (didLevel) this.saveToDisk();
    else this.scheduleSave();
  }

  private checkAchievements(d: AgentExpData): string[] {
    const earned: string[] = [];
    if (d.firstBloodAwarded) earned.push("first-blood");
    if (d.level >= 5 && Date.now() - d.sessionStartTime < 30 * 60 * 1000) earned.push("speed-runner");

    // Count tool masteries
    let masteryCount = 0;
    for (const [tool, count] of Object.entries(d.toolCounts)) {
      if (count >= TOOL_MASTERY_THRESHOLD && TOOL_MASTERY[tool]) masteryCount++;
    }
    if (masteryCount >= 3) earned.push("polymath");

    if (d.streak && d.streakStart > 0 && Date.now() - d.streakStart >= 30 * 60 * 1000) earned.push("marathon");
    if ((d.critCount ?? 0) >= 10) earned.push("critical-master");
    if ((d.rivalryExp ?? 0) >= 50) earned.push("team-player");
    if ((d.toolCounts["Bash"] ?? 0) >= 200) earned.push("shell-shocked");
    if ((d.toolCounts["Read"] ?? 0) >= 200) earned.push("bookworm");
    return earned;
  }

  /** Get EXP fields to merge into AgentState. Returns null if no data or subagent. */
  getExpFields(agentId: string, isSubagent: boolean): Partial<AgentState> | null {
    if (!this.enabled) return null;
    const d = this.data.get(agentId);
    if (!d) return null;
    // Subagents don't get game names or display fields (they're transient)
    if (isSubagent) return null;

    // Find the dominant tool (most used that has a mastery title)
    let topTool: string | null = null;
    let topCount = 0;
    for (const [tool, count] of Object.entries(d.toolCounts)) {
      if (count >= TOOL_MASTERY_THRESHOLD && TOOL_MASTERY[tool] && count > topCount) {
        topTool = tool;
        topCount = count;
      }
    }
    const masteryTitle = topTool ? TOOL_MASTERY[topTool] : null;

    return {
      exp: d.exp,
      level: d.level,
      expToNext: d.expToNext,
      streak: d.streak,
      title: masteryTitle ?? getLevelTitle(d.level, d.gameName),
      gameName: d.gameName,
      toolMasteries: masteryTitle ? [masteryTitle] : undefined,
      achievements: d.achievements.length > 0 ? d.achievements : undefined,
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

  renameAgent(agentId: string, newName: string): boolean {
    const d = this.data.get(agentId);
    if (!d) return false;
    this.usedNames.delete(d.gameName);
    d.gameName = newName;
    this.usedNames.add(newName);
    this.saveToDisk();
    return true;
  }

  clearAgent(agentId: string): void {
    const d = this.data.get(agentId);
    if (d) this.usedNames.delete(d.gameName);
    this.data.delete(agentId);
    this.lastThinkingExp.delete(agentId);
    this.scheduleSave();
  }

  clearAll(): void {
    this.data.clear();
    this.usedNames.clear();
    this.deleteFromDisk();
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
