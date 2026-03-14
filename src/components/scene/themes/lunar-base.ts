import type { SceneTheme } from "./types";

export const lunarBaseTheme: SceneTheme = {
  id: "lunar-base",
  name: "Lunar Base",

  timeTints: {
    day: { color: "", opacity: 0, skyColors: ["#080810", "#0a0a14", "#0c0c18"] },
    dawn: { color: "#2244aa", opacity: 0.08, skyColors: ["#0a1020", "#101828", "#182030"] },
    night: { color: "#000008", opacity: 0.3, skyColors: ["#040408", "#06060c", "#080810"] },
  },

  drawStarsAtNight: true,
  starCount: 24,

  backgroundFeatures: [],

  ground: {
    baseColor1: "#606068",
    baseColor2: "#585860",
    tileSize: 1,
    decorColor: "#505058",
    decorCount: 40,
    decorHeight: 1,
  },

  vegetation: {
    type: "boulders",
    colors: {
      trunk: "#505058",
      trunkLight: "#606068",
      leaf1: "#404048",
      leaf2: "#484850",
      leaf3: "#585860",
      leaf4: "#606068",
    },
    density: 0.6,
  },

  building: {
    wallColor: "#505058",
    wallDark: "#404048",
    wallAccent: "#585860",
    floorColor1: "#606068",
    floorColor2: "#585860",
    floorEdge1: "#505058",
    floorEdge2: "#484850",
    style: "none",
  },

  fireVessel: {
    stoneColor: "#404048",
    stoneBrick: "#484850",
    stoneLight: "#505058",
    stoneDark: "#303038",
    interiorColor: "#22aacc",
    interiorDeep: "#1188aa",
    mantleColor: "#383840",
    mantleLight: "#484850",
    style: "reactor",
  },

  glassPanel: null,

  posterMount: {
    style: "metal-panel",
    color: "#505058",
    colorLight: "#606068",
    colorDark: "#383840",
  },

  hasGuitar: false,
  clock: null,
  plant: null,

  desk: {
    topColor: "#505058",
    legColor: "#383840",
    chairBack: "#404048",
    chairSeat: "#383840",
    chairLight: "#484850",
    hideChairs: true,
  },
};
