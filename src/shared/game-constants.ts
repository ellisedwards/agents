// src/shared/game-constants.ts

// --- Leveling Curve ---
const BASE_EXP = 200;
const LEVEL_MULTIPLIER = 1.5;

export function expForLevel(level: number): number {
  let exp = BASE_EXP;
  for (let i = 1; i < level; i++) exp = Math.floor(exp * LEVEL_MULTIPLIER);
  return exp;
}

// --- EXP Awards ---
export const EXP_AWARDS: Record<string, number> = {
  Write: 15, Edit: 15,
  Bash: 10,
  Read: 5, Grep: 5, Glob: 5,
  Agent: 20,
  WebFetch: 8, WebSearch: 8,
  thinking: 3,
};

// --- Bonuses ---
export const BONUS_FIRST_BLOOD = 5;
export const BONUS_STREAK = 10;
export const BONUS_SPEED_COMBO = 5;
export const BONUS_RIVALRY = 2;
export const CRITICAL_HIT_CHANCE = 0.1;
export const SUBAGENT_EXP_SHARE = 0.5;
export const STREAK_DURATION_MS = 5 * 60 * 1000; // 5 minutes
export const STREAK_GAP_MS = 30 * 1000; // 30 seconds max gap
export const SPEED_COMBO_WINDOW_MS = 10 * 1000;
export const SPEED_COMBO_COUNT = 3;
export const TOOL_MASTERY_THRESHOLD = 20;

// --- Level Titles ---
export const LEVEL_TITLES: [number, string][] = [
  [20, "Ascended"],
  [15, "Final Boss"],
  [13, "Archmage"],
  [10, "Gigachad"],
  [8, "Code Wizard"],
  [5, "Journeyman"],
  [3, "Script Kiddie"],
  [1, "Fresh Spawn"],
];

export function getLevelTitle(level: number): string {
  for (const [lv, title] of LEVEL_TITLES) {
    if (level >= lv) return title;
  }
  return "Fresh Spawn";
}

// --- Tool Mastery Titles ---
export const TOOL_MASTERY: Record<string, string> = {
  Bash: "Shell Lord",
  Write: "Ink Slinger",
  Edit: "Ink Slinger",
  Read: "Tome Reader",
  Grep: "Treasure Hunter",
  Glob: "Treasure Hunter",
  Agent: "Summoner",
  WebFetch: "Oracle",
  WebSearch: "Oracle",
};

// --- Agent Name Pool ---
export const AGENT_NAMES = [
  "Ember", "Pixel", "Volt", "Nimbus", "Hex", "Rune",
  "Glyph", "Flux", "Onyx", "Nova", "Byte", "Sage",
  "Drift", "Spark", "Wren", "Echo", "Zephyr", "Ash",
  "Cosmo", "Fable", "Jinx", "Mochi", "Pip", "Quill",
];

// --- Golden Pokeball Thresholds ---
export const GOLD_POKEBALL_LEVEL = 10;
export const FULL_GOLD_POKEBALL_LEVEL = 20;
