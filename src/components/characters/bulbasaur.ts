import type { AgentSpriteState } from "@/shared/types";
import type { PixelRect } from "./clawd";

export const BULBASAUR_WIDTH = 14;
export const BULBASAUR_HEIGHT = 14;

const BODY = "#58a888";
const BODY_LT = "#68b898";
const SPOTS = "#408868";
const BULB = "#3a8833";
const BULB_LT = "#44aa44";
const EYE = "#cc3333";

const body: PixelRect[] = [
  // Bulb on top
  { x: 5, y: 0, w: 4, h: 3, color: BULB },
  { x: 6, y: 0, w: 2, h: 2, color: BULB_LT },
  // Head
  { x: 3, y: 3, w: 8, h: 4, color: BODY },
  { x: 4, y: 2, w: 6, h: 4, color: BODY },
  { x: 5, y: 3, w: 4, h: 3, color: BODY_LT },
  // Eyes (red like the game)
  { x: 5, y: 4, w: 1, h: 1, color: EYE },
  { x: 8, y: 4, w: 1, h: 1, color: EYE },
  // Body with spots
  { x: 3, y: 7, w: 8, h: 4, color: BODY },
  { x: 4, y: 7, w: 6, h: 3, color: BODY_LT },
  { x: 4, y: 8, w: 2, h: 1, color: SPOTS },
  { x: 8, y: 8, w: 2, h: 1, color: SPOTS },
  // Legs (wide stance)
  { x: 2, y: 11, w: 3, h: 2, color: BODY },
  { x: 9, y: 11, w: 3, h: 2, color: BODY },
  // Small front legs
  { x: 2, y: 7, w: 2, h: 2, color: BODY },
  { x: 10, y: 7, w: 2, h: 2, color: BODY },
];

const typingBody: PixelRect[] = [
  { x: 5, y: 0, w: 4, h: 3, color: BULB },
  { x: 6, y: 0, w: 2, h: 2, color: BULB_LT },
  { x: 3, y: 3, w: 8, h: 4, color: BODY },
  { x: 4, y: 2, w: 6, h: 4, color: BODY },
  { x: 5, y: 3, w: 4, h: 3, color: BODY_LT },
  // >_< eyes
  { x: 5, y: 4, w: 1, h: 1, color: EYE },
  { x: 6, y: 5, w: 1, h: 1, color: EYE },
  { x: 8, y: 4, w: 1, h: 1, color: EYE },
  { x: 7, y: 5, w: 1, h: 1, color: EYE },
  { x: 3, y: 7, w: 8, h: 4, color: BODY },
  { x: 4, y: 7, w: 6, h: 3, color: BODY_LT },
  { x: 4, y: 8, w: 2, h: 1, color: SPOTS },
  { x: 8, y: 8, w: 2, h: 1, color: SPOTS },
  // Front legs forward
  { x: 1, y: 6, w: 3, h: 2, color: BODY },
  { x: 10, y: 6, w: 3, h: 2, color: BODY },
  { x: 2, y: 11, w: 3, h: 2, color: BODY },
  { x: 9, y: 11, w: 3, h: 2, color: BODY },
];

export const BULBASAUR_SPRITES: Record<AgentSpriteState, PixelRect[]> = {
  idle: body,
  typing: typingBody,
  reading: [
    { x: 5, y: 0, w: 4, h: 3, color: BULB },
    { x: 6, y: 0, w: 2, h: 2, color: BULB_LT },
    { x: 3, y: 3, w: 8, h: 4, color: BODY },
    { x: 4, y: 2, w: 6, h: 4, color: BODY },
    { x: 5, y: 3, w: 4, h: 3, color: BODY_LT },
    // Half-lidded
    { x: 5, y: 5, w: 2, h: 1, color: EYE },
    { x: 7, y: 5, w: 2, h: 1, color: EYE },
    { x: 3, y: 7, w: 8, h: 4, color: BODY },
    { x: 4, y: 7, w: 6, h: 3, color: BODY_LT },
    { x: 4, y: 8, w: 2, h: 1, color: SPOTS },
    { x: 8, y: 8, w: 2, h: 1, color: SPOTS },
    { x: 2, y: 7, w: 2, h: 2, color: BODY },
    { x: 10, y: 7, w: 2, h: 2, color: BODY },
    { x: 2, y: 11, w: 3, h: 2, color: BODY },
    { x: 9, y: 11, w: 3, h: 2, color: BODY },
  ],
  thinking: body,
  waiting: [
    { x: 5, y: 0, w: 4, h: 3, color: BULB },
    { x: 6, y: 0, w: 2, h: 2, color: BULB_LT },
    { x: 3, y: 3, w: 8, h: 4, color: BODY },
    { x: 4, y: 2, w: 6, h: 4, color: BODY },
    { x: 5, y: 3, w: 4, h: 3, color: BODY_LT },
    // Wide eyes
    { x: 5, y: 4, w: 2, h: 2, color: EYE },
    { x: 7, y: 4, w: 2, h: 2, color: EYE },
    { x: 6, y: 4, w: 1, h: 1, color: BODY_LT },
    { x: 8, y: 4, w: 1, h: 1, color: BODY_LT },
    { x: 3, y: 7, w: 8, h: 4, color: BODY },
    { x: 4, y: 7, w: 6, h: 3, color: BODY_LT },
    { x: 4, y: 8, w: 2, h: 1, color: SPOTS },
    { x: 8, y: 8, w: 2, h: 1, color: SPOTS },
    { x: 2, y: 7, w: 2, h: 2, color: BODY },
    { x: 10, y: 7, w: 2, h: 2, color: BODY },
    { x: 2, y: 11, w: 3, h: 2, color: BODY },
    { x: 9, y: 11, w: 3, h: 2, color: BODY },
  ],
};
