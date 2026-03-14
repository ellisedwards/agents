import type { PixelRect } from "./clawd";

export const GECKO_WIDTH = 14;
export const GECKO_HEIGHT = 7;

const BODY = "#44bb66";
const BODY_LIGHT = "#66dd88";
const BODY_DARK = "#339955";
const BELLY = "#88ddaa";
const SPOTS = "#33aa55";
const EYE = "#ffaa22";
const EYE_DARK = "#cc7700";
const FEET = "#55cc77";
const TONGUE = "#ee5566";

/** Idle — flat gecko with splayed legs, curled tail */
export const GECKO_IDLE: PixelRect[] = [
  // Body — long and flat
  { x: 3, y: 3, w: 7, h: 2, color: BODY },
  { x: 2, y: 3, w: 9, h: 1, color: BODY_LIGHT },
  { x: 4, y: 4, w: 5, h: 1, color: BELLY },
  // Spots on back
  { x: 4, y: 3, w: 1, h: 1, color: SPOTS },
  { x: 7, y: 3, w: 1, h: 1, color: SPOTS },
  { x: 5, y: 2, w: 1, h: 1, color: SPOTS },
  // Head — wide and flat
  { x: 0, y: 2, w: 4, h: 3, color: BODY },
  { x: 0, y: 3, w: 4, h: 1, color: BODY_LIGHT },
  // Big round eyes on top of head
  { x: 0, y: 1, w: 2, h: 2, color: EYE },
  { x: 3, y: 1, w: 2, h: 2, color: EYE },
  { x: 0, y: 1, w: 1, h: 1, color: EYE_DARK },
  { x: 3, y: 1, w: 1, h: 1, color: EYE_DARK },
  // Splayed legs — front
  { x: 1, y: 5, w: 1, h: 2, color: FEET },
  { x: 0, y: 6, w: 1, h: 1, color: FEET },
  { x: 3, y: 5, w: 1, h: 2, color: FEET },
  { x: 4, y: 6, w: 1, h: 1, color: FEET },
  // Splayed legs — back
  { x: 7, y: 5, w: 1, h: 2, color: FEET },
  { x: 6, y: 6, w: 1, h: 1, color: FEET },
  { x: 9, y: 5, w: 1, h: 2, color: FEET },
  { x: 10, y: 6, w: 1, h: 1, color: FEET },
  // Curled tail
  { x: 10, y: 3, w: 1, h: 1, color: BODY },
  { x: 11, y: 3, w: 1, h: 1, color: BODY },
  { x: 12, y: 2, w: 1, h: 1, color: BODY_DARK },
  { x: 13, y: 2, w: 1, h: 1, color: BODY_DARK },
  { x: 13, y: 3, w: 1, h: 1, color: BODY_DARK },
];

/** Walk frame 1 — legs shifted */
export const GECKO_WALK1: PixelRect[] = [
  { x: 3, y: 3, w: 7, h: 2, color: BODY },
  { x: 2, y: 3, w: 9, h: 1, color: BODY_LIGHT },
  { x: 4, y: 4, w: 5, h: 1, color: BELLY },
  { x: 4, y: 3, w: 1, h: 1, color: SPOTS },
  { x: 7, y: 3, w: 1, h: 1, color: SPOTS },
  { x: 5, y: 2, w: 1, h: 1, color: SPOTS },
  { x: 0, y: 2, w: 4, h: 3, color: BODY },
  { x: 0, y: 3, w: 4, h: 1, color: BODY_LIGHT },
  { x: 0, y: 1, w: 2, h: 2, color: EYE },
  { x: 3, y: 1, w: 2, h: 2, color: EYE },
  { x: 0, y: 1, w: 1, h: 1, color: EYE_DARK },
  { x: 3, y: 1, w: 1, h: 1, color: EYE_DARK },
  // Legs shifted — diagonal stance
  { x: 0, y: 5, w: 1, h: 2, color: FEET },
  { x: 4, y: 5, w: 1, h: 2, color: FEET },
  { x: 5, y: 6, w: 1, h: 1, color: FEET },
  { x: 6, y: 5, w: 1, h: 2, color: FEET },
  { x: 10, y: 5, w: 1, h: 2, color: FEET },
  { x: 11, y: 6, w: 1, h: 1, color: FEET },
  // Tail
  { x: 10, y: 3, w: 1, h: 1, color: BODY },
  { x: 11, y: 3, w: 1, h: 1, color: BODY },
  { x: 12, y: 2, w: 1, h: 1, color: BODY_DARK },
  { x: 13, y: 2, w: 1, h: 1, color: BODY_DARK },
  { x: 13, y: 3, w: 1, h: 1, color: BODY_DARK },
];

/** Walk frame 2 — legs opposite */
export const GECKO_WALK2: PixelRect[] = [
  { x: 3, y: 3, w: 7, h: 2, color: BODY },
  { x: 2, y: 3, w: 9, h: 1, color: BODY_LIGHT },
  { x: 4, y: 4, w: 5, h: 1, color: BELLY },
  { x: 4, y: 3, w: 1, h: 1, color: SPOTS },
  { x: 7, y: 3, w: 1, h: 1, color: SPOTS },
  { x: 5, y: 2, w: 1, h: 1, color: SPOTS },
  { x: 0, y: 2, w: 4, h: 3, color: BODY },
  { x: 0, y: 3, w: 4, h: 1, color: BODY_LIGHT },
  { x: 0, y: 1, w: 2, h: 2, color: EYE },
  { x: 3, y: 1, w: 2, h: 2, color: EYE },
  { x: 0, y: 1, w: 1, h: 1, color: EYE_DARK },
  { x: 3, y: 1, w: 1, h: 1, color: EYE_DARK },
  // Legs opposite
  { x: 1, y: 5, w: 1, h: 2, color: FEET },
  { x: 2, y: 6, w: 1, h: 1, color: FEET },
  { x: 3, y: 5, w: 1, h: 2, color: FEET },
  { x: 7, y: 5, w: 1, h: 2, color: FEET },
  { x: 9, y: 5, w: 1, h: 2, color: FEET },
  { x: 8, y: 6, w: 1, h: 1, color: FEET },
  // Tail
  { x: 10, y: 3, w: 1, h: 1, color: BODY },
  { x: 11, y: 3, w: 1, h: 1, color: BODY },
  { x: 12, y: 2, w: 1, h: 1, color: BODY_DARK },
  { x: 13, y: 2, w: 1, h: 1, color: BODY_DARK },
  { x: 13, y: 3, w: 1, h: 1, color: BODY_DARK },
];

/** Sleeping — curled up flat with tail wrapped */
export const GECKO_SLEEP: PixelRect[] = [
  // Coiled body
  { x: 3, y: 3, w: 6, h: 3, color: BODY },
  { x: 4, y: 3, w: 4, h: 3, color: BODY_LIGHT },
  { x: 5, y: 4, w: 2, h: 1, color: BELLY },
  { x: 4, y: 3, w: 1, h: 1, color: SPOTS },
  { x: 7, y: 4, w: 1, h: 1, color: SPOTS },
  // Head tucked
  { x: 1, y: 3, w: 3, h: 2, color: BODY },
  { x: 1, y: 3, w: 3, h: 1, color: BODY_LIGHT },
  // Closed eyes — just slits
  { x: 1, y: 3, w: 1, h: 1, color: EYE_DARK },
  { x: 3, y: 3, w: 1, h: 1, color: EYE_DARK },
  // Tail wrapped around body
  { x: 9, y: 3, w: 1, h: 1, color: BODY },
  { x: 10, y: 3, w: 1, h: 1, color: BODY_DARK },
  { x: 10, y: 4, w: 1, h: 1, color: BODY_DARK },
  { x: 9, y: 5, w: 1, h: 1, color: BODY_DARK },
  { x: 8, y: 5, w: 1, h: 1, color: BODY_DARK },
];

/** Startled — reared up, tongue out */
export const GECKO_STARTLED: PixelRect[] = [
  // Body — slightly arched
  { x: 3, y: 3, w: 7, h: 2, color: BODY },
  { x: 3, y: 2, w: 5, h: 2, color: BODY },
  { x: 4, y: 4, w: 5, h: 1, color: BELLY },
  { x: 4, y: 2, w: 1, h: 1, color: SPOTS },
  { x: 7, y: 2, w: 1, h: 1, color: SPOTS },
  // Head raised
  { x: 0, y: 1, w: 4, h: 3, color: BODY },
  { x: 0, y: 2, w: 4, h: 1, color: BODY_LIGHT },
  // Big startled eyes
  { x: 0, y: 0, w: 2, h: 2, color: EYE },
  { x: 3, y: 0, w: 2, h: 2, color: EYE },
  { x: 0, y: 0, w: 1, h: 1, color: "#ffffff" },
  { x: 3, y: 0, w: 1, h: 1, color: "#ffffff" },
  // Tongue sticking out
  { x: 1, y: 4, w: 1, h: 1, color: TONGUE },
  { x: 0, y: 4, w: 1, h: 1, color: TONGUE },
  // Stiff splayed legs
  { x: 1, y: 5, w: 1, h: 2, color: FEET },
  { x: 0, y: 6, w: 1, h: 1, color: FEET },
  { x: 3, y: 5, w: 1, h: 2, color: FEET },
  { x: 4, y: 6, w: 1, h: 1, color: FEET },
  { x: 7, y: 5, w: 1, h: 2, color: FEET },
  { x: 6, y: 6, w: 1, h: 1, color: FEET },
  { x: 9, y: 5, w: 1, h: 2, color: FEET },
  { x: 10, y: 6, w: 1, h: 1, color: FEET },
  // Tail straight out
  { x: 10, y: 3, w: 1, h: 1, color: BODY },
  { x: 11, y: 3, w: 1, h: 1, color: BODY_DARK },
  { x: 12, y: 3, w: 1, h: 1, color: BODY_DARK },
  { x: 13, y: 3, w: 1, h: 1, color: BODY_DARK },
];
