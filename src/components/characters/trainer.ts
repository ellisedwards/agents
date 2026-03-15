import type { AgentSpriteState } from "@/shared/types";
import type { PixelRect } from "./clawd";

export const TRAINER_WIDTH = 14;
export const TRAINER_HEIGHT = 14;

// Pixel-matched to GBA Red/Ash front-facing overworld sprite
const O = "#222222";   // outline/black
const CAP = "#cc2222"; // red cap
const CAP_HI = "#dd4444";
const WHITE = "#eeeeee";
const HAIR = "#1a1a1a";
const SKIN = "#ddb888";
const SKIN_DK = "#cc9968";
const EYE = "#222244";
const BLUE = "#3355aa";
const BLUE_LT = "#4466bb";
const GREEN = "#44aa66";
const PANTS = "#334466";
const SHOE = "#333333";

const body: PixelRect[] = [
  // === CAP (huge, round, dominant) ===
  // Top dome
  { x: 4, y: 0, w: 6, h: 1, color: CAP },
  { x: 3, y: 1, w: 8, h: 1, color: CAP },
  { x: 2, y: 2, w: 10, h: 2, color: CAP },
  // Cap highlight
  { x: 5, y: 1, w: 4, h: 1, color: CAP_HI },
  // White band across front
  { x: 4, y: 3, w: 6, h: 1, color: WHITE },
  // Brim (wide, dark)
  { x: 1, y: 4, w: 12, h: 1, color: CAP },
  // Outline around cap
  { x: 3, y: 0, w: 1, h: 1, color: O },
  { x: 10, y: 0, w: 1, h: 1, color: O },
  { x: 1, y: 2, w: 1, h: 2, color: O },
  { x: 12, y: 2, w: 1, h: 2, color: O },

  // === HAIR (spikes out sides under cap) ===
  { x: 0, y: 4, w: 2, h: 2, color: HAIR },
  { x: 12, y: 4, w: 2, h: 2, color: HAIR },
  { x: 1, y: 6, w: 1, h: 1, color: HAIR },
  { x: 12, y: 6, w: 1, h: 1, color: HAIR },

  // === FACE (tiny, under brim) ===
  { x: 3, y: 5, w: 8, h: 2, color: SKIN },
  { x: 4, y: 5, w: 6, h: 2, color: SKIN },
  // Eyes (small dots)
  { x: 5, y: 5, w: 1, h: 1, color: EYE },
  { x: 8, y: 5, w: 1, h: 1, color: EYE },

  // === BODY (small blue jacket + green undershirt) ===
  { x: 3, y: 7, w: 8, h: 1, color: BLUE },
  { x: 4, y: 8, w: 6, h: 2, color: BLUE },
  { x: 5, y: 7, w: 4, h: 1, color: GREEN },
  { x: 5, y: 8, w: 4, h: 1, color: BLUE_LT },
  // Arms
  { x: 2, y: 7, w: 2, h: 2, color: BLUE },
  { x: 10, y: 7, w: 2, h: 2, color: BLUE },
  // Hands
  { x: 2, y: 9, w: 1, h: 1, color: SKIN_DK },
  { x: 11, y: 9, w: 1, h: 1, color: SKIN_DK },

  // === PANTS ===
  { x: 4, y: 10, w: 6, h: 1, color: PANTS },

  // === SHOES ===
  { x: 4, y: 11, w: 2, h: 1, color: SHOE },
  { x: 8, y: 11, w: 2, h: 1, color: SHOE },
];

const typingBody: PixelRect[] = [
  // Cap (same)
  { x: 4, y: 0, w: 6, h: 1, color: CAP },
  { x: 3, y: 1, w: 8, h: 1, color: CAP },
  { x: 2, y: 2, w: 10, h: 2, color: CAP },
  { x: 5, y: 1, w: 4, h: 1, color: CAP_HI },
  { x: 4, y: 3, w: 6, h: 1, color: WHITE },
  { x: 1, y: 4, w: 12, h: 1, color: CAP },
  { x: 3, y: 0, w: 1, h: 1, color: O },
  { x: 10, y: 0, w: 1, h: 1, color: O },
  { x: 1, y: 2, w: 1, h: 2, color: O },
  { x: 12, y: 2, w: 1, h: 2, color: O },
  { x: 0, y: 4, w: 2, h: 2, color: HAIR },
  { x: 12, y: 4, w: 2, h: 2, color: HAIR },
  // Face — squinted
  { x: 3, y: 5, w: 8, h: 2, color: SKIN },
  { x: 5, y: 6, w: 2, h: 1, color: EYE },
  { x: 7, y: 6, w: 2, h: 1, color: EYE },
  // Body — arms forward
  { x: 3, y: 7, w: 8, h: 1, color: BLUE },
  { x: 4, y: 8, w: 6, h: 2, color: BLUE },
  { x: 5, y: 7, w: 4, h: 1, color: GREEN },
  { x: 1, y: 7, w: 2, h: 2, color: BLUE },
  { x: 11, y: 7, w: 2, h: 2, color: BLUE },
  { x: 0, y: 8, w: 1, h: 1, color: SKIN_DK },
  { x: 13, y: 8, w: 1, h: 1, color: SKIN_DK },
  { x: 4, y: 10, w: 6, h: 1, color: PANTS },
  { x: 4, y: 11, w: 2, h: 1, color: SHOE },
  { x: 8, y: 11, w: 2, h: 1, color: SHOE },
];

export const TRAINER_SPRITES: Record<AgentSpriteState, PixelRect[]> = {
  idle: body,
  typing: typingBody,
  reading: body,
  thinking: body,
  waiting: [
    // Cap
    { x: 4, y: 0, w: 6, h: 1, color: CAP },
    { x: 3, y: 1, w: 8, h: 1, color: CAP },
    { x: 2, y: 2, w: 10, h: 2, color: CAP },
    { x: 5, y: 1, w: 4, h: 1, color: CAP_HI },
    { x: 4, y: 3, w: 6, h: 1, color: WHITE },
    { x: 1, y: 4, w: 12, h: 1, color: CAP },
    { x: 3, y: 0, w: 1, h: 1, color: O },
    { x: 10, y: 0, w: 1, h: 1, color: O },
    { x: 1, y: 2, w: 1, h: 2, color: O },
    { x: 12, y: 2, w: 1, h: 2, color: O },
    { x: 0, y: 4, w: 2, h: 2, color: HAIR },
    { x: 12, y: 4, w: 2, h: 2, color: HAIR },
    { x: 1, y: 6, w: 1, h: 1, color: HAIR },
    { x: 12, y: 6, w: 1, h: 1, color: HAIR },
    // Face — surprised
    { x: 3, y: 5, w: 8, h: 2, color: SKIN },
    { x: 5, y: 5, w: 2, h: 1, color: EYE },
    { x: 7, y: 5, w: 2, h: 1, color: EYE },
    { x: 6, y: 5, w: 1, h: 1, color: "#ffffff" },
    { x: 8, y: 5, w: 1, h: 1, color: "#ffffff" },
    // Body
    { x: 3, y: 7, w: 8, h: 1, color: BLUE },
    { x: 4, y: 8, w: 6, h: 2, color: BLUE },
    { x: 5, y: 7, w: 4, h: 1, color: GREEN },
    { x: 2, y: 7, w: 2, h: 2, color: BLUE },
    { x: 10, y: 7, w: 2, h: 2, color: BLUE },
    // Arm raised
    { x: 11, y: 5, w: 1, h: 2, color: BLUE },
    { x: 12, y: 4, w: 1, h: 2, color: BLUE },
    { x: 4, y: 10, w: 6, h: 1, color: PANTS },
    { x: 4, y: 11, w: 2, h: 1, color: SHOE },
    { x: 8, y: 11, w: 2, h: 1, color: SHOE },
  ],
};
