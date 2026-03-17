// src/shared/game-constants.ts

// --- Leveling Curve (steeper quadratic, 99 is a real achievement) ---
// Lv1→2: 25, Lv10: 120, Lv30: 500, Lv50: 1300, Lv70: 2500, Lv99: 5000
// Total to 99: ~160k exp. A busy multi-day agent might hit 30-50.
export function expForLevel(level: number): number {
  return Math.floor(20 + level * level * 0.5 + level * 3);
}

// --- EXP Awards ---
export const EXP_AWARDS: Record<string, number> = {
  Write: 8, Edit: 8,
  Bash: 5,
  Read: 3, Grep: 3, Glob: 3,
  Agent: 10,
  WebFetch: 4, WebSearch: 4,
  thinking: 1,
};

// --- Bonuses ---
export const BONUS_FIRST_BLOOD = 3;
export const BONUS_STREAK = 5;
export const BONUS_SPEED_COMBO = 2;
export const BONUS_RIVALRY = 1;
export const CRITICAL_HIT_CHANCE = 0.1;
export const SUBAGENT_EXP_SHARE = 0.5;
export const STREAK_DURATION_MS = 5 * 60 * 1000; // 5 minutes
export const STREAK_GAP_MS = 30 * 1000; // 30 seconds max gap
export const SPEED_COMBO_WINDOW_MS = 10 * 1000;
export const SPEED_COMBO_COUNT = 3;
export const TOOL_MASTERY_THRESHOLD = 50;

// --- Level Titles ---
export const LEVEL_TITLES: [number, string][] = [
  [90, "Legendary"],
  [70, "Ascended"],
  [50, "Grand Master"],
  [40, "Archmage"],
  [30, "Expert"],
  [20, "Veteran"],
  [12, "Journeyman"],
  [5, "Apprentice"],
  [1, "Fresh Spawn"],
];

export function getLevelTitle(level: number): string {
  for (const [lv, title] of LEVEL_TITLES) {
    if (level >= lv) return title;
  }
  return "Fresh Spawn";
}

// --- Tool Mastery Titles (awarded based on most-used tool) ---
export const TOOL_MASTERY: Record<string, string> = {
  Bash: "Shell Lord",
  Write: "Architect",
  Edit: "Refactorer",
  Read: "Scholar",
  Grep: "Seeker",
  Glob: "Explorer",
  Agent: "Summoner",
  WebFetch: "Oracle",
  WebSearch: "Diviner",
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
