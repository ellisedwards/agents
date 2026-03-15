import type { AgentSpriteState } from "@/shared/types";
import type { PixelRect } from "./clawd";

export const PIKACHU_WIDTH = 14;
export const PIKACHU_HEIGHT = 14;

const BODY = "#f8d030";
const BODY_LT = "#f8e060";
const EAR_TIP = "#222222";
const CHEEK = "#cc3333";
const EYE = "#1a1a2e";
const STRIPE = "#aa7722";
const TAIL = "#f8d030";
const TAIL_BASE = "#aa7722";

const body: PixelRect[] = [
  // Ears (pointy)
  { x: 2, y: 0, w: 2, h: 3, color: BODY },
  { x: 2, y: 0, w: 1, h: 1, color: EAR_TIP },
  { x: 10, y: 0, w: 2, h: 3, color: BODY },
  { x: 11, y: 0, w: 1, h: 1, color: EAR_TIP },
  // Head
  { x: 3, y: 3, w: 8, h: 5, color: BODY },
  { x: 4, y: 2, w: 6, h: 5, color: BODY },
  { x: 5, y: 3, w: 4, h: 4, color: BODY_LT },
  // Eyes
  { x: 5, y: 4, w: 1, h: 1, color: EYE },
  { x: 8, y: 4, w: 1, h: 1, color: EYE },
  // Red cheeks
  { x: 4, y: 5, w: 1, h: 1, color: CHEEK },
  { x: 9, y: 5, w: 1, h: 1, color: CHEEK },
  // Body
  { x: 4, y: 8, w: 6, h: 3, color: BODY },
  { x: 5, y: 8, w: 4, h: 2, color: BODY_LT },
  // Back stripes
  { x: 4, y: 9, w: 1, h: 1, color: STRIPE },
  { x: 9, y: 9, w: 1, h: 1, color: STRIPE },
  // Arms
  { x: 2, y: 8, w: 2, h: 2, color: BODY },
  { x: 10, y: 8, w: 2, h: 2, color: BODY },
  // Legs
  { x: 4, y: 11, w: 2, h: 2, color: BODY },
  { x: 8, y: 11, w: 2, h: 2, color: BODY },
  // Lightning bolt tail
  { x: 11, y: 6, w: 1, h: 2, color: TAIL_BASE },
  { x: 12, y: 5, w: 1, h: 2, color: TAIL },
  { x: 13, y: 4, w: 1, h: 2, color: TAIL },
  { x: 12, y: 3, w: 1, h: 2, color: TAIL },
];

const typingBody: PixelRect[] = [
  { x: 2, y: 0, w: 2, h: 3, color: BODY },
  { x: 2, y: 0, w: 1, h: 1, color: EAR_TIP },
  { x: 10, y: 0, w: 2, h: 3, color: BODY },
  { x: 11, y: 0, w: 1, h: 1, color: EAR_TIP },
  { x: 3, y: 3, w: 8, h: 5, color: BODY },
  { x: 4, y: 2, w: 6, h: 5, color: BODY },
  { x: 5, y: 3, w: 4, h: 4, color: BODY_LT },
  // >_< eyes
  { x: 5, y: 4, w: 1, h: 1, color: EYE },
  { x: 6, y: 5, w: 1, h: 1, color: EYE },
  { x: 8, y: 4, w: 1, h: 1, color: EYE },
  { x: 7, y: 5, w: 1, h: 1, color: EYE },
  { x: 4, y: 5, w: 1, h: 1, color: CHEEK },
  { x: 9, y: 5, w: 1, h: 1, color: CHEEK },
  { x: 4, y: 8, w: 6, h: 3, color: BODY },
  { x: 5, y: 8, w: 4, h: 2, color: BODY_LT },
  // Arms forward
  { x: 1, y: 7, w: 3, h: 2, color: BODY },
  { x: 10, y: 7, w: 3, h: 2, color: BODY },
  { x: 4, y: 11, w: 2, h: 2, color: BODY },
  { x: 8, y: 11, w: 2, h: 2, color: BODY },
  { x: 11, y: 6, w: 1, h: 2, color: TAIL_BASE },
  { x: 12, y: 5, w: 1, h: 2, color: TAIL },
  { x: 13, y: 4, w: 1, h: 2, color: TAIL },
  { x: 12, y: 3, w: 1, h: 2, color: TAIL },
];

export const PIKACHU_SPRITES: Record<AgentSpriteState, PixelRect[]> = {
  idle: body,
  typing: typingBody,
  reading: [
    { x: 2, y: 0, w: 2, h: 3, color: BODY },
    { x: 2, y: 0, w: 1, h: 1, color: EAR_TIP },
    { x: 10, y: 0, w: 2, h: 3, color: BODY },
    { x: 11, y: 0, w: 1, h: 1, color: EAR_TIP },
    { x: 3, y: 3, w: 8, h: 5, color: BODY },
    { x: 4, y: 2, w: 6, h: 5, color: BODY },
    { x: 5, y: 3, w: 4, h: 4, color: BODY_LT },
    // Half-lidded
    { x: 5, y: 5, w: 2, h: 1, color: EYE },
    { x: 7, y: 5, w: 2, h: 1, color: EYE },
    { x: 4, y: 5, w: 1, h: 1, color: CHEEK },
    { x: 9, y: 5, w: 1, h: 1, color: CHEEK },
    { x: 4, y: 8, w: 6, h: 3, color: BODY },
    { x: 5, y: 8, w: 4, h: 2, color: BODY_LT },
    { x: 2, y: 8, w: 2, h: 2, color: BODY },
    { x: 10, y: 8, w: 2, h: 2, color: BODY },
    { x: 4, y: 11, w: 2, h: 2, color: BODY },
    { x: 8, y: 11, w: 2, h: 2, color: BODY },
    { x: 11, y: 6, w: 1, h: 2, color: TAIL_BASE },
    { x: 12, y: 5, w: 1, h: 2, color: TAIL },
    { x: 13, y: 4, w: 1, h: 2, color: TAIL },
    { x: 12, y: 3, w: 1, h: 2, color: TAIL },
  ],
  thinking: body,
  waiting: [
    { x: 2, y: 0, w: 2, h: 3, color: BODY },
    { x: 2, y: 0, w: 1, h: 1, color: EAR_TIP },
    { x: 10, y: 0, w: 2, h: 3, color: BODY },
    { x: 11, y: 0, w: 1, h: 1, color: EAR_TIP },
    { x: 3, y: 3, w: 8, h: 5, color: BODY },
    { x: 4, y: 2, w: 6, h: 5, color: BODY },
    { x: 5, y: 3, w: 4, h: 4, color: BODY_LT },
    // Wide eyes
    { x: 5, y: 4, w: 2, h: 2, color: EYE },
    { x: 7, y: 4, w: 2, h: 2, color: EYE },
    { x: 6, y: 4, w: 1, h: 1, color: BODY_LT },
    { x: 8, y: 4, w: 1, h: 1, color: BODY_LT },
    { x: 4, y: 5, w: 1, h: 1, color: CHEEK },
    { x: 9, y: 5, w: 1, h: 1, color: CHEEK },
    { x: 4, y: 8, w: 6, h: 3, color: BODY },
    { x: 5, y: 8, w: 4, h: 2, color: BODY_LT },
    { x: 2, y: 8, w: 2, h: 2, color: BODY },
    { x: 10, y: 8, w: 2, h: 2, color: BODY },
    { x: 4, y: 11, w: 2, h: 2, color: BODY },
    { x: 8, y: 11, w: 2, h: 2, color: BODY },
    { x: 11, y: 6, w: 1, h: 2, color: TAIL_BASE },
    { x: 12, y: 5, w: 1, h: 2, color: TAIL },
    { x: 13, y: 4, w: 1, h: 2, color: TAIL },
    { x: 12, y: 3, w: 1, h: 2, color: TAIL },
  ],
};

// Walk frames for subagent wandering
export const PIKACHU_WALK1: PixelRect[] = [
  ...body.slice(0, -4), // everything except legs
  { x: 3, y: 11, w: 2, h: 3, color: BODY },
  { x: 9, y: 11, w: 2, h: 2, color: BODY },
];

export const PIKACHU_WALK2: PixelRect[] = [
  ...body.slice(0, -4),
  { x: 5, y: 11, w: 2, h: 2, color: BODY },
  { x: 7, y: 11, w: 2, h: 3, color: BODY },
];
