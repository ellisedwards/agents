import type { PixelRect } from "./clawd";

export const SPHYNX_WIDTH = 13;
export const SPHYNX_HEIGHT = 9;

const BODY = "#e8ddd0";
const SKIN_LIGHT = "#f2ece4";
const SKIN_DARK = "#c8b8a8";
const WRINKLE = "#b0a090";
const EAR_TIP = "#e8ddd0";
const EAR_INNER = "#eeccbb";
const EYE = "#55cc88";
const NOSE = "#dd9999";
const FEET = "#e8ddd0";

/** Idle — sleek hairless cat with big ears, long tail */
export const SPHYNX_IDLE: PixelRect[] = [
  // Slim body
  { x: 2, y: 4, w: 7, h: 4, color: BODY },
  { x: 1, y: 5, w: 9, h: 2, color: BODY },
  // Lighter belly
  { x: 3, y: 5, w: 5, h: 2, color: SKIN_LIGHT },
  // Wrinkles on body
  { x: 3, y: 4, w: 1, h: 1, color: WRINKLE },
  { x: 5, y: 4, w: 1, h: 1, color: WRINKLE },
  { x: 7, y: 4, w: 1, h: 1, color: WRINKLE },
  // Head — angular
  { x: 0, y: 2, w: 4, h: 4, color: BODY },
  { x: 0, y: 3, w: 4, h: 2, color: SKIN_LIGHT },
  // Big ears — taller than tabby, dark tips
  { x: 0, y: 0, w: 1, h: 3, color: EAR_TIP },
  { x: 3, y: 0, w: 1, h: 3, color: EAR_TIP },
  { x: 0, y: 1, w: 1, h: 2, color: EAR_INNER },
  { x: 3, y: 1, w: 1, h: 2, color: EAR_INNER },
  // Eyes
  { x: 0, y: 3, w: 1, h: 1, color: EYE },
  { x: 2, y: 3, w: 1, h: 1, color: EYE },
  // Nose
  { x: 1, y: 4, w: 1, h: 1, color: NOSE },
  // Long curled tail
  { x: 9, y: 4, w: 1, h: 1, color: BODY },
  { x: 10, y: 3, w: 1, h: 1, color: BODY },
  { x: 11, y: 2, w: 1, h: 1, color: BODY },
  { x: 12, y: 2, w: 1, h: 1, color: BODY },
  { x: 12, y: 3, w: 1, h: 1, color: SKIN_DARK },
  // Slim legs
  { x: 2, y: 8, w: 1, h: 1, color: FEET },
  { x: 7, y: 8, w: 1, h: 1, color: FEET },
];

/** Walk frame 1 */
export const SPHYNX_WALK1: PixelRect[] = [
  { x: 2, y: 4, w: 7, h: 4, color: BODY },
  { x: 1, y: 5, w: 9, h: 2, color: BODY },
  { x: 3, y: 5, w: 5, h: 2, color: SKIN_LIGHT },
  { x: 3, y: 4, w: 1, h: 1, color: WRINKLE },
  { x: 5, y: 4, w: 1, h: 1, color: WRINKLE },
  { x: 7, y: 4, w: 1, h: 1, color: WRINKLE },
  { x: 0, y: 2, w: 4, h: 4, color: BODY },
  { x: 0, y: 3, w: 4, h: 2, color: SKIN_LIGHT },
  { x: 0, y: 0, w: 1, h: 3, color: EAR_TIP },
  { x: 3, y: 0, w: 1, h: 3, color: EAR_TIP },
  { x: 0, y: 0, w: 1, h: 2, color: EAR_INNER },
  { x: 3, y: 0, w: 1, h: 2, color: EAR_INNER },
  { x: 0, y: 3, w: 1, h: 1, color: EYE },
  { x: 2, y: 3, w: 1, h: 1, color: EYE },
  { x: 1, y: 4, w: 1, h: 1, color: NOSE },
  { x: 9, y: 4, w: 1, h: 1, color: BODY },
  { x: 10, y: 3, w: 1, h: 1, color: BODY },
  { x: 11, y: 2, w: 1, h: 1, color: BODY },
  { x: 12, y: 2, w: 1, h: 1, color: BODY },
  { x: 12, y: 3, w: 1, h: 1, color: SKIN_DARK },
  { x: 1, y: 8, w: 1, h: 1, color: FEET },
  { x: 8, y: 8, w: 1, h: 1, color: FEET },
];

/** Walk frame 2 */
export const SPHYNX_WALK2: PixelRect[] = [
  { x: 2, y: 4, w: 7, h: 4, color: BODY },
  { x: 1, y: 5, w: 9, h: 2, color: BODY },
  { x: 3, y: 5, w: 5, h: 2, color: SKIN_LIGHT },
  { x: 3, y: 4, w: 1, h: 1, color: WRINKLE },
  { x: 5, y: 4, w: 1, h: 1, color: WRINKLE },
  { x: 7, y: 4, w: 1, h: 1, color: WRINKLE },
  { x: 0, y: 2, w: 4, h: 4, color: BODY },
  { x: 0, y: 3, w: 4, h: 2, color: SKIN_LIGHT },
  { x: 0, y: 0, w: 1, h: 3, color: EAR_TIP },
  { x: 3, y: 0, w: 1, h: 3, color: EAR_TIP },
  { x: 0, y: 0, w: 1, h: 2, color: EAR_INNER },
  { x: 3, y: 0, w: 1, h: 2, color: EAR_INNER },
  { x: 0, y: 3, w: 1, h: 1, color: EYE },
  { x: 2, y: 3, w: 1, h: 1, color: EYE },
  { x: 1, y: 4, w: 1, h: 1, color: NOSE },
  { x: 9, y: 4, w: 1, h: 1, color: BODY },
  { x: 10, y: 3, w: 1, h: 1, color: BODY },
  { x: 11, y: 2, w: 1, h: 1, color: BODY },
  { x: 12, y: 2, w: 1, h: 1, color: BODY },
  { x: 12, y: 3, w: 1, h: 1, color: SKIN_DARK },
  { x: 3, y: 8, w: 1, h: 1, color: FEET },
  { x: 6, y: 8, w: 1, h: 1, color: FEET },
];

/** Curled up sleeping */
export const SPHYNX_SLEEP: PixelRect[] = [
  // Curled body
  { x: 2, y: 4, w: 9, h: 4, color: BODY },
  { x: 3, y: 3, w: 7, h: 5, color: BODY },
  { x: 4, y: 5, w: 5, h: 2, color: SKIN_LIGHT },
  // Wrinkles
  { x: 5, y: 3, w: 1, h: 1, color: WRINKLE },
  { x: 7, y: 4, w: 1, h: 1, color: WRINKLE },
  // Head tucked
  { x: 1, y: 3, w: 3, h: 3, color: BODY },
  { x: 1, y: 3, w: 3, h: 2, color: SKIN_LIGHT },
  // Big ears
  { x: 1, y: 1, w: 1, h: 3, color: EAR_TIP },
  { x: 3, y: 1, w: 1, h: 3, color: EAR_TIP },
  { x: 1, y: 1, w: 1, h: 2, color: EAR_INNER },
  { x: 3, y: 1, w: 1, h: 2, color: EAR_INNER },
  // Closed eyes
  { x: 0, y: 4, w: 2, h: 1, color: WRINKLE },
  // Nose
  { x: 1, y: 5, w: 1, h: 1, color: NOSE },
  // Long tail curled around body
  { x: 9, y: 4, w: 1, h: 1, color: BODY },
  { x: 10, y: 3, w: 1, h: 1, color: BODY },
  { x: 11, y: 3, w: 1, h: 1, color: BODY },
  { x: 11, y: 4, w: 1, h: 1, color: BODY },
  { x: 10, y: 5, w: 1, h: 1, color: SKIN_DARK },
];

/** Startled — arched back, wide eyes, tail straight up */
export const SPHYNX_STARTLED: PixelRect[] = [
  // Arched body
  { x: 2, y: 4, w: 7, h: 4, color: BODY },
  { x: 3, y: 3, w: 5, h: 2, color: BODY },
  { x: 4, y: 2, w: 3, h: 2, color: BODY },
  { x: 3, y: 5, w: 5, h: 2, color: SKIN_LIGHT },
  // Wrinkles bunched up
  { x: 3, y: 3, w: 1, h: 1, color: WRINKLE },
  { x: 5, y: 2, w: 1, h: 1, color: WRINKLE },
  { x: 7, y: 3, w: 1, h: 1, color: WRINKLE },
  // Head raised
  { x: 0, y: 2, w: 4, h: 4, color: BODY },
  { x: 0, y: 3, w: 4, h: 2, color: SKIN_LIGHT },
  // Big ears — extra pointy when startled
  { x: 0, y: 0, w: 1, h: 3, color: EAR_TIP },
  { x: 3, y: 0, w: 1, h: 3, color: EAR_TIP },
  { x: 0, y: 0, w: 1, h: 2, color: EAR_INNER },
  { x: 3, y: 0, w: 1, h: 2, color: EAR_INNER },
  // Wide eyes
  { x: 0, y: 3, w: 1, h: 1, color: "#ffffff" },
  { x: 2, y: 3, w: 1, h: 1, color: "#ffffff" },
  { x: 0, y: 3, w: 1, h: 1, color: EYE },
  { x: 2, y: 3, w: 1, h: 1, color: EYE },
  // Nose
  { x: 1, y: 4, w: 1, h: 1, color: NOSE },
  // Open mouth
  { x: 1, y: 5, w: 1, h: 1, color: "#cc6666" },
  // Tail straight up — long and thin
  { x: 9, y: 4, w: 1, h: 1, color: BODY },
  { x: 10, y: 3, w: 1, h: 1, color: BODY },
  { x: 10, y: 2, w: 1, h: 1, color: BODY },
  { x: 10, y: 1, w: 1, h: 1, color: BODY },
  { x: 10, y: 0, w: 1, h: 1, color: SKIN_DARK },
  // Stiff legs
  { x: 2, y: 8, w: 1, h: 1, color: FEET },
  { x: 7, y: 8, w: 1, h: 1, color: FEET },
];
