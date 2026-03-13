import type { SceneTheme } from "./types";

export const mysteriousOasisTheme: SceneTheme = {
  id: "mysterious-oasis",
  name: "Mysterious Oasis",

  timeTints: {
    day: { color: "", opacity: 0, skyColors: ["#8a7a9a", "#9a8a7a", "#b8a088"] },
    dawn: { color: "#cc5544", opacity: 0.15, skyColors: ["#8a5a6a", "#aa7a6a", "#cc9a7a"] },
    night: { color: "#0a0820", opacity: 0.40, skyColors: ["#12102a", "#1a1535", "#221a40"] },
  },

  drawStarsAtNight: true,
  starCount: 24,

  backgroundFeatures: [
    { cx: 60, peak: 5, base: 26, halfWidth: 40, bodyColor: "#7a6050", capColor: null, shape: "pyramid" },
    { cx: 160, peak: 1, base: 26, halfWidth: 55, bodyColor: "#8a7060", capColor: "#a08870", shape: "pyramid" },
    { cx: 280, peak: 8, base: 26, halfWidth: 30, bodyColor: "#6a5545", capColor: null, shape: "pyramid" },
  ],

  ground: {
    baseColor1: "#b8956a",
    baseColor2: "#b09060",
    tileSize: 8,
    decorColor: "#a88858",
    decorCount: 40,
    decorHeight: 1,
  },

  vegetation: {
    type: "mixed-desert",
    colors: {
      trunk: "#6a4a28",
      trunkLight: "#7a5a38",
      leaf1: "#3a6a2a",
      leaf2: "#4a7a3a",
      leaf3: "#5a8a4a",
      leaf4: "#6a9a5a",
    },
    density: 0.35,
  },

  building: {
    wallColor: "#6a5a50",
    wallDark: "#5a4a40",
    wallAccent: "#7a6a5a",
    floorColor1: "#7a6a58",
    floorColor2: "#726250",
    floorEdge1: "#6a5a48",
    floorEdge2: "#625240",
    style: "open-air",
  },

  fireVessel: {
    stoneColor: "#5a4a40",
    stoneBrick: "#605048",
    stoneLight: "#6a5a50",
    stoneDark: "#4a3a30",
    interiorColor: "#1a0a0a",
    interiorDeep: "#110505",
    mantleColor: "#5a4a38",
    mantleLight: "#6a5a48",
    style: "brazier",
  },

  glassPanel: {
    frameColor: "#5a4a40",
    glassColor: "#4a6a7a",
    glassAlt: "#4e6e7e",
    throughGlass: "dunes",
    throughColor1: "#8a7a60",
    throughColor2: "#9a8a70",
    throughColor3: "#aa9a80",
  },

  hasGuitar: false,

  bookshelf: {
    woodColor: "#6a4a28",
    shelfColor: "#7a5a38",
    bookColors: ["#5a3a6a", "#8a5a3a", "#3a5a6a", "#6a5a3a", "#4a3a5a", "#7a6a3a"],
  },

  clock: {
    frameColor: "#5a4a40",
    faceColor: "#d8c8a8",
  },

  plant: {
    potColor: "#6a4a28",
    potLight: "#7a5a38",
    leafColor1: "#4a7a3a",
    leafColor2: "#5a8a4a",
    style: "papyrus",
  },

  desk: {
    topColor: "#6a5a48",
    legColor: "#4a3a28",
    chairBack: "#7a6a58",
    chairSeat: "#6a5a48",
    chairLight: "#8a7a68",
  },
};
