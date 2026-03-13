import type { SceneTheme } from "./types";

export const goldenRuinsTheme: SceneTheme = {
  id: "golden-ruins",
  name: "Golden Ruins",

  timeTints: {
    day: { color: "", opacity: 0, skyColors: ["#c4956a", "#d4a876", "#e8c48a"] },
    dawn: { color: "#ff6622", opacity: 0.18, skyColors: ["#cc6644", "#dd7755", "#ee8866"] },
    night: { color: "#1a1133", opacity: 0.38, skyColors: ["#1a1530", "#22193a", "#2a2044"] },
  },

  drawStarsAtNight: true,
  starCount: 18,

  backgroundFeatures: [
    { cx: 55, peak: 6, base: 26, halfWidth: 35, bodyColor: "#b8935a", capColor: null, shape: "pyramid" },
    { cx: 150, peak: 0, base: 26, halfWidth: 55, bodyColor: "#c4a060", capColor: "#ddc070", shape: "pyramid" },
    { cx: 250, peak: 4, base: 26, halfWidth: 40, bodyColor: "#b8935a", capColor: null, shape: "pyramid" },
  ],

  ground: {
    baseColor1: "#d4a870",
    baseColor2: "#cca068",
    tileSize: 8,
    decorColor: "#c09860",
    decorCount: 50,
    decorHeight: 1,
  },

  vegetation: {
    type: "palms",
    colors: {
      trunk: "#7a5a30",
      trunkLight: "#8a6a40",
      leaf1: "#4a7a2a",
      leaf2: "#5a8a3a",
      leaf3: "#6a9a4a",
      leaf4: "#7aaa5a",
    },
    density: 0.25,
  },

  building: {
    wallColor: "#b8935a",
    wallDark: "#a08050",
    wallAccent: "#c4a060",
    floorColor1: "#c8a868",
    floorColor2: "#c0a060",
    floorEdge1: "#b89858",
    floorEdge2: "#b09050",
    style: "open-air",
  },

  fireVessel: {
    stoneColor: "#8a7050",
    stoneBrick: "#907858",
    stoneLight: "#a08860",
    stoneDark: "#706040",
    interiorColor: "#1a0a0a",
    interiorDeep: "#110505",
    mantleColor: "#706040",
    mantleLight: "#807050",
    style: "brazier",
  },

  glassPanel: null,

  hasGuitar: false,



  clock: null,

  plant: {
    potColor: "#8a6a40",
    potLight: "#9a7a50",
    leafColor1: "#5a8a3a",
    leafColor2: "#6a9a4a",
    style: "papyrus",
  },

  desk: {
    topColor: "#8a7050",
    legColor: "#6a5030",
    chairBack: "#9a7a50",
    chairSeat: "#8a6a40",
    chairLight: "#a08050",
  },
};
