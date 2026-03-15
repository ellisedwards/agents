import type { AgentSpriteState } from "@/shared/types";
import type { PixelRect } from "./clawd";

export const TRAINER_WIDTH = 14;
export const TRAINER_HEIGHT = 14;

const CAP = "#cc3333";
const CAP_BRIM = "#aa2222";
const HAIR = "#222222";
const SKIN = "#f0c8a0";
const EYE = "#1a1a2e";
const JACKET = "#3366cc";
const JACKET_LT = "#4477dd";
const PANTS = "#333344";
const SHOE = "#222222";

const body: PixelRect[] = [
  // Cap
  { x: 4, y: 0, w: 6, h: 2, color: CAP },
  { x: 5, y: 0, w: 4, h: 1, color: CAP },
  { x: 3, y: 2, w: 8, h: 1, color: CAP_BRIM },
  // Hair
  { x: 3, y: 1, w: 1, h: 2, color: HAIR },
  { x: 10, y: 1, w: 1, h: 2, color: HAIR },
  // Face
  { x: 4, y: 3, w: 6, h: 3, color: SKIN },
  // Eyes
  { x: 5, y: 4, w: 1, h: 1, color: EYE },
  { x: 8, y: 4, w: 1, h: 1, color: EYE },
  // Jacket
  { x: 4, y: 6, w: 6, h: 4, color: JACKET },
  { x: 5, y: 6, w: 4, h: 3, color: JACKET_LT },
  // Arms
  { x: 2, y: 6, w: 2, h: 3, color: JACKET },
  { x: 10, y: 6, w: 2, h: 3, color: JACKET },
  // Pants
  { x: 4, y: 10, w: 6, h: 2, color: PANTS },
  // Shoes
  { x: 4, y: 12, w: 2, h: 2, color: SHOE },
  { x: 8, y: 12, w: 2, h: 2, color: SHOE },
];

const typingBody: PixelRect[] = [
  { x: 4, y: 0, w: 6, h: 2, color: CAP },
  { x: 5, y: 0, w: 4, h: 1, color: CAP },
  { x: 3, y: 2, w: 8, h: 1, color: CAP_BRIM },
  { x: 3, y: 1, w: 1, h: 2, color: HAIR },
  { x: 10, y: 1, w: 1, h: 2, color: HAIR },
  { x: 4, y: 3, w: 6, h: 3, color: SKIN },
  // >_< eyes
  { x: 5, y: 4, w: 1, h: 1, color: EYE },
  { x: 6, y: 5, w: 1, h: 1, color: EYE },
  { x: 8, y: 4, w: 1, h: 1, color: EYE },
  { x: 7, y: 5, w: 1, h: 1, color: EYE },
  { x: 4, y: 6, w: 6, h: 4, color: JACKET },
  { x: 5, y: 6, w: 4, h: 3, color: JACKET_LT },
  // Arms forward
  { x: 1, y: 5, w: 3, h: 3, color: JACKET },
  { x: 10, y: 5, w: 3, h: 3, color: JACKET },
  { x: 4, y: 10, w: 6, h: 2, color: PANTS },
  { x: 4, y: 12, w: 2, h: 2, color: SHOE },
  { x: 8, y: 12, w: 2, h: 2, color: SHOE },
];

export const TRAINER_SPRITES: Record<AgentSpriteState, PixelRect[]> = {
  idle: body,
  typing: typingBody,
  reading: [
    { x: 4, y: 0, w: 6, h: 2, color: CAP },
    { x: 5, y: 0, w: 4, h: 1, color: CAP },
    { x: 3, y: 2, w: 8, h: 1, color: CAP_BRIM },
    { x: 3, y: 1, w: 1, h: 2, color: HAIR },
    { x: 10, y: 1, w: 1, h: 2, color: HAIR },
    { x: 4, y: 3, w: 6, h: 3, color: SKIN },
    // Half-lidded
    { x: 5, y: 5, w: 2, h: 1, color: EYE },
    { x: 7, y: 5, w: 2, h: 1, color: EYE },
    { x: 4, y: 6, w: 6, h: 4, color: JACKET },
    { x: 5, y: 6, w: 4, h: 3, color: JACKET_LT },
    { x: 2, y: 6, w: 2, h: 3, color: JACKET },
    { x: 10, y: 6, w: 2, h: 3, color: JACKET },
    { x: 4, y: 10, w: 6, h: 2, color: PANTS },
    { x: 4, y: 12, w: 2, h: 2, color: SHOE },
    { x: 8, y: 12, w: 2, h: 2, color: SHOE },
  ],
  thinking: body,
  waiting: [
    { x: 4, y: 0, w: 6, h: 2, color: CAP },
    { x: 5, y: 0, w: 4, h: 1, color: CAP },
    { x: 3, y: 2, w: 8, h: 1, color: CAP_BRIM },
    { x: 3, y: 1, w: 1, h: 2, color: HAIR },
    { x: 10, y: 1, w: 1, h: 2, color: HAIR },
    { x: 4, y: 3, w: 6, h: 3, color: SKIN },
    // Wide eyes
    { x: 5, y: 4, w: 2, h: 2, color: EYE },
    { x: 7, y: 4, w: 2, h: 2, color: EYE },
    { x: 6, y: 4, w: 1, h: 1, color: SKIN },
    { x: 8, y: 4, w: 1, h: 1, color: SKIN },
    { x: 4, y: 6, w: 6, h: 4, color: JACKET },
    { x: 5, y: 6, w: 4, h: 3, color: JACKET_LT },
    { x: 2, y: 6, w: 2, h: 3, color: JACKET },
    { x: 10, y: 5, w: 2, h: 3, color: JACKET },
    { x: 12, y: 3, w: 1, h: 2, color: JACKET },
    { x: 4, y: 10, w: 6, h: 2, color: PANTS },
    { x: 4, y: 12, w: 2, h: 2, color: SHOE },
    { x: 8, y: 12, w: 2, h: 2, color: SHOE },
  ],
};
