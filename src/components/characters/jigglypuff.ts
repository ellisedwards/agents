import type { PixelRect } from "./clawd";

export const JIGGLYPUFF_WIDTH = 8;
export const JIGGLYPUFF_HEIGHT = 8;

const BODY = "#ffaacc";
const BODY_LT = "#ffbbdd";
const EYE = "#4488cc";
const EYE_LT = "#66aadd";
const HAIR = "#ff88aa";
const FOOT = "#ee99bb";

export const JIGGLYPUFF_IDLE: PixelRect[] = [
  // Hair tuft
  { x: 3, y: 0, w: 2, h: 1, color: HAIR },
  { x: 4, y: 0, w: 1, h: 1, color: BODY_LT },
  // Round body
  { x: 2, y: 1, w: 4, h: 5, color: BODY },
  { x: 1, y: 2, w: 6, h: 3, color: BODY },
  { x: 3, y: 1, w: 2, h: 4, color: BODY_LT },
  // Eyes
  { x: 2, y: 3, w: 1, h: 1, color: EYE },
  { x: 5, y: 3, w: 1, h: 1, color: EYE },
  { x: 2, y: 3, w: 1, h: 1, color: EYE_LT },
  // Feet
  { x: 2, y: 6, w: 1, h: 1, color: FOOT },
  { x: 5, y: 6, w: 1, h: 1, color: FOOT },
];

export const JIGGLYPUFF_WALK1: PixelRect[] = [
  { x: 3, y: 0, w: 2, h: 1, color: HAIR },
  { x: 4, y: 0, w: 1, h: 1, color: BODY_LT },
  { x: 2, y: 1, w: 4, h: 5, color: BODY },
  { x: 1, y: 2, w: 6, h: 3, color: BODY },
  { x: 3, y: 1, w: 2, h: 4, color: BODY_LT },
  { x: 2, y: 3, w: 1, h: 1, color: EYE },
  { x: 5, y: 3, w: 1, h: 1, color: EYE },
  // Left foot forward
  { x: 1, y: 6, w: 1, h: 1, color: FOOT },
  { x: 5, y: 6, w: 1, h: 1, color: FOOT },
];

export const JIGGLYPUFF_WALK2: PixelRect[] = [
  { x: 3, y: 0, w: 2, h: 1, color: HAIR },
  { x: 4, y: 0, w: 1, h: 1, color: BODY_LT },
  { x: 2, y: 1, w: 4, h: 5, color: BODY },
  { x: 1, y: 2, w: 6, h: 3, color: BODY },
  { x: 3, y: 1, w: 2, h: 4, color: BODY_LT },
  { x: 2, y: 3, w: 1, h: 1, color: EYE },
  { x: 5, y: 3, w: 1, h: 1, color: EYE },
  // Right foot forward
  { x: 2, y: 6, w: 1, h: 1, color: FOOT },
  { x: 6, y: 6, w: 1, h: 1, color: FOOT },
];

export const JIGGLYPUFF_SLEEP: PixelRect[] = [
  { x: 3, y: 0, w: 2, h: 1, color: HAIR },
  { x: 2, y: 1, w: 4, h: 5, color: BODY },
  { x: 1, y: 2, w: 6, h: 3, color: BODY },
  { x: 3, y: 1, w: 2, h: 4, color: BODY_LT },
  // Closed eyes (horizontal lines)
  { x: 2, y: 3, w: 2, h: 1, color: EYE },
  { x: 4, y: 3, w: 2, h: 1, color: EYE },
  { x: 2, y: 6, w: 1, h: 1, color: FOOT },
  { x: 5, y: 6, w: 1, h: 1, color: FOOT },
];

export const JIGGLYPUFF_STARTLED: PixelRect[] = [
  // Hair puffed up
  { x: 3, y: 0, w: 2, h: 1, color: HAIR },
  { x: 2, y: 0, w: 1, h: 1, color: HAIR },
  { x: 2, y: 1, w: 4, h: 5, color: BODY },
  { x: 1, y: 2, w: 6, h: 3, color: BODY },
  { x: 3, y: 1, w: 2, h: 4, color: BODY_LT },
  // Big round eyes
  { x: 2, y: 3, w: 2, h: 2, color: EYE },
  { x: 4, y: 3, w: 2, h: 2, color: EYE },
  { x: 3, y: 3, w: 1, h: 1, color: EYE_LT },
  { x: 5, y: 3, w: 1, h: 1, color: EYE_LT },
  { x: 2, y: 6, w: 1, h: 1, color: FOOT },
  { x: 5, y: 6, w: 1, h: 1, color: FOOT },
];
