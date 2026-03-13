import type { PixelRect } from "./clawd";

export const MAGE_WIDTH = 16;
export const MAGE_HEIGHT = 14;

export interface MageColorConfig {
  name: string;
  robe: string;
  robeHi: string;
  eye: string;
}

export const MAGE_COLORS: MageColorConfig[] = [
  { name: "Blue", robe: "#3355cc", robeHi: "#4466dd", eye: "#88ccff" },
  { name: "Red", robe: "#cc3333", robeHi: "#dd4444", eye: "#ff8888" },
  { name: "Purple", robe: "#8844aa", robeHi: "#9955bb", eye: "#cc88ff" },
  { name: "Orange", robe: "#cc7722", robeHi: "#dd8833", eye: "#ffcc44" },
  { name: "Gold", robe: "#aaaa33", robeHi: "#bbbb44", eye: "#ffff66" },
  { name: "Teal", robe: "#338888", robeHi: "#449999", eye: "#66dddd" },
];

const HAT = "#8B6914";
const HAT_HI = "#9a7a24";
const FACE = "#1a1a2e";
const FEET = "#8B4513";

export function makeMageSprite(color: MageColorConfig): PixelRect[] {
  return [
    { x: 5, y: 0, w: 6, h: 3, color: HAT },
    { x: 4, y: 3, w: 8, h: 2, color: HAT },
    { x: 6, y: 0, w: 4, h: 2, color: HAT_HI },
    { x: 5, y: 5, w: 6, h: 3, color: FACE },
    { x: 6, y: 5, w: 1, h: 1, color: color.eye },
    { x: 9, y: 5, w: 1, h: 1, color: color.eye },
    { x: 5, y: 8, w: 6, h: 4, color: color.robe },
    { x: 3, y: 9, w: 2, h: 3, color: color.robe },
    { x: 11, y: 9, w: 2, h: 3, color: color.robe },
    { x: 6, y: 8, w: 4, h: 3, color: color.robeHi },
    { x: 5, y: 12, w: 2, h: 2, color: FEET },
    { x: 9, y: 12, w: 2, h: 2, color: FEET },
  ];
}

/** Walk frame 1: left foot forward */
export function makeMageWalk1(color: MageColorConfig): PixelRect[] {
  return [
    { x: 5, y: 0, w: 6, h: 3, color: HAT },
    { x: 4, y: 3, w: 8, h: 2, color: HAT },
    { x: 6, y: 0, w: 4, h: 2, color: HAT_HI },
    { x: 5, y: 5, w: 6, h: 3, color: FACE },
    { x: 6, y: 5, w: 1, h: 1, color: color.eye },
    { x: 9, y: 5, w: 1, h: 1, color: color.eye },
    { x: 5, y: 8, w: 6, h: 4, color: color.robe },
    { x: 3, y: 9, w: 2, h: 3, color: color.robe },
    { x: 11, y: 9, w: 2, h: 3, color: color.robe },
    { x: 6, y: 8, w: 4, h: 3, color: color.robeHi },
    { x: 4, y: 12, w: 2, h: 2, color: FEET },
    { x: 10, y: 12, w: 2, h: 2, color: FEET },
  ];
}

/** Walk frame 2: right foot forward */
export function makeMageWalk2(color: MageColorConfig): PixelRect[] {
  return [
    { x: 5, y: 0, w: 6, h: 3, color: HAT },
    { x: 4, y: 3, w: 8, h: 2, color: HAT },
    { x: 6, y: 0, w: 4, h: 2, color: HAT_HI },
    { x: 5, y: 5, w: 6, h: 3, color: FACE },
    { x: 6, y: 5, w: 1, h: 1, color: color.eye },
    { x: 9, y: 5, w: 1, h: 1, color: color.eye },
    { x: 5, y: 8, w: 6, h: 4, color: color.robe },
    { x: 3, y: 9, w: 2, h: 3, color: color.robe },
    { x: 11, y: 9, w: 2, h: 3, color: color.robe },
    { x: 6, y: 8, w: 4, h: 3, color: color.robeHi },
    { x: 6, y: 12, w: 2, h: 2, color: FEET },
    { x: 8, y: 12, w: 2, h: 2, color: FEET },
  ];
}
