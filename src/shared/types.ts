export type AgentSource = "cc" | "openclaw";

export type AgentActivityState =
  | "idle"
  | "typing"
  | "reading"
  | "thinking"
  | "waiting"
  | "lounging"
  | "departing";

/** States that have visual sprites — excludes meta-states like departing/lounging */
export type AgentSpriteState = Exclude<AgentActivityState, "departing" | "lounging">;

export type MageColorIndex = 0 | 1 | 2 | 3 | 4 | 5;

/** Hex colors matching mage robe colors, indexed by MageColorIndex */
export const TEAM_COLORS: string[] = [
  "#4466dd", // Blue
  "#dd4444", // Red
  "#9955bb", // Purple
  "#dd8833", // Orange
  "#bbbb44", // Gold
  "#449999", // Teal
];

export interface AgentState {
  id: string;
  source: AgentSource;
  state: AgentActivityState;
  currentTool: string | null;
  name: string;
  parentId: string | null;
  subagentClass: MageColorIndex | null;
  teamColor: MageColorIndex;
  lastActivity: number;
  // Game mode fields (only present when game mode ON)
  exp?: number;
  level?: number;
  expToNext?: number;
  streak?: boolean;
  title?: string;
  gameName?: string;
  toolMasteries?: string[];
  achievements?: string[];
  luckyMultiplier?: { multiplier: number; usesLeft: number };
  stateVersion?: number;
}
