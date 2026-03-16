import type { SceneTheme } from "./types";

export const palletTownTheme: SceneTheme = {
  id: "pallet-town",
  name: "Pallet Town",

  timeTints: {
    day: { color: "", opacity: 0, skyColors: ["#90c0e8", "#a0cce8", "#b0d4e8"] },
    dawn: { color: "#ff8844", opacity: 0.12, skyColors: ["#c08868", "#d09878", "#dca888"] },
    night: { color: "#0a1830", opacity: 0.45, skyColors: ["#0a1428", "#121e38", "#1a2848"] },
  },

  drawStarsAtNight: true,
  starCount: 10,

  backgroundFeatures: [
    { cx: 60, peak: 10, base: 26, halfWidth: 55, bodyColor: "#60b898", capColor: null, shape: "mountain" },
    { cx: 160, peak: 8, base: 26, halfWidth: 65, bodyColor: "#50a888", capColor: null, shape: "mountain" },
    { cx: 260, peak: 12, base: 26, halfWidth: 50, bodyColor: "#60b898", capColor: null, shape: "mountain" },
  ],

  ground: {
    baseColor1: "#88d8a8",
    baseColor2: "#78c898",
    tileSize: 8,
    decorColor: "#98e0b8",
    decorCount: 0,
    decorHeight: 2,
    sandClearing: {
      sandColor1: "#d8c890",
      sandColor2: "#d0c088",
      borderColor: "#70a890",
      inset: [50, 8, 8, 8],
    },
  },

  vegetation: {
    type: "round-trees",
    colors: {
      trunk: "#665533",
      trunkLight: "#776644",
      leaf1: "#408858",
      leaf2: "#50a068",
      leaf3: "#60b878",
      leaf4: "#70c888",
    },
    density: 1.8,
  },

  building: {
    wallColor: "#f0e8d8",
    wallDark: "#e0d8c8",
    wallAccent: "#e8e0d0",
    floorColor1: "#d8c8a0",
    floorColor2: "#d0c098",
    floorEdge1: "#c0b088",
    floorEdge2: "#b8a880",
    style: "none",
  },

  fireVessel: {
    stoneColor: "#7a7a7a",
    stoneBrick: "#6a6a6a",
    stoneLight: "#8a8a8a",
    stoneDark: "#5a5a5a",
    interiorColor: "#1a0a0a",
    interiorDeep: "#110505",
    mantleColor: "#6a6a6a",
    mantleLight: "#7a7a7a",
    style: "fire-pit",
  },

  glassPanel: null,

  posterMount: {
    style: "wooden-sign",
    color: "#8a6a44",
    colorLight: "#a08050",
    colorDark: "#6a4a28",
  },

  hasGuitar: false,

  clock: null,
  plant: null,

  floorOffsetY: 5,

  monolithEffect: { style: "haze", color: "#44cc66", speed: 6 },

  skins: {
    agent: "starter",
    openclaw: "trainer",
    subagent: "pikachu",
  },

  petType: "jigglypuff",

  desk: {
    topColor: "#c8b888",
    legColor: "#aa9060",
    chairBack: "#8a7a5a",
    chairSeat: "#9a8a6a",
    chairLight: "#aa9a7a",
    hideChairs: true,
    hideDesks: true,
  },
};
