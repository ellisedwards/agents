import type { SceneTheme } from "./types";

export const palletTownTheme: SceneTheme = {
  id: "pallet-town",
  name: "Pallet Town",

  timeTints: {
    day: { color: "", opacity: 0, skyColors: ["#88bbee", "#99ccee", "#aaddee"] },
    dawn: { color: "#ff8844", opacity: 0.12, skyColors: ["#cc8866", "#dd9977", "#eeaa88"] },
    night: { color: "#112244", opacity: 0.3, skyColors: ["#1a2244", "#222a4e", "#2a3358"] },
  },

  drawStarsAtNight: true,
  starCount: 10,

  backgroundFeatures: [
    { cx: 60, peak: 10, base: 26, halfWidth: 55, bodyColor: "#5a9a55", capColor: null, shape: "mountain" },
    { cx: 160, peak: 8, base: 26, halfWidth: 65, bodyColor: "#4a8a48", capColor: null, shape: "mountain" },
    { cx: 260, peak: 12, base: 26, halfWidth: 50, bodyColor: "#5a9a55", capColor: null, shape: "mountain" },
  ],

  ground: {
    baseColor1: "#55bb55",
    baseColor2: "#4aaa4a",
    tileSize: 8,
    decorColor: "#66cc60",
    decorCount: 100,
    decorHeight: 2,
  },

  vegetation: {
    type: "round-trees",
    colors: {
      trunk: "#665533",
      trunkLight: "#776644",
      leaf1: "#2a7733",
      leaf2: "#339933",
      leaf3: "#44bb44",
      leaf4: "#55cc55",
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
    color: "#aa9060",
    colorLight: "#bba070",
    colorDark: "#887040",
  },

  hasGuitar: false,

  clock: null,
  plant: null,

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
