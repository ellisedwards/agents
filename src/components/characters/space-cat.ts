import type { PixelRect } from "./clawd";

export const SPACE_CAT_WIDTH = 15;
export const SPACE_CAT_HEIGHT = 10;

const BODY = "#aa8866";
const STRIPE = "#7a6044";
const BELLY = "#c4a882";
const EAR_INNER = "#b89878";
const EYE = "#88aa44";
const NOSE = "#cc8888";
const FEET = "#997755";
// Helmet
const GLASS = "#99ccee";
const GLASS_LIGHT = "#bbddff";
const GLASS_SHINE = "#ddeeff";
const GLASS_DIM = "#88bbdd";
const GLASS_DEEP = "#6699aa";
const HELM_RIM_LIGHT = "#99a0a8";
const HELM_RIM_DARK = "#555d65";

// Body offset — shift right by 2 so helmet bulge fits in front
const B = 2;

// Helmet: 8px wide, 7px tall rounded dome
// Extends 2px in front of face for visible bulge
function helmet(oy: number): PixelRect[] {
  const hy = oy;
  return [
    // Rounded sphere — tapers at top and bottom
    { x: 2, y: hy,     w: 4, h: 1, color: GLASS_DIM },     // row 0: cap
    { x: 1, y: hy + 1, w: 6, h: 1, color: GLASS_DIM },     // row 1
    { x: 0, y: hy + 2, w: 8, h: 1, color: GLASS_DIM },     // row 2
    { x: 0, y: hy + 3, w: 8, h: 2, color: GLASS_DIM },     // rows 3-4: widest
    { x: 0, y: hy + 5, w: 8, h: 1, color: GLASS_DIM },     // row 5
    { x: 1, y: hy + 6, w: 6, h: 1, color: GLASS_DEEP },    // row 6

    // Convex center — layered brightness
    { x: 2, y: hy + 2, w: 4, h: 3, color: GLASS },
    { x: 1, y: hy + 3, w: 6, h: 2, color: GLASS },
    { x: 2, y: hy + 3, w: 3, h: 2, color: GLASS_LIGHT },

    // Specular highlight — upper-left curve
    { x: 2, y: hy + 1, w: 2, h: 1, color: GLASS_SHINE },
    { x: 1, y: hy + 2, w: 1, h: 2, color: GLASS_SHINE },
    { x: 2, y: hy + 2, w: 1, h: 1, color: GLASS_SHINE },

    // Edges dark (curving away)
    { x: 0, y: hy + 3, w: 1, h: 2, color: GLASS_DEEP },
    { x: 7, y: hy + 3, w: 1, h: 2, color: GLASS_DEEP },

    // Metallic rim
    { x: 1, y: hy + 7, w: 6, h: 1, color: HELM_RIM_LIGHT },
    { x: 2, y: hy + 8, w: 4, h: 1, color: HELM_RIM_DARK },
  ];
}

/** Idle */
export const SPACE_CAT_IDLE: PixelRect[] = [
  // Body
  { x: B + 2, y: 5, w: 8, h: 4, color: BODY },
  { x: B + 1, y: 6, w: 10, h: 2, color: BODY },
  { x: B + 3, y: 6, w: 6, h: 2, color: BELLY },
  { x: B + 3, y: 5, w: 2, h: 1, color: STRIPE },
  { x: B + 6, y: 5, w: 2, h: 1, color: STRIPE },
  // Helmet
  ...helmet(0),
  // Head inside helmet
  { x: B, y: 3, w: 4, h: 4, color: BODY },
  { x: B, y: 2, w: 1, h: 2, color: BODY },
  { x: B + 3, y: 2, w: 1, h: 2, color: BODY },
  { x: B, y: 2, w: 1, h: 1, color: EAR_INNER },
  { x: B + 3, y: 2, w: 1, h: 1, color: EAR_INNER },
  { x: B, y: 4, w: 1, h: 1, color: EYE },
  { x: B + 2, y: 4, w: 1, h: 1, color: EYE },
  { x: B + 1, y: 5, w: 1, h: 1, color: NOSE },
  // Tail
  { x: B + 10, y: 4, w: 2, h: 1, color: BODY },
  { x: B + 11, y: 3, w: 1, h: 1, color: BODY },
  { x: B + 11, y: 2, w: 1, h: 1, color: STRIPE },
  // Feet
  { x: B + 2, y: 9, w: 2, h: 1, color: FEET },
  { x: B + 7, y: 9, w: 2, h: 1, color: FEET },
];

/** Walk frame 1 */
export const SPACE_CAT_WALK1: PixelRect[] = [
  { x: B + 2, y: 5, w: 8, h: 4, color: BODY },
  { x: B + 1, y: 6, w: 10, h: 2, color: BODY },
  { x: B + 3, y: 6, w: 6, h: 2, color: BELLY },
  { x: B + 3, y: 5, w: 2, h: 1, color: STRIPE },
  { x: B + 6, y: 5, w: 2, h: 1, color: STRIPE },
  ...helmet(0),
  { x: B, y: 3, w: 4, h: 4, color: BODY },
  { x: B, y: 2, w: 1, h: 2, color: BODY },
  { x: B + 3, y: 2, w: 1, h: 2, color: BODY },
  { x: B, y: 2, w: 1, h: 1, color: EAR_INNER },
  { x: B + 3, y: 2, w: 1, h: 1, color: EAR_INNER },
  { x: B, y: 4, w: 1, h: 1, color: EYE },
  { x: B + 2, y: 4, w: 1, h: 1, color: EYE },
  { x: B + 1, y: 5, w: 1, h: 1, color: NOSE },
  { x: B + 10, y: 4, w: 2, h: 1, color: BODY },
  { x: B + 11, y: 3, w: 1, h: 1, color: BODY },
  { x: B + 11, y: 2, w: 1, h: 1, color: STRIPE },
  { x: B + 1, y: 9, w: 2, h: 1, color: FEET },
  { x: B + 8, y: 9, w: 2, h: 1, color: FEET },
];

/** Walk frame 2 */
export const SPACE_CAT_WALK2: PixelRect[] = [
  { x: B + 2, y: 5, w: 8, h: 4, color: BODY },
  { x: B + 1, y: 6, w: 10, h: 2, color: BODY },
  { x: B + 3, y: 6, w: 6, h: 2, color: BELLY },
  { x: B + 3, y: 5, w: 2, h: 1, color: STRIPE },
  { x: B + 6, y: 5, w: 2, h: 1, color: STRIPE },
  ...helmet(0),
  { x: B, y: 3, w: 4, h: 4, color: BODY },
  { x: B, y: 2, w: 1, h: 2, color: BODY },
  { x: B + 3, y: 2, w: 1, h: 2, color: BODY },
  { x: B, y: 2, w: 1, h: 1, color: EAR_INNER },
  { x: B + 3, y: 2, w: 1, h: 1, color: EAR_INNER },
  { x: B, y: 4, w: 1, h: 1, color: EYE },
  { x: B + 2, y: 4, w: 1, h: 1, color: EYE },
  { x: B + 1, y: 5, w: 1, h: 1, color: NOSE },
  { x: B + 10, y: 4, w: 2, h: 1, color: BODY },
  { x: B + 11, y: 3, w: 1, h: 1, color: BODY },
  { x: B + 11, y: 2, w: 1, h: 1, color: STRIPE },
  { x: B + 3, y: 9, w: 2, h: 1, color: FEET },
  { x: B + 6, y: 9, w: 2, h: 1, color: FEET },
];

/** Sleeping — curled up with helmet still on */
export const SPACE_CAT_SLEEP: PixelRect[] = [
  { x: B + 2, y: 5, w: 9, h: 4, color: BODY },
  { x: B + 3, y: 4, w: 7, h: 5, color: BODY },
  { x: B + 4, y: 6, w: 5, h: 2, color: BELLY },
  { x: B + 4, y: 4, w: 2, h: 1, color: STRIPE },
  { x: B + 7, y: 4, w: 2, h: 1, color: STRIPE },
  ...helmet(0),
  { x: B, y: 3, w: 4, h: 4, color: BODY },
  { x: B, y: 2, w: 1, h: 2, color: BODY },
  { x: B + 3, y: 2, w: 1, h: 2, color: BODY },
  { x: B, y: 2, w: 1, h: 1, color: EAR_INNER },
  { x: B + 3, y: 2, w: 1, h: 1, color: EAR_INNER },
  { x: B, y: 5, w: 2, h: 1, color: STRIPE },
  { x: B + 1, y: 6, w: 1, h: 1, color: NOSE },
  { x: B + 9, y: 5, w: 2, h: 1, color: BODY },
  { x: B + 10, y: 4, w: 2, h: 1, color: BODY },
  { x: B + 11, y: 3, w: 1, h: 1, color: STRIPE },
];

/** Startled — arched back, helmet glint */
export const SPACE_CAT_STARTLED: PixelRect[] = [
  { x: B + 2, y: 5, w: 8, h: 4, color: BODY },
  { x: B + 3, y: 4, w: 6, h: 2, color: BODY },
  { x: B + 4, y: 3, w: 4, h: 2, color: BODY },
  { x: B + 3, y: 6, w: 6, h: 2, color: BELLY },
  { x: B + 4, y: 3, w: 1, h: 1, color: STRIPE },
  { x: B + 6, y: 3, w: 1, h: 1, color: STRIPE },
  ...helmet(-1),
  { x: 1, y: 0, w: 2, h: 1, color: GLASS_SHINE },
  { x: B, y: 2, w: 4, h: 4, color: BODY },
  { x: B, y: 1, w: 1, h: 2, color: BODY },
  { x: B + 3, y: 1, w: 1, h: 2, color: BODY },
  { x: B, y: 1, w: 1, h: 1, color: EAR_INNER },
  { x: B + 3, y: 1, w: 1, h: 1, color: EAR_INNER },
  { x: B, y: 3, w: 1, h: 1, color: "#ffffff" },
  { x: B + 2, y: 3, w: 1, h: 1, color: "#ffffff" },
  { x: B, y: 3, w: 1, h: 1, color: EYE },
  { x: B + 2, y: 3, w: 1, h: 1, color: EYE },
  { x: B + 1, y: 4, w: 1, h: 1, color: NOSE },
  { x: B + 10, y: 4, w: 2, h: 1, color: BODY },
  { x: B + 11, y: 3, w: 2, h: 1, color: STRIPE },
  { x: B + 12, y: 2, w: 1, h: 2, color: BODY },
  { x: B + 2, y: 9, w: 1, h: 1, color: FEET },
  { x: B + 8, y: 9, w: 1, h: 1, color: FEET },
];
