import type { SceneTheme } from "./types";

export const starkMonumentalTheme: SceneTheme = {
  id: "stark-monumental",
  name: "Stark & Monumental",

  timeTints: {
    day: { color: "", opacity: 0, skyColors: ["#88aade", "#a0b8cc", "#c4b8a0"] },
    dawn: { color: "#ee7733", opacity: 0.20, skyColors: ["#bb6644", "#cc7755", "#dd9966"] },
    night: { color: "#0a0a22", opacity: 0.42, skyColors: ["#0e0e28", "#161632", "#1e1e3c"] },
  },

  drawStarsAtNight: true,
  starCount: 20,

  backgroundFeatures: [
    { cx: 160, peak: -2, base: 26, halfWidth: 70, bodyColor: "#c8a060", capColor: "#ddb870", shape: "pyramid" },
    { cx: 60, peak: 10, base: 26, halfWidth: 28, bodyColor: "#b89858", capColor: null, shape: "pyramid" },
    { cx: 280, peak: 12, base: 26, halfWidth: 25, bodyColor: "#b89858", capColor: null, shape: "pyramid" },
  ],

  ground: {
    baseColor1: "#d4b080",
    baseColor2: "#ccaa78",
    tileSize: 8,
    decorColor: "#c4a470",
    decorCount: 30,
    decorHeight: 1,
  },

  vegetation: {
    type: "cacti",
    colors: {
      trunk: "#7a6a40",
      trunkLight: "#8a7a50",
      leaf1: "#5a7a3a",
      leaf2: "#4a6a2a",
      leaf3: "#6a8a4a",
      leaf4: "#5a7a3a",
    },
    density: 0.15,
  },

  building: {
    wallColor: "#c4a068",
    wallDark: "#b89858",
    wallAccent: "#ccaa70",
    floorColor1: "#d0aa70",
    floorColor2: "#c8a268",
    floorEdge1: "#c09a60",
    floorEdge2: "#b89258",
    style: "carved",
  },

  fireVessel: {
    stoneColor: "#a08858",
    stoneBrick: "#a89060",
    stoneLight: "#b09868",
    stoneDark: "#887848",
    interiorColor: "#1a0a0a",
    interiorDeep: "#110505",
    mantleColor: "#907848",
    mantleLight: "#a08858",
    style: "fire-pit",
  },

  glassPanel: {
    frameColor: "#b89858",
    glassColor: "#b8a878",
    glassAlt: "#bcac7c",
    throughGlass: "sky",
    throughColor1: "#c4b8a0",
    throughColor2: "#d4c8b0",
    throughColor3: "#e4d8c0",
  },

  hasGuitar: false,



  clock: null,

  plant: {
    potColor: "#a08050",
    potLight: "#b09060",
    leafColor1: "#5a7a3a",
    leafColor2: "#6a8a4a",
    style: "cactus",
  },

  desk: {
    topColor: "#a08858",
    legColor: "#806838",
    chairBack: "#b09868",
    chairSeat: "#a08858",
    chairLight: "#b8a070",
  },
};
