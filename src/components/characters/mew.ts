import type { AgentSpriteState } from "@/shared/types";
import type { PixelRect } from "./clawd";

export const MEW_WIDTH = 16;
export const MEW_HEIGHT = 17;

/* ── shared body pixels (rows 1-4, 8-16) ─────────────────────────── */
const body: PixelRect[] = [
  // row 1 – ear tips
  { x: 1, y: 1, w: 1, h: 1, color: "#000000" },
  { x: 2, y: 1, w: 1, h: 1, color: "#000000" },
  { x: 8, y: 1, w: 1, h: 1, color: "#000000" },
  { x: 9, y: 1, w: 1, h: 1, color: "#000000" },
  // row 2
  { x: 1, y: 2, w: 1, h: 1, color: "#4D3F44" },
  { x: 2, y: 2, w: 1, h: 1, color: "#FFCADF" },
  { x: 3, y: 2, w: 1, h: 1, color: "#A2818C" },
  { x: 4, y: 2, w: 1, h: 1, color: "#4D3F44" },
  { x: 5, y: 2, w: 1, h: 1, color: "#4D3F44" },
  { x: 6, y: 2, w: 1, h: 1, color: "#4D3F44" },
  { x: 7, y: 2, w: 1, h: 1, color: "#FFCADF" },
  { x: 8, y: 2, w: 1, h: 1, color: "#FFCADF" },
  { x: 9, y: 2, w: 1, h: 1, color: "#000000" },
  // row 3
  { x: 1, y: 3, w: 1, h: 1, color: "#4D3F44" },
  { x: 2, y: 3, w: 1, h: 1, color: "#FFCADF" },
  { x: 3, y: 3, w: 1, h: 1, color: "#FFCADF" },
  { x: 4, y: 3, w: 1, h: 1, color: "#FFCADF" },
  { x: 5, y: 3, w: 1, h: 1, color: "#FFCADF" },
  { x: 6, y: 3, w: 1, h: 1, color: "#FFCADF" },
  { x: 7, y: 3, w: 1, h: 1, color: "#FFCADF" },
  { x: 8, y: 3, w: 1, h: 1, color: "#FFCADF" },
  { x: 9, y: 3, w: 1, h: 1, color: "#A2818C" },
  // row 4
  { x: 0, y: 4, w: 1, h: 1, color: "#000000" },
  { x: 1, y: 4, w: 1, h: 1, color: "#FFCADF" },
  { x: 2, y: 4, w: 1, h: 1, color: "#FFCADF" },
  { x: 3, y: 4, w: 1, h: 1, color: "#FFCADF" },
  { x: 4, y: 4, w: 1, h: 1, color: "#FFCADF" },
  { x: 5, y: 4, w: 1, h: 1, color: "#FFCADF" },
  { x: 6, y: 4, w: 1, h: 1, color: "#FFCADF" },
  { x: 7, y: 4, w: 1, h: 1, color: "#FFCADF" },
  { x: 8, y: 4, w: 1, h: 1, color: "#4D3F44" },
  { x: 11, y: 4, w: 1, h: 1, color: "#4D3F44" },
  { x: 12, y: 4, w: 1, h: 1, color: "#A2818C" },
  // row 8
  { x: 2, y: 8, w: 1, h: 1, color: "#A2818C" },
  { x: 3, y: 8, w: 1, h: 1, color: "#FFCADF" },
  { x: 4, y: 8, w: 1, h: 1, color: "#FFCADF" },
  { x: 5, y: 8, w: 1, h: 1, color: "#FFCADF" },
  { x: 6, y: 8, w: 1, h: 1, color: "#A2818C" },
  { x: 7, y: 8, w: 1, h: 1, color: "#4D3F44" },
  { x: 10, y: 8, w: 1, h: 1, color: "#4D3F44" },
  { x: 11, y: 8, w: 1, h: 1, color: "#FFCADF" },
  { x: 13, y: 8, w: 1, h: 1, color: "#4D3F44" },
  { x: 14, y: 8, w: 1, h: 1, color: "#FFCADF" },
  // row 9
  { x: 1, y: 9, w: 1, h: 1, color: "#000000" },
  { x: 2, y: 9, w: 1, h: 1, color: "#FFCADF" },
  { x: 3, y: 9, w: 1, h: 1, color: "#4D3F44" },
  { x: 4, y: 9, w: 1, h: 1, color: "#4D3F44" },
  { x: 5, y: 9, w: 1, h: 1, color: "#A2818C" },
  { x: 6, y: 9, w: 1, h: 1, color: "#FFCADF" },
  { x: 7, y: 9, w: 1, h: 1, color: "#000000" },
  { x: 10, y: 9, w: 1, h: 1, color: "#4D3F44" },
  { x: 11, y: 9, w: 1, h: 1, color: "#FFCADF" },
  { x: 13, y: 9, w: 1, h: 1, color: "#4D3F44" },
  { x: 14, y: 9, w: 1, h: 1, color: "#FFCADF" },
  // row 10
  { x: 0, y: 10, w: 1, h: 1, color: "#000000" },
  { x: 1, y: 10, w: 1, h: 1, color: "#FFCADF" },
  { x: 2, y: 10, w: 1, h: 1, color: "#A2818C" },
  { x: 3, y: 10, w: 1, h: 1, color: "#FFCADF" },
  { x: 4, y: 10, w: 1, h: 1, color: "#FFCADF" },
  { x: 5, y: 10, w: 1, h: 1, color: "#FFCADF" },
  { x: 6, y: 10, w: 1, h: 1, color: "#FFCADF" },
  { x: 7, y: 10, w: 1, h: 1, color: "#FFCADF" },
  { x: 8, y: 10, w: 1, h: 1, color: "#4D3F44" },
  { x: 9, y: 10, w: 1, h: 1, color: "#000000" },
  { x: 10, y: 10, w: 1, h: 1, color: "#FFCADF" },
  { x: 11, y: 10, w: 1, h: 1, color: "#FFCADF" },
  { x: 13, y: 10, w: 1, h: 1, color: "#4D3F44" },
  { x: 14, y: 10, w: 1, h: 1, color: "#FFCADF" },
  // row 11
  { x: 0, y: 11, w: 1, h: 1, color: "#000000" },
  { x: 1, y: 11, w: 1, h: 1, color: "#A2818C" },
  { x: 2, y: 11, w: 1, h: 1, color: "#FFCADF" },
  { x: 3, y: 11, w: 1, h: 1, color: "#FFCADF" },
  { x: 4, y: 11, w: 1, h: 1, color: "#FFCADF" },
  { x: 5, y: 11, w: 1, h: 1, color: "#FFCADF" },
  { x: 6, y: 11, w: 1, h: 1, color: "#000000" },
  { x: 7, y: 11, w: 1, h: 1, color: "#FFCADF" },
  { x: 8, y: 11, w: 1, h: 1, color: "#4D3F44" },
  { x: 9, y: 11, w: 1, h: 1, color: "#FFCADF" },
  { x: 10, y: 11, w: 1, h: 1, color: "#FFCADF" },
  { x: 13, y: 11, w: 1, h: 1, color: "#4D3F44" },
  { x: 14, y: 11, w: 1, h: 1, color: "#FFCADF" },
  // row 12
  { x: 1, y: 12, w: 1, h: 1, color: "#4D3F44" },
  { x: 2, y: 12, w: 1, h: 1, color: "#FFCADF" },
  { x: 3, y: 12, w: 1, h: 1, color: "#FFCADF" },
  { x: 4, y: 12, w: 1, h: 1, color: "#FFCADF" },
  { x: 5, y: 12, w: 1, h: 1, color: "#FFCADF" },
  { x: 6, y: 12, w: 1, h: 1, color: "#FFCADF" },
  { x: 7, y: 12, w: 1, h: 1, color: "#A2818C" },
  { x: 8, y: 12, w: 1, h: 1, color: "#000000" },
  { x: 9, y: 12, w: 1, h: 1, color: "#FFCADF" },
  { x: 10, y: 12, w: 1, h: 1, color: "#A2818C" },
  { x: 12, y: 12, w: 1, h: 1, color: "#4D3F44" },
  { x: 13, y: 12, w: 1, h: 1, color: "#FFCADF" },
  { x: 14, y: 12, w: 1, h: 1, color: "#A2818C" },
  // row 13
  { x: 0, y: 13, w: 1, h: 1, color: "#4D3F44" },
  { x: 1, y: 13, w: 1, h: 1, color: "#FFCADF" },
  { x: 2, y: 13, w: 1, h: 1, color: "#FFCADF" },
  { x: 3, y: 13, w: 1, h: 1, color: "#FFCADF" },
  { x: 4, y: 13, w: 1, h: 1, color: "#4D3F44" },
  { x: 5, y: 13, w: 1, h: 1, color: "#4D3F44" },
  { x: 6, y: 13, w: 1, h: 1, color: "#FFCADF" },
  { x: 7, y: 13, w: 1, h: 1, color: "#FFCADF" },
  { x: 8, y: 13, w: 1, h: 1, color: "#FFCADF" },
  { x: 9, y: 13, w: 1, h: 1, color: "#A2818C" },
  { x: 12, y: 13, w: 1, h: 1, color: "#4D3F44" },
  { x: 13, y: 13, w: 1, h: 1, color: "#FFCADF" },
  // row 14
  { x: 0, y: 14, w: 1, h: 1, color: "#A2818C" },
  { x: 1, y: 14, w: 1, h: 1, color: "#FFCADF" },
  { x: 2, y: 14, w: 1, h: 1, color: "#FFCADF" },
  { x: 3, y: 14, w: 1, h: 1, color: "#A2818C" },
  { x: 6, y: 14, w: 1, h: 1, color: "#4D3F44" },
  { x: 7, y: 14, w: 1, h: 1, color: "#FFCADF" },
  { x: 8, y: 14, w: 1, h: 1, color: "#FFCADF" },
  { x: 11, y: 14, w: 1, h: 1, color: "#A2818C" },
  { x: 12, y: 14, w: 1, h: 1, color: "#FFCADF" },
  { x: 13, y: 14, w: 1, h: 1, color: "#000000" },
  // row 15
  { x: 1, y: 15, w: 1, h: 1, color: "#A2818C" },
  { x: 2, y: 15, w: 1, h: 1, color: "#FFCADF" },
  { x: 3, y: 15, w: 1, h: 1, color: "#A2818C" },
  { x: 6, y: 15, w: 1, h: 1, color: "#000000" },
  { x: 7, y: 15, w: 1, h: 1, color: "#FFCADF" },
  { x: 8, y: 15, w: 1, h: 1, color: "#A2818C" },
  { x: 11, y: 15, w: 1, h: 1, color: "#000000" },
  { x: 12, y: 15, w: 1, h: 1, color: "#000000" },
  // row 16
  { x: 1, y: 16, w: 1, h: 1, color: "#000000" },
  { x: 2, y: 16, w: 1, h: 1, color: "#000000" },
  { x: 7, y: 16, w: 1, h: 1, color: "#000000" },
  { x: 8, y: 16, w: 1, h: 1, color: "#000000" },
];

/* ── eye variants (rows 5-7) ─────────────────────────────────────── */

/** open eyes with white highlights */
const eyesOpen: PixelRect[] = [
  // row 5
  { x: 0, y: 5, w: 1, h: 1, color: "#A2818C" },
  { x: 1, y: 5, w: 1, h: 1, color: "#000000" },
  { x: 2, y: 5, w: 1, h: 1, color: "#FFCADF" },
  { x: 3, y: 5, w: 1, h: 1, color: "#FFCADF" },
  { x: 4, y: 5, w: 1, h: 1, color: "#FFCADF" },
  { x: 5, y: 5, w: 1, h: 1, color: "#FFCADF" },
  { x: 6, y: 5, w: 1, h: 1, color: "#000000" },
  { x: 7, y: 5, w: 1, h: 1, color: "#FFCADF" },
  { x: 8, y: 5, w: 1, h: 1, color: "#A2818C" },
  { x: 10, y: 5, w: 1, h: 1, color: "#4D3F44" },
  { x: 11, y: 5, w: 1, h: 1, color: "#FFCADF" },
  { x: 12, y: 5, w: 1, h: 1, color: "#FFCADF" },
  { x: 13, y: 5, w: 1, h: 1, color: "#A2818C" },
  // row 6
  { x: 0, y: 6, w: 1, h: 1, color: "#4D3F44" },
  { x: 1, y: 6, w: 1, h: 1, color: "#FFFFFF" },
  { x: 2, y: 6, w: 1, h: 1, color: "#000000" },
  { x: 3, y: 6, w: 1, h: 1, color: "#FFCADF" },
  { x: 4, y: 6, w: 1, h: 1, color: "#FFCADF" },
  { x: 5, y: 6, w: 1, h: 1, color: "#000000" },
  { x: 6, y: 6, w: 1, h: 1, color: "#FFFFFF" },
  { x: 7, y: 6, w: 1, h: 1, color: "#000000" },
  { x: 8, y: 6, w: 1, h: 1, color: "#A2818C" },
  { x: 9, y: 6, w: 1, h: 1, color: "#4D3F44" },
  { x: 10, y: 6, w: 1, h: 1, color: "#FFCADF" },
  { x: 11, y: 6, w: 1, h: 1, color: "#4D3F44" },
  { x: 12, y: 6, w: 1, h: 1, color: "#A2818C" },
  { x: 13, y: 6, w: 1, h: 1, color: "#FFCADF" },
  // row 7
  { x: 1, y: 7, w: 1, h: 1, color: "#D1A5B7" },
  { x: 2, y: 7, w: 1, h: 1, color: "#FFFFFF" },
  { x: 3, y: 7, w: 1, h: 1, color: "#FFCADF" },
  { x: 4, y: 7, w: 1, h: 1, color: "#FFCADF" },
  { x: 5, y: 7, w: 1, h: 1, color: "#FFFFFF" },
  { x: 6, y: 7, w: 1, h: 1, color: "#FFFFFF" },
  { x: 7, y: 7, w: 1, h: 1, color: "#FFCADF" },
  { x: 8, y: 7, w: 1, h: 1, color: "#A2818C" },
  { x: 9, y: 7, w: 1, h: 1, color: "#4D3F44" },
  { x: 10, y: 7, w: 1, h: 1, color: "#FFCADF" },
  { x: 12, y: 7, w: 1, h: 1, color: "#4D3F44" },
  { x: 13, y: 7, w: 1, h: 1, color: "#FFCADF" },
  { x: 14, y: 7, w: 1, h: 1, color: "#A2818C" },
];

/** closed eyes – flat line */
const eyesClosed: PixelRect[] = [
  // row 5
  { x: 0, y: 5, w: 1, h: 1, color: "#A2818C" },
  { x: 1, y: 5, w: 1, h: 1, color: "#FFCADF" },
  { x: 2, y: 5, w: 1, h: 1, color: "#FFCADF" },
  { x: 3, y: 5, w: 1, h: 1, color: "#FFCADF" },
  { x: 4, y: 5, w: 1, h: 1, color: "#FFCADF" },
  { x: 5, y: 5, w: 1, h: 1, color: "#FFCADF" },
  { x: 6, y: 5, w: 1, h: 1, color: "#FFCADF" },
  { x: 7, y: 5, w: 1, h: 1, color: "#FFCADF" },
  { x: 8, y: 5, w: 1, h: 1, color: "#A2818C" },
  { x: 10, y: 5, w: 1, h: 1, color: "#4D3F44" },
  { x: 11, y: 5, w: 1, h: 1, color: "#FFCADF" },
  { x: 12, y: 5, w: 1, h: 1, color: "#FFCADF" },
  { x: 13, y: 5, w: 1, h: 1, color: "#A2818C" },
  // row 6
  { x: 0, y: 6, w: 1, h: 1, color: "#4D3F44" },
  { x: 1, y: 6, w: 1, h: 1, color: "#000000" },
  { x: 2, y: 6, w: 1, h: 1, color: "#000000" },
  { x: 3, y: 6, w: 1, h: 1, color: "#FFCADF" },
  { x: 4, y: 6, w: 1, h: 1, color: "#FFCADF" },
  { x: 5, y: 6, w: 1, h: 1, color: "#000000" },
  { x: 6, y: 6, w: 1, h: 1, color: "#000000" },
  { x: 7, y: 6, w: 1, h: 1, color: "#000000" },
  { x: 8, y: 6, w: 1, h: 1, color: "#A2818C" },
  { x: 9, y: 6, w: 1, h: 1, color: "#4D3F44" },
  { x: 10, y: 6, w: 1, h: 1, color: "#FFCADF" },
  { x: 11, y: 6, w: 1, h: 1, color: "#4D3F44" },
  { x: 12, y: 6, w: 1, h: 1, color: "#A2818C" },
  { x: 13, y: 6, w: 1, h: 1, color: "#FFCADF" },
  // row 7
  { x: 1, y: 7, w: 1, h: 1, color: "#D1A5B7" },
  { x: 2, y: 7, w: 1, h: 1, color: "#FFCADF" },
  { x: 3, y: 7, w: 1, h: 1, color: "#FFCADF" },
  { x: 4, y: 7, w: 1, h: 1, color: "#FFCADF" },
  { x: 5, y: 7, w: 1, h: 1, color: "#FFCADF" },
  { x: 6, y: 7, w: 1, h: 1, color: "#FFCADF" },
  { x: 7, y: 7, w: 1, h: 1, color: "#FFCADF" },
  { x: 8, y: 7, w: 1, h: 1, color: "#A2818C" },
  { x: 9, y: 7, w: 1, h: 1, color: "#4D3F44" },
  { x: 10, y: 7, w: 1, h: 1, color: "#FFCADF" },
  { x: 12, y: 7, w: 1, h: 1, color: "#4D3F44" },
  { x: 13, y: 7, w: 1, h: 1, color: "#FFCADF" },
  { x: 14, y: 7, w: 1, h: 1, color: "#A2818C" },
];

/** half-lidded eyes */
const eyesHalf: PixelRect[] = [
  // row 5
  { x: 0, y: 5, w: 1, h: 1, color: "#A2818C" },
  { x: 1, y: 5, w: 1, h: 1, color: "#000000" },
  { x: 2, y: 5, w: 1, h: 1, color: "#000000" },
  { x: 3, y: 5, w: 1, h: 1, color: "#FFCADF" },
  { x: 4, y: 5, w: 1, h: 1, color: "#FFCADF" },
  { x: 5, y: 5, w: 1, h: 1, color: "#000000" },
  { x: 6, y: 5, w: 1, h: 1, color: "#000000" },
  { x: 7, y: 5, w: 1, h: 1, color: "#4D3F44" },
  { x: 8, y: 5, w: 1, h: 1, color: "#A2818C" },
  { x: 10, y: 5, w: 1, h: 1, color: "#4D3F44" },
  { x: 11, y: 5, w: 1, h: 1, color: "#FFCADF" },
  { x: 12, y: 5, w: 1, h: 1, color: "#FFCADF" },
  { x: 13, y: 5, w: 1, h: 1, color: "#A2818C" },
  // row 6
  { x: 0, y: 6, w: 1, h: 1, color: "#4D3F44" },
  { x: 1, y: 6, w: 1, h: 1, color: "#FFCADF" },
  { x: 2, y: 6, w: 1, h: 1, color: "#FFCADF" },
  { x: 3, y: 6, w: 1, h: 1, color: "#FFCADF" },
  { x: 4, y: 6, w: 1, h: 1, color: "#FFCADF" },
  { x: 5, y: 6, w: 1, h: 1, color: "#FFCADF" },
  { x: 6, y: 6, w: 1, h: 1, color: "#FFCADF" },
  { x: 7, y: 6, w: 1, h: 1, color: "#FFCADF" },
  { x: 8, y: 6, w: 1, h: 1, color: "#A2818C" },
  { x: 9, y: 6, w: 1, h: 1, color: "#4D3F44" },
  { x: 10, y: 6, w: 1, h: 1, color: "#FFCADF" },
  { x: 11, y: 6, w: 1, h: 1, color: "#4D3F44" },
  { x: 12, y: 6, w: 1, h: 1, color: "#A2818C" },
  { x: 13, y: 6, w: 1, h: 1, color: "#FFCADF" },
  // row 7
  { x: 1, y: 7, w: 1, h: 1, color: "#D1A5B7" },
  { x: 2, y: 7, w: 1, h: 1, color: "#FFCADF" },
  { x: 3, y: 7, w: 1, h: 1, color: "#FFCADF" },
  { x: 4, y: 7, w: 1, h: 1, color: "#FFCADF" },
  { x: 5, y: 7, w: 1, h: 1, color: "#FFCADF" },
  { x: 6, y: 7, w: 1, h: 1, color: "#FFCADF" },
  { x: 7, y: 7, w: 1, h: 1, color: "#FFCADF" },
  { x: 8, y: 7, w: 1, h: 1, color: "#A2818C" },
  { x: 9, y: 7, w: 1, h: 1, color: "#4D3F44" },
  { x: 10, y: 7, w: 1, h: 1, color: "#FFCADF" },
  { x: 12, y: 7, w: 1, h: 1, color: "#4D3F44" },
  { x: 13, y: 7, w: 1, h: 1, color: "#FFCADF" },
  { x: 14, y: 7, w: 1, h: 1, color: "#A2818C" },
];

/* ── compose frames ──────────────────────────────────────────────── */
const idle: PixelRect[] = [...body, ...eyesOpen];
const typing: PixelRect[] = [...body, ...eyesClosed];
const reading: PixelRect[] = [...body, ...eyesHalf];
const thinking: PixelRect[] = idle;
const waiting: PixelRect[] = idle;
const walk1: PixelRect[] = [...body, ...eyesClosed];
const walk2: PixelRect[] = [...body, ...eyesHalf];
const sleep: PixelRect[] = [...body, ...eyesClosed];

export const MEW_WALK1 = walk1;
export const MEW_WALK2 = walk2;
export const MEW_SLEEP = sleep;

export const MEW_SPRITES: Record<AgentSpriteState, PixelRect[]> = {
  idle, typing, reading, thinking, waiting,
};
