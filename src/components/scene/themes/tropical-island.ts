import type { SceneTheme } from "./types";

export const tropicalIslandTheme: SceneTheme = {
  id: "tropical-island",
  name: "Tropical Island",

  timeTints: {
    day: { color: "", opacity: 0, skyColors: ["#55aadd", "#66bbee", "#88ccee"] },
    dawn: { color: "#ff6644", opacity: 0.15, skyColors: ["#cc6655", "#dd7766", "#ee9988"] },
    night: { color: "#081830", opacity: 0.38, skyColors: ["#0a1830", "#121e3a", "#1a2844"] },
  },

  drawStarsAtNight: true,
  starCount: 16,

  backgroundFeatures: [],

  ground: {
    baseColor1: "#d4c490",
    baseColor2: "#ccbc88",
    tileSize: 4,
    decorColor: "#c4b480",
    decorCount: 30,
    decorHeight: 1,
    island: {
      waterColor1: "#2a7a9a",
      waterColor2: "#2680a0",
      waterHighlight: "#44aacc",
      sandEdge: "#c8b888",
      margin: 14,
    },
  },

  vegetation: {
    type: "palms",
    colors: {
      trunk: "#7a5a30",
      trunkLight: "#8a6a40",
      leaf1: "#2a8a3a",
      leaf2: "#3a9a4a",
      leaf3: "#4aaa5a",
      leaf4: "#5abb6a",
    },
    density: 0.3,
  },

  building: {
    wallColor: "#c8b480",
    wallDark: "#b8a470",
    wallAccent: "#d4c090",
    floorColor1: "#d4c090",
    floorColor2: "#ccb888",
    floorEdge1: "#c4b080",
    floorEdge2: "#bca878",
    style: "none",
  },

  fireVessel: {
    stoneColor: "#8a7a60",
    stoneBrick: "#907e68",
    stoneLight: "#9a8a70",
    stoneDark: "#706050",
    interiorColor: "#1a0a0a",
    interiorDeep: "#110505",
    mantleColor: "#706050",
    mantleLight: "#807060",
    style: "fire-pit",
  },

  glassPanel: null,

  posterMount: {
    style: "driftwood",
    color: "#8a7a58",
    colorLight: "#9a8a68",
    colorDark: "#6a5a38",
  },

  hasGuitar: false,


  clock: null,
  plant: null,

  desk: {
    topColor: "#8a7a58",
    legColor: "#6a5a38",
    chairBack: "#9a8a68",
    chairSeat: "#8a7a58",
    chairLight: "#a09068",
    hideChairs: true,
  },
};
