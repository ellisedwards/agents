import type { AgentSpriteState } from "@/shared/types";
import type { PixelRect } from "./clawd";

export const PIKACHU_WIDTH = 10;
export const PIKACHU_HEIGHT = 10;

const BODY = "#f8d030";
const BODY_LT = "#f8e060";
const EAR_TIP = "#222222";
const CHEEK = "#cc3333";
const EYE = "#1a1a2e";
const TAIL = "#f8d030";
const TAIL_DK = "#c8a020";

const body: PixelRect[] = [
  // Ears (pointy)
  { x: 1, y: 0, w: 1, h: 2, color: BODY },
  { x: 1, y: 0, w: 1, h: 1, color: EAR_TIP },
  { x: 8, y: 0, w: 1, h: 2, color: BODY },
  { x: 8, y: 0, w: 1, h: 1, color: EAR_TIP },
  // Head
  { x: 2, y: 2, w: 6, h: 4, color: BODY },
  { x: 3, y: 1, w: 4, h: 4, color: BODY },
  { x: 3, y: 2, w: 4, h: 3, color: BODY_LT },
  // Eyes
  { x: 3, y: 3, w: 1, h: 1, color: EYE },
  { x: 6, y: 3, w: 1, h: 1, color: EYE },
  // Cheeks
  { x: 2, y: 4, w: 1, h: 1, color: CHEEK },
  { x: 7, y: 4, w: 1, h: 1, color: CHEEK },
  // Body
  { x: 3, y: 6, w: 4, h: 2, color: BODY },
  // Legs
  { x: 3, y: 8, w: 1, h: 1, color: BODY },
  { x: 6, y: 8, w: 1, h: 1, color: BODY },
  // Tail
  { x: 8, y: 5, w: 1, h: 1, color: TAIL_DK },
  { x: 9, y: 4, w: 1, h: 2, color: TAIL },
];

const typingBody: PixelRect[] = [
  ...body.slice(0, 7), // ears + head
  { x: 3, y: 4, w: 2, h: 1, color: EYE },
  { x: 5, y: 4, w: 2, h: 1, color: EYE },
  { x: 2, y: 4, w: 1, h: 1, color: CHEEK },
  { x: 7, y: 4, w: 1, h: 1, color: CHEEK },
  { x: 3, y: 6, w: 4, h: 2, color: BODY },
  { x: 1, y: 5, w: 2, h: 2, color: BODY },
  { x: 7, y: 5, w: 2, h: 2, color: BODY },
  { x: 3, y: 8, w: 1, h: 1, color: BODY },
  { x: 6, y: 8, w: 1, h: 1, color: BODY },
  { x: 8, y: 5, w: 1, h: 1, color: TAIL_DK },
  { x: 9, y: 4, w: 1, h: 2, color: TAIL },
];

export const PIKACHU_SPRITES: Record<AgentSpriteState, PixelRect[]> = {
  idle: body,
  typing: typingBody,
  reading: body,
  thinking: body,
  waiting: [
    ...body.slice(0, 7),
    { x: 3, y: 3, w: 2, h: 2, color: EYE },
    { x: 5, y: 3, w: 2, h: 2, color: EYE },
    { x: 4, y: 3, w: 1, h: 1, color: BODY_LT },
    { x: 6, y: 3, w: 1, h: 1, color: BODY_LT },
    { x: 2, y: 4, w: 1, h: 1, color: CHEEK },
    { x: 7, y: 4, w: 1, h: 1, color: CHEEK },
    { x: 3, y: 6, w: 4, h: 2, color: BODY },
    { x: 3, y: 8, w: 1, h: 1, color: BODY },
    { x: 6, y: 8, w: 1, h: 1, color: BODY },
    { x: 8, y: 5, w: 1, h: 1, color: TAIL_DK },
    { x: 9, y: 4, w: 1, h: 2, color: TAIL },
  ],
};

export const PIKACHU_WALK1: PixelRect[] = [
  ...body.slice(0, -4),
  { x: 2, y: 8, w: 1, h: 1, color: BODY },
  { x: 7, y: 8, w: 1, h: 1, color: BODY },
  { x: 8, y: 5, w: 1, h: 1, color: TAIL_DK },
  { x: 9, y: 4, w: 1, h: 2, color: TAIL },
];

export const PIKACHU_WALK2: PixelRect[] = [
  ...body.slice(0, -4),
  { x: 4, y: 8, w: 1, h: 1, color: BODY },
  { x: 5, y: 8, w: 1, h: 1, color: BODY },
  { x: 8, y: 5, w: 1, h: 1, color: TAIL_DK },
  { x: 9, y: 4, w: 1, h: 2, color: TAIL },
];
