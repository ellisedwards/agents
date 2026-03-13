import { create } from "zustand";
import type { AgentState } from "@/shared/types";

export interface MonitorStatus {
  id: number;
  name: string;
  up: boolean;
  ping: number | null;
}

export type TimeMode = "auto" | "day" | "dawn" | "night";
export type TowerSize = "small" | "medium" | "large";

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
    if (raw) return { ...defaults, ...JSON.parse(raw) };
  } catch {}
  return defaults;
}

function saveTowerPrefs(prefs: TowerPrefs) {
  try {
    localStorage.setItem(TOWER_STORAGE_KEY, JSON.stringify(prefs));
  } catch {}
}

interface AgentOfficeStore {
  agents: AgentState[];
  selectedAgentId: string | null;
  connectionStatus: "connecting" | "connected" | "disconnected";
  monitors: MonitorStatus[];
  monitorsLoaded: boolean;
  labelsOn: boolean;
  timeMode: TimeMode;
  towerSize: TowerSize;
  towerVisible: boolean;
  towerPos: { x: number; y: number };
  towerOpacity: number;
  setAgents: (agents: AgentState[]) => void;
  selectAgent: (id: string | null) => void;
  setConnectionStatus: (status: AgentOfficeStore["connectionStatus"]) => void;
  setMonitors: (monitors: MonitorStatus[]) => void;
  setLabelsOn: (on: boolean) => void;
  setTimeMode: (mode: TimeMode) => void;
  setTowerSize: (size: TowerSize) => void;
  setTowerVisible: (visible: boolean) => void;
  setTowerPos: (pos: { x: number; y: number }) => void;
  setTowerOpacity: (opacity: number) => void;
}

const initialTower = loadTowerPrefs();

export const useAgentOfficeStore = create<AgentOfficeStore>((set, get) => ({
  agents: [],
  selectedAgentId: null,
  connectionStatus: "connecting",
  monitors: [],
  monitorsLoaded: false,
  labelsOn: false,
  timeMode: "auto",
  towerSize: initialTower.size,
  towerVisible: initialTower.visible,
  towerPos: { x: initialTower.x, y: initialTower.y },
  towerOpacity: initialTower.opacity,
  setAgents: (agents) => set({ agents }),
  selectAgent: (id) => set({ selectedAgentId: id }),
  setConnectionStatus: (connectionStatus) => set({ connectionStatus }),
  setMonitors: (monitors) => set({ monitors, monitorsLoaded: true }),
  setLabelsOn: (labelsOn) => set({ labelsOn }),
  setTimeMode: (timeMode) => set({ timeMode }),
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
}));
