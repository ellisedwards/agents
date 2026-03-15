import type { PixelRect } from "./clawd";

export const JIGGLYPUFF_WIDTH = 10;
export const JIGGLYPUFF_HEIGHT = 10;

const BODY = "#ffaacc";
const BODY_LT = "#ffbbdd";
const BODY_DK = "#ee99bb";
const EYE = "#4488cc";
const EYE_LT = "#66aadd";
const HAIR = "#ff88aa";
const HAIR_LT = "#ffaacc";
const FOOT = "#ee88aa";

export const JIGGLYPUFF_IDLE: PixelRect[] = [
  // Hair tuft (curled)
  { x: 4, y: 0, w: 2, h: 1, color: HAIR },
  { x: 5, y: 0, w: 1, h: 1, color: HAIR_LT },
  { x: 3, y: 0, w: 1, h: 1, color: HAIR },
  // Round body
  { x: 2, y: 1, w: 6, h: 7, color: BODY },
  { x: 1, y: 2, w: 8, h: 5, color: BODY },
  { x: 3, y: 1, w: 4, h: 5, color: BODY_LT },
  // Eyes (big, round)
  { x: 3, y: 3, w: 1, h: 2, color: EYE },
  { x: 6, y: 3, w: 1, h: 2, color: EYE },
  { x: 3, y: 3, w: 1, h: 1, color: EYE_LT },
  { x: 6, y: 3, w: 1, h: 1, color: EYE_LT },
  // Small mouth
  { x: 4, y: 6, w: 2, h: 1, color: BODY_DK },
  // Ear tufts
  { x: 1, y: 1, w: 1, h: 2, color: BODY_DK },
  { x: 8, y: 1, w: 1, h: 2, color: BODY_DK },
  // Feet
  { x: 3, y: 8, w: 2, h: 1, color: FOOT },
  { x: 6, y: 8, w: 2, h: 1, color: FOOT },
];

export const JIGGLYPUFF_WALK1: PixelRect[] = [
  { x: 4, y: 0, w: 2, h: 1, color: HAIR },
  { x: 5, y: 0, w: 1, h: 1, color: HAIR_LT },
  { x: 3, y: 0, w: 1, h: 1, color: HAIR },
  { x: 2, y: 1, w: 6, h: 7, color: BODY },
  { x: 1, y: 2, w: 8, h: 5, color: BODY },
  { x: 3, y: 1, w: 4, h: 5, color: BODY_LT },
  { x: 3, y: 3, w: 1, h: 2, color: EYE },
  { x: 6, y: 3, w: 1, h: 2, color: EYE },
  { x: 3, y: 3, w: 1, h: 1, color: EYE_LT },
  { x: 6, y: 3, w: 1, h: 1, color: EYE_LT },
  { x: 4, y: 6, w: 2, h: 1, color: BODY_DK },
  { x: 1, y: 1, w: 1, h: 2, color: BODY_DK },
  { x: 8, y: 1, w: 1, h: 2, color: BODY_DK },
  // Left foot forward
  { x: 2, y: 8, w: 2, h: 1, color: FOOT },
  { x: 6, y: 8, w: 2, h: 1, color: FOOT },
];

export const JIGGLYPUFF_WALK2: PixelRect[] = [
  { x: 4, y: 0, w: 2, h: 1, color: HAIR },
  { x: 5, y: 0, w: 1, h: 1, color: HAIR_LT },
  { x: 3, y: 0, w: 1, h: 1, color: HAIR },
  { x: 2, y: 1, w: 6, h: 7, color: BODY },
  { x: 1, y: 2, w: 8, h: 5, color: BODY },
  { x: 3, y: 1, w: 4, h: 5, color: BODY_LT },
  { x: 3, y: 3, w: 1, h: 2, color: EYE },
  { x: 6, y: 3, w: 1, h: 2, color: EYE },
  { x: 3, y: 3, w: 1, h: 1, color: EYE_LT },
  { x: 6, y: 3, w: 1, h: 1, color: EYE_LT },
  { x: 4, y: 6, w: 2, h: 1, color: BODY_DK },
  { x: 1, y: 1, w: 1, h: 2, color: BODY_DK },
  { x: 8, y: 1, w: 1, h: 2, color: BODY_DK },
  // Right foot forward
  { x: 3, y: 8, w: 2, h: 1, color: FOOT },
  { x: 7, y: 8, w: 2, h: 1, color: FOOT },
];

export const JIGGLYPUFF_SLEEP: PixelRect[] = [
  { x: 4, y: 0, w: 2, h: 1, color: HAIR },
  { x: 3, y: 0, w: 1, h: 1, color: HAIR },
  { x: 2, y: 1, w: 6, h: 7, color: BODY },
  { x: 1, y: 2, w: 8, h: 5, color: BODY },
  { x: 3, y: 1, w: 4, h: 5, color: BODY_LT },
  // Closed eyes (—  —)
  { x: 3, y: 4, w: 2, h: 1, color: EYE },
  { x: 6, y: 4, w: 2, h: 1, color: EYE },
  { x: 1, y: 1, w: 1, h: 2, color: BODY_DK },
  { x: 8, y: 1, w: 1, h: 2, color: BODY_DK },
  { x: 3, y: 8, w: 2, h: 1, color: FOOT },
  { x: 6, y: 8, w: 2, h: 1, color: FOOT },
];

export const JIGGLYPUFF_STARTLED: PixelRect[] = [
  // Hair puffed up more
  { x: 4, y: 0, w: 2, h: 1, color: HAIR },
  { x: 3, y: 0, w: 1, h: 1, color: HAIR },
  { x: 6, y: 0, w: 1, h: 1, color: HAIR },
  { x: 2, y: 1, w: 6, h: 7, color: BODY },
  { x: 1, y: 2, w: 8, h: 5, color: BODY },
  { x: 3, y: 1, w: 4, h: 5, color: BODY_LT },
  // Big round shocked eyes
  { x: 2, y: 3, w: 2, h: 2, color: EYE },
  { x: 6, y: 3, w: 2, h: 2, color: EYE },
  { x: 3, y: 3, w: 1, h: 1, color: EYE_LT },
  { x: 7, y: 3, w: 1, h: 1, color: EYE_LT },
  // Open mouth
  { x: 4, y: 6, w: 2, h: 1, color: "#cc4466" },
  { x: 1, y: 1, w: 1, h: 2, color: BODY_DK },
  { x: 8, y: 1, w: 1, h: 2, color: BODY_DK },
  { x: 3, y: 8, w: 2, h: 1, color: FOOT },
  { x: 6, y: 8, w: 2, h: 1, color: FOOT },
];
