import type { AgentSpriteState } from "@/shared/types";
import type { PixelRect } from "./clawd";

export const CLAW_WIDTH = 16;
export const CLAW_HEIGHT = 14;

const BODY = "#cc3333";
const BODY_LIGHT = "#d44444";
const ANTENNA = "#cc3333";
const ANTENNA_TIP = "#dd4444";
const EYE = "#111";
const EYE_DOT = "#333";
const PINCER = "#cc3333";
const PINCER_CLAW = "#bb2222";
const LEG = "#aa2222";
const FOOT = "#882222";

const baseAntennae: PixelRect[] = [
  { x: 5, y: 0, w: 1, h: 2, color: ANTENNA },
  { x: 4, y: 0, w: 1, h: 1, color: ANTENNA_TIP },
  { x: 10, y: 0, w: 1, h: 2, color: ANTENNA },
  { x: 11, y: 0, w: 1, h: 1, color: ANTENNA_TIP },
];
const baseBody: PixelRect[] = [
  { x: 4, y: 2, w: 8, h: 8, color: BODY },
  { x: 3, y: 3, w: 10, h: 6, color: BODY },
  { x: 5, y: 3, w: 6, h: 6, color: BODY_LIGHT },
];
const baseLegs: PixelRect[] = [
  { x: 5, y: 10, w: 2, h: 3, color: LEG },
  { x: 9, y: 10, w: 2, h: 3, color: LEG },
  { x: 5, y: 12, w: 2, h: 1, color: FOOT },
  { x: 9, y: 12, w: 2, h: 1, color: FOOT },
];

export const CLAW_SPRITES: Record<AgentSpriteState, PixelRect[]> = {
  idle: [
    ...baseAntennae,
    ...baseBody,
    { x: 5, y: 4, w: 2, h: 2, color: EYE },
    { x: 6, y: 4, w: 1, h: 1, color: EYE_DOT },
    { x: 9, y: 4, w: 2, h: 2, color: EYE },
    { x: 10, y: 4, w: 1, h: 1, color: EYE_DOT },
    { x: 1, y: 5, w: 2, h: 2, color: PINCER },
    { x: 0, y: 5, w: 1, h: 1, color: PINCER_CLAW },
    { x: 13, y: 5, w: 2, h: 2, color: PINCER },
    { x: 15, y: 5, w: 1, h: 1, color: PINCER_CLAW },
    ...baseLegs,
  ],
  typing: [
    ...baseAntennae,
    ...baseBody,
    { x: 5, y: 5, w: 2, h: 1, color: EYE },
    { x: 6, y: 5, w: 1, h: 1, color: "#222" },
    { x: 9, y: 5, w: 2, h: 1, color: EYE },
    { x: 10, y: 5, w: 1, h: 1, color: "#222" },
    { x: 0, y: 4, w: 3, h: 2, color: PINCER },
    { x: 0, y: 3, w: 1, h: 1, color: PINCER_CLAW },
    { x: 0, y: 6, w: 1, h: 1, color: PINCER_CLAW },
    { x: 13, y: 4, w: 3, h: 2, color: PINCER },
    { x: 15, y: 3, w: 1, h: 1, color: PINCER_CLAW },
    { x: 15, y: 6, w: 1, h: 1, color: PINCER_CLAW },
    ...baseLegs,
  ],
  reading: [
    ...baseAntennae,
    ...baseBody,
    { x: 5, y: 6, w: 2, h: 1, color: EYE },
    { x: 6, y: 6, w: 1, h: 1, color: "#222" },
    { x: 9, y: 6, w: 2, h: 1, color: EYE },
    { x: 10, y: 6, w: 1, h: 1, color: "#222" },
    { x: 2, y: 6, w: 2, h: 2, color: PINCER },
    { x: 12, y: 6, w: 2, h: 2, color: PINCER },
    ...baseLegs,
  ],
  thinking: [
    ...baseAntennae,
    ...baseBody,
    { x: 5, y: 4, w: 2, h: 2, color: EYE },
    { x: 6, y: 4, w: 1, h: 1, color: EYE_DOT },
    { x: 9, y: 4, w: 2, h: 2, color: EYE },
    { x: 10, y: 4, w: 1, h: 1, color: EYE_DOT },
    { x: 1, y: 5, w: 2, h: 2, color: PINCER },
    { x: 0, y: 5, w: 1, h: 1, color: PINCER_CLAW },
    { x: 13, y: 5, w: 2, h: 2, color: PINCER },
    { x: 15, y: 5, w: 1, h: 1, color: PINCER_CLAW },
    ...baseLegs,
  ],
  waiting: [
    { x: 5, y: 0, w: 1, h: 1, color: ANTENNA_TIP },
    { x: 4, y: 0, w: 1, h: 1, color: "#ee5555" },
    { x: 10, y: 0, w: 1, h: 1, color: ANTENNA_TIP },
    { x: 11, y: 0, w: 1, h: 1, color: "#ee5555" },
    { x: 4, y: 1, w: 8, h: 8, color: BODY },
    { x: 3, y: 2, w: 10, h: 6, color: BODY },
    { x: 5, y: 2, w: 6, h: 6, color: BODY_LIGHT },
    { x: 4, y: 3, w: 3, h: 3, color: EYE },
    { x: 6, y: 3, w: 1, h: 1, color: EYE_DOT },
    { x: 9, y: 3, w: 3, h: 3, color: EYE },
    { x: 11, y: 3, w: 1, h: 1, color: EYE_DOT },
    { x: 1, y: 4, w: 2, h: 2, color: PINCER },
    { x: 13, y: 2, w: 2, h: 2, color: PINCER },
    { x: 14, y: 1, w: 2, h: 1, color: PINCER_CLAW },
    { x: 5, y: 9, w: 2, h: 3, color: LEG },
    { x: 9, y: 9, w: 2, h: 3, color: LEG },
    { x: 5, y: 11, w: 2, h: 1, color: FOOT },
    { x: 9, y: 11, w: 2, h: 1, color: FOOT },
  ],
};
