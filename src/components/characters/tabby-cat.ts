import type { PixelRect } from "./clawd";

export const CAT_WIDTH = 13;
export const CAT_HEIGHT = 9;

const BODY = "#aa8866";
const STRIPE = "#7a6044";
const BELLY = "#c4a882";
const EAR_INNER = "#b89878";
const EYE = "#88aa44";
const NOSE = "#cc8888";
const FEET = "#997755";

export const CAT_IDLE: PixelRect[] = [
  { x: 2, y: 3, w: 8, h: 5, color: BODY },
  { x: 1, y: 4, w: 10, h: 3, color: BODY },
  { x: 3, y: 5, w: 6, h: 2, color: BELLY },
  { x: 3, y: 3, w: 2, h: 1, color: STRIPE },
  { x: 6, y: 3, w: 2, h: 1, color: STRIPE },
  { x: 4, y: 4, w: 1, h: 1, color: STRIPE },
  { x: 7, y: 4, w: 1, h: 1, color: STRIPE },
  { x: 0, y: 2, w: 4, h: 4, color: BODY },
  { x: 0, y: 1, w: 1, h: 2, color: BODY },
  { x: 3, y: 1, w: 1, h: 2, color: BODY },
  { x: 0, y: 1, w: 1, h: 1, color: EAR_INNER },
  { x: 3, y: 1, w: 1, h: 1, color: EAR_INNER },
  { x: 0, y: 3, w: 1, h: 1, color: EYE },
  { x: 2, y: 3, w: 1, h: 1, color: EYE },
  { x: 1, y: 4, w: 1, h: 1, color: NOSE },
  { x: 10, y: 3, w: 2, h: 1, color: BODY },
  { x: 11, y: 2, w: 1, h: 1, color: BODY },
  { x: 11, y: 1, w: 1, h: 1, color: STRIPE },
  { x: 2, y: 8, w: 2, h: 1, color: FEET },
  { x: 7, y: 8, w: 2, h: 1, color: FEET },
];

/** Walk frame 1 — legs shifted */
export const CAT_WALK1: PixelRect[] = [
  { x: 2, y: 3, w: 8, h: 5, color: BODY },
  { x: 1, y: 4, w: 10, h: 3, color: BODY },
  { x: 3, y: 5, w: 6, h: 2, color: BELLY },
  { x: 3, y: 3, w: 2, h: 1, color: STRIPE },
  { x: 6, y: 3, w: 2, h: 1, color: STRIPE },
  { x: 4, y: 4, w: 1, h: 1, color: STRIPE },
  { x: 7, y: 4, w: 1, h: 1, color: STRIPE },
  { x: 0, y: 2, w: 4, h: 4, color: BODY },
  { x: 0, y: 1, w: 1, h: 2, color: BODY },
  { x: 3, y: 1, w: 1, h: 2, color: BODY },
  { x: 0, y: 1, w: 1, h: 1, color: EAR_INNER },
  { x: 3, y: 1, w: 1, h: 1, color: EAR_INNER },
  { x: 0, y: 3, w: 1, h: 1, color: EYE },
  { x: 2, y: 3, w: 1, h: 1, color: EYE },
  { x: 1, y: 4, w: 1, h: 1, color: NOSE },
  { x: 10, y: 3, w: 2, h: 1, color: BODY },
  { x: 11, y: 2, w: 1, h: 1, color: BODY },
  { x: 11, y: 1, w: 1, h: 1, color: STRIPE },
  { x: 1, y: 8, w: 2, h: 1, color: FEET },
  { x: 8, y: 8, w: 2, h: 1, color: FEET },
];

/** Curled up sleeping — compact ball shape, no legs, closed eyes */
export const CAT_SLEEP: PixelRect[] = [
  // Curled body — wider and flatter
  { x: 2, y: 4, w: 9, h: 4, color: BODY },
  { x: 3, y: 3, w: 7, h: 5, color: BODY },
  // Belly showing where curled
  { x: 4, y: 5, w: 5, h: 2, color: BELLY },
  // Stripes
  { x: 4, y: 3, w: 2, h: 1, color: STRIPE },
  { x: 7, y: 3, w: 2, h: 1, color: STRIPE },
  { x: 5, y: 4, w: 1, h: 1, color: STRIPE },
  { x: 8, y: 4, w: 1, h: 1, color: STRIPE },
  // Head tucked in — smaller, on the left
  { x: 1, y: 3, w: 3, h: 3, color: BODY },
  { x: 1, y: 2, w: 1, h: 2, color: BODY },
  { x: 3, y: 2, w: 1, h: 2, color: BODY },
  // Ears
  { x: 1, y: 2, w: 1, h: 1, color: EAR_INNER },
  { x: 3, y: 2, w: 1, h: 1, color: EAR_INNER },
  // Closed eyes — horizontal lines instead of dots
  { x: 0, y: 4, w: 2, h: 1, color: STRIPE },
  // Nose
  { x: 1, y: 5, w: 1, h: 1, color: NOSE },
  // Tail curled around body
  { x: 9, y: 4, w: 2, h: 1, color: BODY },
  { x: 10, y: 3, w: 2, h: 1, color: BODY },
  { x: 11, y: 2, w: 1, h: 1, color: STRIPE },
];

/** Startled — arched back, wide eyes, puffed tail */
export const CAT_STARTLED: PixelRect[] = [
  // Arched body — raised in the middle
  { x: 2, y: 4, w: 8, h: 4, color: BODY },
  { x: 3, y: 3, w: 6, h: 2, color: BODY },
  { x: 4, y: 2, w: 4, h: 2, color: BODY },
  // Belly
  { x: 3, y: 5, w: 6, h: 2, color: BELLY },
  // Fur spikes on back
  { x: 4, y: 1, w: 1, h: 1, color: STRIPE },
  { x: 6, y: 1, w: 1, h: 1, color: STRIPE },
  { x: 5, y: 2, w: 1, h: 1, color: STRIPE },
  { x: 7, y: 2, w: 1, h: 1, color: STRIPE },
  // Stripes
  { x: 3, y: 3, w: 2, h: 1, color: STRIPE },
  { x: 6, y: 3, w: 2, h: 1, color: STRIPE },
  // Head — slightly raised
  { x: 0, y: 2, w: 4, h: 4, color: BODY },
  { x: 0, y: 1, w: 1, h: 2, color: BODY },
  { x: 3, y: 1, w: 1, h: 2, color: BODY },
  // Pointy ears
  { x: 0, y: 0, w: 1, h: 2, color: BODY },
  { x: 3, y: 0, w: 1, h: 2, color: BODY },
  { x: 0, y: 0, w: 1, h: 1, color: EAR_INNER },
  { x: 3, y: 0, w: 1, h: 1, color: EAR_INNER },
  // Wide eyes — bigger than normal
  { x: 0, y: 3, w: 1, h: 1, color: "#ffffff" },
  { x: 2, y: 3, w: 1, h: 1, color: "#ffffff" },
  { x: 0, y: 3, w: 1, h: 1, color: EYE },
  { x: 2, y: 3, w: 1, h: 1, color: EYE },
  // Nose
  { x: 1, y: 4, w: 1, h: 1, color: NOSE },
  // Open mouth
  { x: 1, y: 5, w: 1, h: 1, color: "#cc6666" },
  // Puffed tail — standing straight up
  { x: 10, y: 3, w: 2, h: 1, color: BODY },
  { x: 11, y: 2, w: 2, h: 1, color: BODY },
  { x: 11, y: 1, w: 2, h: 2, color: STRIPE },
  { x: 12, y: 0, w: 1, h: 2, color: BODY },
  // Stiff legs
  { x: 2, y: 8, w: 1, h: 1, color: FEET },
  { x: 8, y: 8, w: 1, h: 1, color: FEET },
];

/** Walk frame 2 — legs shifted other way */
export const CAT_WALK2: PixelRect[] = [
  { x: 2, y: 3, w: 8, h: 5, color: BODY },
  { x: 1, y: 4, w: 10, h: 3, color: BODY },
  { x: 3, y: 5, w: 6, h: 2, color: BELLY },
  { x: 3, y: 3, w: 2, h: 1, color: STRIPE },
  { x: 6, y: 3, w: 2, h: 1, color: STRIPE },
  { x: 4, y: 4, w: 1, h: 1, color: STRIPE },
  { x: 7, y: 4, w: 1, h: 1, color: STRIPE },
  { x: 0, y: 2, w: 4, h: 4, color: BODY },
  { x: 0, y: 1, w: 1, h: 2, color: BODY },
  { x: 3, y: 1, w: 1, h: 2, color: BODY },
  { x: 0, y: 1, w: 1, h: 1, color: EAR_INNER },
  { x: 3, y: 1, w: 1, h: 1, color: EAR_INNER },
  { x: 0, y: 3, w: 1, h: 1, color: EYE },
  { x: 2, y: 3, w: 1, h: 1, color: EYE },
  { x: 1, y: 4, w: 1, h: 1, color: NOSE },
  { x: 10, y: 3, w: 2, h: 1, color: BODY },
  { x: 11, y: 2, w: 1, h: 1, color: BODY },
  { x: 11, y: 1, w: 1, h: 1, color: STRIPE },
  { x: 3, y: 8, w: 2, h: 1, color: FEET },
  { x: 6, y: 8, w: 2, h: 1, color: FEET },
];
