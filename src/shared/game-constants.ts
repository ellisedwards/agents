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
export const BONUS_RIVALRY = 3;
export const CRITICAL_HIT_CHANCE = 0.1;
export const LUCKY_BREAK_CHANCE = 0.02;
export const LUCKY_BREAK_MULTIPLIER = 3;
export const SUBAGENT_EXP_SHARE = 0.5;
export const STREAK_DURATION_MS = 5 * 60 * 1000; // 5 minutes
export const STREAK_GAP_MS = 30 * 1000; // 30 seconds max gap
export const SPEED_COMBO_WINDOW_MS = 10 * 1000;
export const SPEED_COMBO_COUNT = 3;
export const TOOL_MASTERY_THRESHOLD = 50;

// --- Level Title Pools (randomly assigned per agent, stable by name hash) ---
const TITLE_POOLS: [number, string[]][] = [
  [90, ["Legendary", "Mythic", "Eternal", "Transcendent", "Apex"]],
  [70, ["Ascended", "Exalted", "Sovereign", "Celestial", "Paragon"]],
  [50, ["Grand Master", "Archmage", "Overlord", "Champion", "Warden"]],
  [40, ["Commander", "Sage", "Vanguard", "Harbinger", "Tactician"]],
  [30, ["Expert", "Adept", "Sentinel", "Ranger", "Artisan"]],
  [20, ["Veteran", "Knight", "Invoker", "Corsair", "Warden"]],
  [12, ["Journeyman", "Scout", "Striker", "Mystic", "Drifter"]],
  [5, ["Apprentice", "Initiate", "Cadet", "Acolyte", "Fledgling"]],
  [1, ["Fresh Spawn", "Rookie", "Hatchling", "Newcomer", "Sprout"]],
];

/** Deterministic hash from agent name → stable title pick */
function nameHash(name: string): number {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = ((h << 5) - h + name.charCodeAt(i)) | 0;
  return Math.abs(h);
}

export function getLevelTitle(level: number, agentName?: string): string {
  for (const [lv, pool] of TITLE_POOLS) {
    if (level >= lv) {
      const idx = agentName ? nameHash(agentName) % pool.length : 0;
      return pool[idx];
    }
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
  // Final Fantasy I–VI
  "Cecil", "Rosa", "Rydia", "Kain", "Edge",
  "Terra", "Locke", "Celes", "Sabin", "Edgar",
  "Bartz", "Lenna", "Faris", "Galuf", "Krile",
  "Firion", "Maria", "Minwu", "Refia", "Luneth",
  // More RPG + original
  "Vivi", "Cyan", "Palom", "Porom", "Nyx",
  "Sora", "Auron", "Flint", "Iris", "Dusk",
  "Lux", "Coda", "Aether", "Thorn", "Vesper",
];

// --- Pokeball Tier Thresholds ---
// Standard (red) → Great (blue, Lv20) → Ultra (black/yellow, Lv30) → Gold top (Lv50) → Full gold (Lv75)
export const GREAT_BALL_LEVEL = 20;
export const ULTRA_BALL_LEVEL = 30;
export const GOLD_BALL_LEVEL = 50;
export const MASTER_BALL_LEVEL = 75;
