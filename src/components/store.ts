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
export type ThemeId = "forest" | "golden-ruins" | "tropical-island" | "lunar-base" | "pallet-town";
export type EditMode = "none" | "background" | "tower-decor" | "lounge" | "posters";

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
    const parsed = JSON.parse(raw);
    if (parsed.size === "obelisk") parsed.size = "monolith";
    if (raw) return { ...defaults, ...parsed };
  } catch {}
  return defaults;
}

function saveTowerPrefs(prefs: TowerPrefs) {
  try {
    localStorage.setItem(TOWER_STORAGE_KEY, JSON.stringify(prefs));
  } catch {}
}

const THEME_STORAGE_KEY = "agent-office-theme";
const VALID_THEMES: ThemeId[] = ["forest", "golden-ruins", "tropical-island", "lunar-base", "pallet-town"];

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
  setAgents: (incoming) => {
    const now = Date.now();
    const prev = get().agents;
    // Build map of incoming agents
    const incomingMap = new Map(incoming.map((a) => [a.id, a]));
    // Merge: use incoming data, but keep recently-seen agents that
    // briefly disappeared (grace period prevents flicker from transient poll gaps)
    const graceMs = 15000;
    const staleMs = 2 * 60 * 1000; // 2 minutes before forcing idle
    const merged: AgentState[] = incoming.map((a) => {
      // If agent hasn't updated in 30s, treat as idle
      if (now - a.lastActivity > staleMs && a.state !== "idle") {
        return { ...a, state: "idle" as const, currentTool: null };
      }
      return a;
    });
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
}));
