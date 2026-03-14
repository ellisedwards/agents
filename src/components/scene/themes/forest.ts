import type { SceneTheme } from "./types";

export const forestTheme: SceneTheme = {
  id: "forest",
  name: "Forest",

  timeTints: {
    day: { color: "", opacity: 0, skyColors: ["#88aadd", "#99bbee", "#aaccee"] },
    dawn: { color: "#ff8844", opacity: 0.15, skyColors: ["#cc7755", "#dd8866", "#ee9977"] },
    night: { color: "#112244", opacity: 0.35, skyColors: ["#1a2244", "#222a4e", "#2a3358"] },
  },

  drawStarsAtNight: true,
  starCount: 12,

  backgroundFeatures: [
    { cx: 70, peak: 4, base: 26, halfWidth: 45, bodyColor: "#667788", capColor: "#ccddee", shape: "mountain" },
    { cx: 170, peak: 0, base: 26, halfWidth: 60, bodyColor: "#778899", capColor: "#ccddee", shape: "mountain" },
    { cx: 270, peak: 6, base: 26, halfWidth: 40, bodyColor: "#667788", capColor: "#ccddee", shape: "mountain" },
  ],

  ground: {
    baseColor1: "#4a9050",
    baseColor2: "#449048",
    tileSize: 8,
    decorColor: "#55a858",
    decorCount: 80,
    decorHeight: 2,
  },

  vegetation: {
    type: "trees",
    colors: {
      trunk: "#553311",
      trunkLight: "#664422",
      leaf1: "#1a5522",
      leaf2: "#2a6633",
      leaf3: "#338844",
      leaf4: "#44aa55",
    },
    density: 1.0,
  },

  building: {
    wallColor: "#555068",
    wallDark: "#444058",
    wallAccent: "#4a4560",
    floorColor1: "#6e6880",
    floorColor2: "#666078",
    floorEdge1: "#565070",
    floorEdge2: "#504a68",
    style: "walled",
  },

  fireVessel: {
    stoneColor: "#5a5050",
    stoneBrick: "#5e5454",
    stoneLight: "#6a6060",
    stoneDark: "#4a4040",
    interiorColor: "#1a0a0a",
    interiorDeep: "#110505",
    mantleColor: "#5a4030",
    mantleLight: "#6a5040",
    style: "fireplace",
  },

  glassPanel: {
    frameColor: "#3a3555",
    glassColor: "#3a7a40",
    glassAlt: "#3d7d44",
    throughGlass: "trees",
    throughColor1: "#2a5a2a",
    throughColor2: "#338844",
    throughColor3: "#44aa55",
  },

  posterMount: {
    style: "wall",
    color: "#555068",
    colorLight: "#6a6080",
    colorDark: "#444058",
  },

  hasGuitar: true,



  clock: null,

  plant: {
    potColor: "#885533",
    potLight: "#996644",
    leafColor1: "#338844",
    leafColor2: "#44aa55",
    style: "potted",
  },

  petType: "cat",

  desk: {
    topColor: "#3a3230",
    legColor: "#1a1210",
    chairBack: "#2a2838",
    chairSeat: "#302e3e",
    chairLight: "#363448",
  },
};
