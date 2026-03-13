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
    tileSize: 8,
    decorColor: "#c4b480",
    decorCount: 30,
    decorHeight: 1,
    island: {
      waterColor1: "#2a7a9a",
      waterColor2: "#2680a0",
      waterHighlight: "#44aacc",
      sandColor: "#ddd0a0",
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
    style: "open-air",
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

  glassPanel: {
    frameColor: "#b8a470",
    glassColor: "#4499bb",
    glassAlt: "#4a9dc0",
    throughGlass: "sky",
    throughColor1: "#55aacc",
    throughColor2: "#3388aa",
    throughColor3: "#2278a0",
  },

  hasGuitar: false,

  bookshelf: {
    woodColor: "#7a5a30",
    shelfColor: "#8a6a40",
    bookColors: ["#cc5544", "#44aa88", "#ddaa33", "#5588cc", "#aa6633", "#44bbaa"],
  },

  clock: {
    frameColor: "#7a5a30",
    faceColor: "#f0e8d0",
  },

  plant: {
    potColor: "#7a5a30",
    potLight: "#8a6a40",
    leafColor1: "#3a9a4a",
    leafColor2: "#4aaa5a",
    style: "potted",
  },

  desk: {
    topColor: "#8a7a58",
    legColor: "#6a5a38",
    chairBack: "#9a8a68",
    chairSeat: "#8a7a58",
    chairLight: "#a09068",
  },
};
