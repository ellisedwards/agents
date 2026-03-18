import { create } from "zustand";
import type { AgentState } from "@/shared/types";

export interface MonitorStatus {
  id: number;
  name: string;
  up: boolean;
  ping: number | null;
}

export interface RelayMessage {
  from: string;
  msg: string;
  time: string;
}

export interface ClawHealth {
  reachable: boolean;
  yeelightConnected: boolean;
  slots: string[];
  activeSlots: number;
  matrixMode: string | null;
  brightness?: number | null;
  animationRunning?: boolean;
}

export type TimeMode = "auto" | "day" | "dawn" | "night";
export type TowerSize = "small" | "medium" | "large" | "monolith";
export type ThemeId = "forest" | "golden-ruins" | "tropical-island" | "lunar-base" | "pallet-town" | "pokemoon" | "jungle-ruins";
export type EditMode = "none" | "background" | "tower-decor" | "lounge" | "posters";
export type HudPosition = "top-left" | "bottom-left" | "bottom-right";

interface TowerPrefs {
  visible: boolean;
  size: TowerSize;
  x: number;
  y: number;
  opacity: number;
}

const TOWER_STORAGE_KEY = "agent-office-tower";

function loadTowerPrefs(): TowerPrefs {
  const defaults: TowerPrefs = { visible: true, size: "medium", x: 12, y: 0, opacity: 100 };
  if (typeof window === "undefined") return defaults;
  try {
    const raw = localStorage.getItem(TOWER_STORAGE_KEY);
    if (!raw) return defaults;
    const parsed = JSON.parse(raw);
    if (parsed.size === "obelisk") parsed.size = "monolith";
    return { ...defaults, ...parsed };
  } catch {}
  return defaults;
}

function saveTowerPrefs(prefs: TowerPrefs) {
  try {
    localStorage.setItem(TOWER_STORAGE_KEY, JSON.stringify(prefs));
  } catch {}
}

const THEME_STORAGE_KEY = "agent-office-theme";
const VALID_THEMES: ThemeId[] = ["forest", "golden-ruins", "tropical-island", "lunar-base", "pallet-town", "pokemoon", "jungle-ruins"];

function loadGameMode(): boolean {
  try { return localStorage.getItem("agent-office-game-mode") === "true"; } catch { return false; }
}

function loadThemeId(): ThemeId {
  if (typeof window === "undefined") return "forest";
  try {
    const raw = localStorage.getItem(THEME_STORAGE_KEY);
    if (raw && VALID_THEMES.includes(raw as ThemeId)) return raw as ThemeId;
  } catch {}
  return "forest";
}

interface AgentOfficeStore {
  agents: AgentState[];
  selectedAgentId: string | null;
  connectionStatus: "connecting" | "connected" | "disconnected";
  monitors: MonitorStatus[];
  monitorsLoaded: boolean;
  clawHealth: ClawHealth | null;
  statusPosterOn: boolean;
  healthPosterOn: boolean;
  clawDetailOpen: boolean;
  relayMessages: RelayMessage[];
  relaySeenCount: number;
  labelsOn: boolean;
  debugOn: boolean;
  timeMode: TimeMode;
  themeId: ThemeId;
  towerSize: TowerSize;
  towerVisible: boolean;
  towerPos: { x: number; y: number };
  towerOpacity: number;
  editMode: EditMode;
  gameModeOn: boolean;
  hudPosition: HudPosition;
  levelUpEvents: Array<{ id: string; agentId: string; name: string; level: number; teamColor: string; ts: number }>;
  addLevelUp: (agentId: string, name: string, level: number, teamColor: string) => void;
  expGainEvents: Array<{ id: string; agentId: string; amount: number; teamColor: string; ts: number }>;
  addExpGain: (agentId: string, amount: number, teamColor: string) => void;
  achievementEvents: Array<{ id: string; agentName: string; achievementId: string; icon: string; name: string; teamColor: string; ts: number }>;
  addAchievement: (agentName: string, achievementId: string, icon: string, name: string, teamColor: string) => void;
  setAgents: (agents: AgentState[]) => void;
  selectAgent: (id: string | null) => void;
  setConnectionStatus: (status: AgentOfficeStore["connectionStatus"]) => void;
  setMonitors: (monitors: MonitorStatus[]) => void;
  setClawHealth: (health: ClawHealth) => void;
  setStatusPosterOn: (on: boolean) => void;
  setHealthPosterOn: (on: boolean) => void;
  toggleClawDetail: () => void;
  setRelayMessages: (messages: RelayMessage[]) => void;
  markRelaySeen: () => void;
  setLabelsOn: (on: boolean) => void;
  setDebugOn: (on: boolean) => void;
  setTimeMode: (mode: TimeMode) => void;
  setThemeId: (id: ThemeId) => void;
  setTowerSize: (size: TowerSize) => void;
  setTowerVisible: (visible: boolean) => void;
  setTowerPos: (pos: { x: number; y: number }) => void;
  setTowerOpacity: (opacity: number) => void;
  setEditMode: (mode: EditMode) => void;
  setGameModeOn: (on: boolean) => void;
  setHudPosition: (pos: HudPosition) => void;
  killAgent: (agentId: string) => void;
}

const initialTower = loadTowerPrefs();

export const useAgentOfficeStore = create<AgentOfficeStore>((set, get) => ({
  agents: [],
  selectedAgentId: null,
  connectionStatus: "connecting",
  monitors: [],
  monitorsLoaded: false,
  clawHealth: null,
  statusPosterOn: true,
  healthPosterOn: true,
  clawDetailOpen: false,
  relayMessages: [],
  relaySeenCount: (() => { try { return parseInt(localStorage.getItem("relay-seen") || "0", 10); } catch { return 0; } })(),
  labelsOn: false,
  debugOn: false,
  timeMode: "auto",
  themeId: loadThemeId(),
  towerSize: initialTower.size,
  towerVisible: initialTower.visible,
  towerPos: { x: initialTower.x, y: initialTower.y },
  towerOpacity: initialTower.opacity,
  editMode: "none",
  gameModeOn: loadGameMode(),
  hudPosition: (localStorage.getItem("agent-office-hud-pos") as HudPosition) || "top-left",
  levelUpEvents: [],
  addLevelUp: (agentId, name, level, teamColor) => {
    const ev = { id: `${agentId}-${level}-${Date.now()}`, agentId, name, level, teamColor, ts: Date.now() };
    set({ levelUpEvents: [...get().levelUpEvents, ev] });
    setTimeout(() => {
      set({ levelUpEvents: get().levelUpEvents.filter(e => e.id !== ev.id) });
    }, 3000);
  },
  achievementEvents: [],
  addAchievement: (agentName, achievementId, icon, name, teamColor) => {
    const ev = { id: `${achievementId}-${Date.now()}`, agentName, achievementId, icon, name, teamColor, ts: Date.now() };
    set({ achievementEvents: [...get().achievementEvents, ev] });
    setTimeout(() => {
      set({ achievementEvents: get().achievementEvents.filter(e => e.id !== ev.id) });
    }, 4000);
  },
  expGainEvents: [],
  addExpGain: (agentId, amount, teamColor) => {
    const ev = { id: `${agentId}-${Date.now()}-${Math.random()}`, agentId, amount, teamColor, ts: Date.now() };
    set({ expGainEvents: [...get().expGainEvents, ev] });
    setTimeout(() => {
      set({ expGainEvents: get().expGainEvents.filter(e => e.id !== ev.id) });
    }, 1500);
  },
  setAgents: (incoming) => {
    const now = Date.now();
    const prev = get().agents;
    // Build version map from previous agents to reject out-of-order SSE updates
    const prevVersions = new Map(prev.map(a => [a.id, a.stateVersion ?? 0]));
    // Filter incoming to only include agents with equal or higher version
    const filtered: AgentState[] = incoming.filter(a => {
      const prevV = prevVersions.get(a.id) ?? 0;
      return (a.stateVersion ?? 0) >= prevV;
    });
    // Build map of filtered incoming agents
    const incomingMap = new Map(filtered.map((a) => [a.id, a]));
    // Merge: use incoming data, but keep recently-seen agents that
    // briefly disappeared (grace period prevents flicker from transient poll gaps)
    const graceMs = 15000;
    // Trust the server's state — it handles idle/lounging/thinking correctly
    const merged: AgentState[] = [...filtered];
    for (const old of prev) {
      if (!incomingMap.has(old.id) && now - old.lastActivity < graceMs) {
        merged.push(old);
      }
    }
    set({ agents: merged });
  },
  selectAgent: (id) => set({ selectedAgentId: id }),
  setConnectionStatus: (connectionStatus) => set({ connectionStatus }),
  setMonitors: (monitors) => set({ monitors, monitorsLoaded: true }),
  setClawHealth: (clawHealth) => set({ clawHealth }),
  setStatusPosterOn: (statusPosterOn) => set({ statusPosterOn }),
  setHealthPosterOn: (healthPosterOn) => set({ healthPosterOn }),
  toggleClawDetail: () => set({ clawDetailOpen: !get().clawDetailOpen }),
  setRelayMessages: (relayMessages) => set({ relayMessages }),
  markRelaySeen: () => {
    const count = get().relayMessages.length;
    set({ relaySeenCount: count });
    try { localStorage.setItem("relay-seen", String(count)); } catch {}
  },
  setLabelsOn: (labelsOn) => set({ labelsOn }),
  setDebugOn: (debugOn) => set({ debugOn }),
  setTimeMode: (timeMode) => set({ timeMode }),
  setThemeId: (themeId) => {
    set({ themeId });
    try { localStorage.setItem(THEME_STORAGE_KEY, themeId); } catch {}
  },
  setTowerSize: (size) => {
    set({ towerSize: size });
    const s = get();
    saveTowerPrefs({ visible: s.towerVisible, size, x: s.towerPos.x, y: s.towerPos.y, opacity: s.towerOpacity });
  },
  setTowerVisible: (visible) => {
    set({ towerVisible: visible });
    const s = get();
    saveTowerPrefs({ visible, size: s.towerSize, x: s.towerPos.x, y: s.towerPos.y, opacity: s.towerOpacity });
  },
  setTowerPos: (pos) => {
    set({ towerPos: pos });
    const s = get();
    saveTowerPrefs({ visible: s.towerVisible, size: s.towerSize, x: pos.x, y: pos.y, opacity: s.towerOpacity });
  },
  setTowerOpacity: (opacity) => {
    set({ towerOpacity: opacity });
    const s = get();
    saveTowerPrefs({ visible: s.towerVisible, size: s.towerSize, x: s.towerPos.x, y: s.towerPos.y, opacity });
  },
  setEditMode: (editMode) => set({ editMode }),
  setGameModeOn: (on) => {
    set({ gameModeOn: on });
    localStorage.setItem("agent-office-game-mode", String(on));
    fetch("/api/game-mode", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabled: on }),
    }).catch(() => {});
  },
  setHudPosition: (pos) => {
    set({ hudPosition: pos });
    localStorage.setItem("agent-office-hud-pos", pos);
  },
  killAgent: (agentId) => {
    // Remove from local store immediately
    set({ agents: get().agents.filter(a => a.id !== agentId) });
    // Tell server to clear this agent's exp and session
    fetch(`/api/kill-agent`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ agentId }),
    }).catch(() => {});
  },
}));

// On app init, sync game mode to server
const gameOn = loadGameMode();
if (gameOn) {
  fetch("/api/game-mode", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ enabled: true }),
  }).catch(() => {});
}
