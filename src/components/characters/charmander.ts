import type { AgentSpriteState } from "@/shared/types";
import type { PixelRect } from "./clawd";

export const CHARMANDER_WIDTH = 14;
export const CHARMANDER_HEIGHT = 14;

const BODY = "#e87830";
const BODY_LT = "#f09048";
const BELLY = "#f8d878";
const EYE = "#1a1a2e";
const FLAME = "#ff4422";
const FLAME_TIP = "#ffcc44";

const body: PixelRect[] = [
  // Head
  { x: 4, y: 0, w: 6, h: 5, color: BODY },
  { x: 3, y: 1, w: 8, h: 4, color: BODY },
  { x: 5, y: 0, w: 4, h: 4, color: BODY_LT },
  // Eyes
  { x: 5, y: 2, w: 1, h: 2, color: EYE },
  { x: 8, y: 2, w: 1, h: 2, color: EYE },
  // Body
  { x: 4, y: 5, w: 6, h: 4, color: BODY },
  { x: 5, y: 5, w: 4, h: 3, color: BELLY },
  // Arms
  { x: 2, y: 5, w: 2, h: 2, color: BODY },
  { x: 10, y: 5, w: 2, h: 2, color: BODY },
  // Legs
  { x: 4, y: 9, w: 2, h: 3, color: BODY },
  { x: 8, y: 9, w: 2, h: 3, color: BODY },
  // Tail with flame
  { x: 11, y: 7, w: 1, h: 3, color: BODY },
  { x: 12, y: 6, w: 1, h: 2, color: BODY },
  { x: 12, y: 5, w: 1, h: 1, color: FLAME },
  { x: 13, y: 4, w: 1, h: 2, color: FLAME_TIP },
];

const typingBody: PixelRect[] = [
  { x: 4, y: 0, w: 6, h: 5, color: BODY },
  { x: 3, y: 1, w: 8, h: 4, color: BODY },
  { x: 5, y: 0, w: 4, h: 4, color: BODY_LT },
  // >_< eyes
  { x: 5, y: 2, w: 1, h: 1, color: EYE },
  { x: 6, y: 3, w: 1, h: 1, color: EYE },
  { x: 5, y: 4, w: 1, h: 1, color: EYE },
  { x: 8, y: 2, w: 1, h: 1, color: EYE },
  { x: 7, y: 3, w: 1, h: 1, color: EYE },
  { x: 8, y: 4, w: 1, h: 1, color: EYE },
  { x: 4, y: 5, w: 6, h: 4, color: BODY },
  { x: 5, y: 5, w: 4, h: 3, color: BELLY },
  // Arms forward
  { x: 1, y: 4, w: 3, h: 2, color: BODY },
  { x: 10, y: 4, w: 3, h: 2, color: BODY },
  { x: 4, y: 9, w: 2, h: 3, color: BODY },
  { x: 8, y: 9, w: 2, h: 3, color: BODY },
  { x: 11, y: 7, w: 1, h: 3, color: BODY },
  { x: 12, y: 6, w: 1, h: 2, color: BODY },
  { x: 12, y: 5, w: 1, h: 1, color: FLAME },
  { x: 13, y: 4, w: 1, h: 2, color: FLAME_TIP },
];

export const CHARMANDER_SPRITES: Record<AgentSpriteState, PixelRect[]> = {
  idle: body,
  typing: typingBody,
  reading: [
    { x: 4, y: 0, w: 6, h: 5, color: BODY },
    { x: 3, y: 1, w: 8, h: 4, color: BODY },
    { x: 5, y: 0, w: 4, h: 4, color: BODY_LT },
    // Half-lidded eyes
    { x: 5, y: 3, w: 2, h: 1, color: EYE },
    { x: 7, y: 3, w: 2, h: 1, color: EYE },
    { x: 4, y: 5, w: 6, h: 4, color: BODY },
    { x: 5, y: 5, w: 4, h: 3, color: BELLY },
    { x: 2, y: 5, w: 2, h: 2, color: BODY },
    { x: 10, y: 5, w: 2, h: 2, color: BODY },
    { x: 4, y: 9, w: 2, h: 3, color: BODY },
    { x: 8, y: 9, w: 2, h: 3, color: BODY },
    { x: 11, y: 7, w: 1, h: 3, color: BODY },
    { x: 12, y: 6, w: 1, h: 2, color: BODY },
    { x: 12, y: 5, w: 1, h: 1, color: FLAME },
    { x: 13, y: 4, w: 1, h: 2, color: FLAME_TIP },
  ],
  thinking: body,
  waiting: [
    { x: 4, y: 0, w: 6, h: 5, color: BODY },
    { x: 3, y: 1, w: 8, h: 4, color: BODY },
    { x: 5, y: 0, w: 4, h: 4, color: BODY_LT },
    // Wide eyes with glint
    { x: 5, y: 2, w: 2, h: 2, color: EYE },
    { x: 7, y: 2, w: 2, h: 2, color: EYE },
    { x: 6, y: 2, w: 1, h: 1, color: BODY_LT },
    { x: 8, y: 2, w: 1, h: 1, color: BODY_LT },
    { x: 4, y: 5, w: 6, h: 4, color: BODY },
    { x: 5, y: 5, w: 4, h: 3, color: BELLY },
    { x: 2, y: 5, w: 2, h: 2, color: BODY },
    { x: 10, y: 4, w: 2, h: 2, color: BODY },
    { x: 12, y: 2, w: 1, h: 2, color: BODY },
    { x: 4, y: 9, w: 2, h: 3, color: BODY },
    { x: 8, y: 9, w: 2, h: 3, color: BODY },
    { x: 11, y: 7, w: 1, h: 3, color: BODY },
    { x: 12, y: 6, w: 1, h: 2, color: BODY },
    { x: 12, y: 5, w: 1, h: 1, color: FLAME },
    { x: 13, y: 4, w: 1, h: 2, color: FLAME_TIP },
  ],
};
