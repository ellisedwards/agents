import type { AgentSpriteState } from "@/shared/types";

export interface PixelRect {
  x: number;
  y: number;
  w: number;
  h: number;
  color: string;
}

export const CLAWD_WIDTH = 14;
export const CLAWD_HEIGHT = 13;

const BASE_COLOR = "#c4856c";
const DARK_COLOR = "#b07a60";
const EYE_COLOR = "#2d1a0f";

// Shared body parts
const ears: PixelRect[] = [
  { x: 3, y: 0, w: 2, h: 2, color: BASE_COLOR },
  { x: 9, y: 0, w: 2, h: 2, color: BASE_COLOR },
];
const head: PixelRect[] = [
  { x: 2, y: 2, w: 10, h: 6, color: BASE_COLOR },
];
const armNubs: PixelRect[] = [
  { x: 0, y: 4, w: 2, h: 2, color: BASE_COLOR },
  { x: 12, y: 4, w: 2, h: 2, color: BASE_COLOR },
];
const bottomSection: PixelRect[] = [
  { x: 3, y: 8, w: 8, h: 2, color: DARK_COLOR },
];
const legs: PixelRect[] = [
  { x: 3, y: 10, w: 2, h: 2, color: DARK_COLOR },
  { x: 6, y: 10, w: 1, h: 2, color: DARK_COLOR },
  { x: 7, y: 10, w: 1, h: 2, color: DARK_COLOR },
  { x: 9, y: 10, w: 2, h: 2, color: DARK_COLOR },
];

export const CLAWD_SPRITES: Record<AgentSpriteState, PixelRect[]> = {
  idle: [
    ...ears,
    ...head,
    ...armNubs,
    // Eyes: tall narrow (1x3), widely separated
    { x: 4, y: 3, w: 1, h: 3, color: EYE_COLOR },
    { x: 9, y: 3, w: 1, h: 3, color: EYE_COLOR },
    ...bottomSection,
    ...legs,
  ],
  typing: [
    // Ears flattened
    { x: 2, y: 0, w: 2, h: 1, color: BASE_COLOR },
    { x: 10, y: 0, w: 2, h: 1, color: BASE_COLOR },
    { x: 2, y: 1, w: 10, h: 6, color: BASE_COLOR },
    // >_< eyes
    { x: 4, y: 3, w: 1, h: 1, color: EYE_COLOR },
    { x: 5, y: 4, w: 1, h: 1, color: EYE_COLOR },
    { x: 4, y: 5, w: 1, h: 1, color: EYE_COLOR },
    { x: 9, y: 3, w: 1, h: 1, color: EYE_COLOR },
    { x: 8, y: 4, w: 1, h: 1, color: EYE_COLOR },
    { x: 9, y: 5, w: 1, h: 1, color: EYE_COLOR },
    // Arms forward
    { x: 0, y: 3, w: 2, h: 2, color: BASE_COLOR },
    { x: 12, y: 3, w: 2, h: 2, color: BASE_COLOR },
    // Spread tentacles
    { x: 2, y: 7, w: 2, h: 3, color: BASE_COLOR },
    { x: 5, y: 7, w: 2, h: 2, color: BASE_COLOR },
    { x: 7, y: 7, w: 2, h: 2, color: BASE_COLOR },
    { x: 10, y: 7, w: 2, h: 3, color: BASE_COLOR },
    { x: 2, y: 9, w: 2, h: 2, color: DARK_COLOR },
    { x: 5, y: 8, w: 2, h: 2, color: DARK_COLOR },
    { x: 7, y: 8, w: 2, h: 2, color: DARK_COLOR },
    { x: 10, y: 9, w: 2, h: 2, color: DARK_COLOR },
  ],
  reading: [
    // Ears
    { x: 2, y: 0, w: 2, h: 1, color: BASE_COLOR },
    { x: 10, y: 0, w: 2, h: 1, color: BASE_COLOR },
    { x: 2, y: 1, w: 10, h: 6, color: BASE_COLOR },
    // Half-lidded eyes
    { x: 4, y: 4, w: 2, h: 1, color: EYE_COLOR },
    { x: 8, y: 4, w: 2, h: 1, color: EYE_COLOR },
    // Arms at sides
    { x: 0, y: 4, w: 2, h: 2, color: BASE_COLOR },
    { x: 12, y: 4, w: 2, h: 2, color: BASE_COLOR },
    // Relaxed tentacles
    { x: 3, y: 7, w: 2, h: 2, color: BASE_COLOR },
    { x: 5, y: 7, w: 2, h: 2, color: BASE_COLOR },
    { x: 7, y: 7, w: 2, h: 2, color: BASE_COLOR },
    { x: 9, y: 7, w: 2, h: 2, color: BASE_COLOR },
    { x: 3, y: 8, w: 2, h: 2, color: DARK_COLOR },
    { x: 5, y: 8, w: 2, h: 2, color: DARK_COLOR },
    { x: 7, y: 8, w: 2, h: 2, color: DARK_COLOR },
    { x: 9, y: 8, w: 2, h: 2, color: DARK_COLOR },
  ],
  thinking: [
    // Same as idle but could add a small animation variant later
    ...ears,
    ...head,
    ...armNubs,
    { x: 4, y: 3, w: 1, h: 3, color: EYE_COLOR },
    { x: 9, y: 3, w: 1, h: 3, color: EYE_COLOR },
    ...bottomSection,
    ...legs,
  ],
  waiting: [
    // Ears
    { x: 3, y: 0, w: 2, h: 2, color: BASE_COLOR },
    { x: 9, y: 0, w: 2, h: 2, color: BASE_COLOR },
    { x: 2, y: 2, w: 10, h: 6, color: BASE_COLOR },
    // Wide alarmed eyes (2x3 with glint)
    { x: 4, y: 3, w: 2, h: 3, color: EYE_COLOR },
    { x: 8, y: 3, w: 2, h: 3, color: EYE_COLOR },
    { x: 5, y: 3, w: 1, h: 1, color: BASE_COLOR }, // glint
    { x: 9, y: 3, w: 1, h: 1, color: BASE_COLOR }, // glint
    // One arm normal, one raised
    { x: 0, y: 4, w: 2, h: 2, color: BASE_COLOR },
    { x: 12, y: 3, w: 2, h: 2, color: BASE_COLOR },
    { x: 13, y: 1, w: 2, h: 2, color: DARK_COLOR },
    // Same legs as idle
    ...bottomSection,
    ...legs,
  ],
};
