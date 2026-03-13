import type { TimeOfDay } from "../environment";

export interface TimeTint {
  color: string;
  opacity: number;
  skyColors: string[];
}

export interface SceneTheme {
  id: string;
  name: string;

  // Time-of-day tints
  timeTints: Record<TimeOfDay, TimeTint>;

  // Sky
  drawStarsAtNight: boolean;
  starCount: number;

  // Background features (mountains/pyramids)
  backgroundFeatures: Array<{
    cx: number;
    peak: number;
    base: number;
    halfWidth: number;
    bodyColor: string;
    capColor: string | null;
    shape: "mountain" | "pyramid";
  }>;

  // Ground
  ground: {
    baseColor1: string;
    baseColor2: string;
    tileSize: number;
    decorColor: string;
    decorCount: number;
    decorHeight: number;
    /** If set, ground is water with an island shape around the building */
    island?: {
      waterColor1: string;
      waterColor2: string;
      waterHighlight: string;
      sandColor: string;
      sandEdge: string;
      /** How many px the sand extends beyond the building bounds */
      margin: number;
    };
  };

  // Vegetation
  vegetation: {
    type: "trees" | "palms" | "cacti" | "mixed-desert";
    colors: {
      trunk: string;
      trunkLight: string;
      leaf1: string;
      leaf2: string;
      leaf3: string;
      leaf4: string;
    };
    /** Density multiplier relative to forest (1.0 = same as forest) */
    density: number;
  };

  // Building/structure
  building: {
    wallColor: string;
    wallDark: string;
    wallAccent: string;
    floorColor1: string;
    floorColor2: string;
    floorEdge1: string;
    floorEdge2: string;
    style: "walled" | "open-air" | "carved";
  };

  // Fireplace / fire vessel
  fireVessel: {
    stoneColor: string;
    stoneBrick: string;
    stoneLight: string;
    stoneDark: string;
    interiorColor: string;
    interiorDeep: string;
    mantleColor: string;
    mantleLight: string;
    style: "fireplace" | "brazier" | "fire-pit";
  };

  // Glass panels / windows
  glassPanel: {
    frameColor: string;
    glassColor: string;
    glassAlt: string;
    /** What shows through the glass */
    throughGlass: "trees" | "desert" | "dunes" | "sky";
    throughColor1: string;
    throughColor2: string;
    throughColor3: string;
  };

  // Furniture
  hasGuitar: boolean;
  bookshelf: {
    woodColor: string;
    shelfColor: string;
    bookColors: string[];
  };
  clock: {
    frameColor: string;
    faceColor: string;
  };
  plant: {
    potColor: string;
    potLight: string;
    leafColor1: string;
    leafColor2: string;
    style: "potted" | "cactus" | "papyrus";
  };

  // Desk
  desk: {
    topColor: string;
    legColor: string;
    chairBack: string;
    chairSeat: string;
    chairLight: string;
  };
}
