import type { AgentSpriteState } from "@/shared/types";
import type { PixelRect } from "./clawd";

export const SQUIRTLE_WIDTH = 14;
export const SQUIRTLE_HEIGHT = 14;

const BODY = "#5090d0";
const BODY_LT = "#60a0e0";
const BELLY = "#b8d8f0";
const SHELL = "#aa8844";
const SHELL_DK = "#886633";
const EYE = "#1a1a2e";

const body: PixelRect[] = [
  // Head
  { x: 4, y: 0, w: 6, h: 5, color: BODY },
  { x: 3, y: 1, w: 8, h: 4, color: BODY },
  { x: 5, y: 0, w: 4, h: 4, color: BODY_LT },
  // Eyes
  { x: 5, y: 2, w: 1, h: 2, color: EYE },
  { x: 8, y: 2, w: 1, h: 2, color: EYE },
  // Shell on back
  { x: 3, y: 5, w: 8, h: 5, color: SHELL },
  { x: 4, y: 5, w: 6, h: 4, color: SHELL_DK },
  // Belly over shell
  { x: 5, y: 5, w: 4, h: 4, color: BELLY },
  // Arms
  { x: 2, y: 5, w: 2, h: 2, color: BODY },
  { x: 10, y: 5, w: 2, h: 2, color: BODY },
  // Legs
  { x: 4, y: 10, w: 2, h: 3, color: BODY },
  { x: 8, y: 10, w: 2, h: 3, color: BODY },
  // Tail nub
  { x: 11, y: 8, w: 2, h: 1, color: BODY },
  { x: 12, y: 7, w: 1, h: 2, color: BODY_LT },
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
  { x: 3, y: 5, w: 8, h: 5, color: SHELL },
  { x: 4, y: 5, w: 6, h: 4, color: SHELL_DK },
  { x: 5, y: 5, w: 4, h: 4, color: BELLY },
  // Arms forward
  { x: 1, y: 4, w: 3, h: 2, color: BODY },
  { x: 10, y: 4, w: 3, h: 2, color: BODY },
  { x: 4, y: 10, w: 2, h: 3, color: BODY },
  { x: 8, y: 10, w: 2, h: 3, color: BODY },
  { x: 11, y: 8, w: 2, h: 1, color: BODY },
  { x: 12, y: 7, w: 1, h: 2, color: BODY_LT },
];

export const SQUIRTLE_SPRITES: Record<AgentSpriteState, PixelRect[]> = {
  idle: body,
  typing: typingBody,
  reading: [
    { x: 4, y: 0, w: 6, h: 5, color: BODY },
    { x: 3, y: 1, w: 8, h: 4, color: BODY },
    { x: 5, y: 0, w: 4, h: 4, color: BODY_LT },
    // Half-lidded eyes
    { x: 5, y: 3, w: 2, h: 1, color: EYE },
    { x: 7, y: 3, w: 2, h: 1, color: EYE },
    { x: 3, y: 5, w: 8, h: 5, color: SHELL },
    { x: 4, y: 5, w: 6, h: 4, color: SHELL_DK },
    { x: 5, y: 5, w: 4, h: 4, color: BELLY },
    { x: 2, y: 5, w: 2, h: 2, color: BODY },
    { x: 10, y: 5, w: 2, h: 2, color: BODY },
    { x: 4, y: 10, w: 2, h: 3, color: BODY },
    { x: 8, y: 10, w: 2, h: 3, color: BODY },
    { x: 11, y: 8, w: 2, h: 1, color: BODY },
    { x: 12, y: 7, w: 1, h: 2, color: BODY_LT },
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
    { x: 3, y: 5, w: 8, h: 5, color: SHELL },
    { x: 4, y: 5, w: 6, h: 4, color: SHELL_DK },
    { x: 5, y: 5, w: 4, h: 4, color: BELLY },
    { x: 2, y: 5, w: 2, h: 2, color: BODY },
    { x: 10, y: 4, w: 2, h: 2, color: BODY },
    { x: 12, y: 2, w: 1, h: 2, color: BODY },
    { x: 4, y: 10, w: 2, h: 3, color: BODY },
    { x: 8, y: 10, w: 2, h: 3, color: BODY },
    { x: 11, y: 8, w: 2, h: 1, color: BODY },
    { x: 12, y: 7, w: 1, h: 2, color: BODY_LT },
  ],
};
