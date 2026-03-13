import { CANVAS_WIDTH, CANVAS_HEIGHT } from "../canvas-transform";
import type { SceneTheme } from "./themes/types";
import { forestTheme } from "./themes/forest";

const W = CANVAS_WIDTH;
const H = CANVAS_HEIGHT;
const BORDER = 22;

export type TimeOfDay = "day" | "dawn" | "night";

export function getTimeOfDay(): TimeOfDay {
  // Pacific time (America/Los_Angeles)
  const now = new Date();
  const pacific = new Date(
    now.toLocaleString("en-US", { timeZone: "America/Los_Angeles" })
  );
  const hour = pacific.getHours();
  if (hour >= 8 && hour < 18) return "day";
  if ((hour >= 6 && hour < 8) || (hour >= 18 && hour < 20)) return "dawn";
  return "night";
}

export const BUILDING_X = BORDER;
export const BUILDING_Y = BORDER + 4;
export const BUILDING_W = W - BORDER * 2;
export const BUILDING_H = H - BORDER * 2 - 4;
export const FLOOR_Y = BUILDING_Y + 26;
export const FLOOR_H = BUILDING_H - 26;

function rect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  color: string
) {
  ctx.fillStyle = color;
  ctx.fillRect(Math.floor(x), Math.floor(y), Math.ceil(w), Math.ceil(h));
}

function px(ctx: CanvasRenderingContext2D, x: number, y: number, color: string) {
  ctx.fillStyle = color;
  ctx.fillRect(x, y, 1, 1);
}

let seed = 42;
function srand(): number {
  seed = (seed * 16807) % 2147483647;
  return (seed - 1) / 2147483646;
}

function drawSky(ctx: CanvasRenderingContext2D, tod: TimeOfDay, theme: SceneTheme) {
  const sky = theme.timeTints[tod].skyColors;
  rect(ctx, 0, 0, W, 8, sky[0]);
  rect(ctx, 0, 8, W, 8, sky[1]);
  rect(ctx, 0, 16, W, 10, sky[2]);

  if (tod === "night" && theme.drawStarsAtNight) {
    seed = 777;
    for (let i = 0; i < theme.starCount; i++) {
      px(ctx, Math.floor(srand() * W), Math.floor(srand() * 18), "#ffffff");
    }
  }
}

function drawBackgroundFeature(
  ctx: CanvasRenderingContext2D,
  cx: number,
  peak: number,
  base: number,
  halfWidth: number,
  bodyColor: string,
  capColor: string | null,
  shape: "mountain" | "pyramid"
) {
  if (shape === "pyramid") {
    // Left face
    for (let y = peak; y <= base; y++) {
      const progress = (y - peak) / (base - peak);
      const w2 = Math.floor(halfWidth * progress);
      rect(ctx, cx - w2, y, w2, 1, bodyColor);
    }
    // Right face (slightly darker)
    for (let y = peak; y <= base; y++) {
      const progress = (y - peak) / (base - peak);
      const w2 = Math.floor(halfWidth * progress);
      rect(ctx, cx, y, w2, 1, bodyColor);
      if (w2 > 2) {
        ctx.globalAlpha = 0.12;
        rect(ctx, cx + Math.floor(w2 * 0.3), y, w2 - Math.floor(w2 * 0.3), 1, "#000000");
        ctx.globalAlpha = 1;
      }
    }
    if (capColor) {
      const capHeight = Math.floor((base - peak) * 0.15);
      for (let y = peak; y < peak + capHeight; y++) {
        const progress = (y - peak) / (base - peak);
        const w2 = Math.floor(halfWidth * progress);
        rect(ctx, cx - w2, y, w2 * 2, 1, capColor);
      }
    }
  } else {
    for (let y = peak; y <= base; y++) {
      const progress = (y - peak) / (base - peak);
      const w2 = Math.floor(halfWidth * progress);
      rect(ctx, cx - w2, y, w2 * 2, 1, bodyColor);
    }
    if (capColor) {
      const snowHeight = Math.floor((base - peak) * 0.2);
      for (let y = peak; y < peak + snowHeight; y++) {
        const progress = (y - peak) / (base - peak);
        const w2 = Math.floor(halfWidth * progress);
        rect(ctx, cx - w2, y, w2 * 2, 1, capColor);
      }
    }
  }
}

// Precomputed island edge offsets — organic, jagged coastline
// Seeded once so the shape is stable across frames
let islandEdgeCache: number[] | null = null;
function getIslandEdges(): number[] {
  if (islandEdgeCache) return islandEdgeCache;
  const edges: number[] = [];
  const oldSeed = seed;
  seed = 314;
  for (let i = 0; i < H; i++) {
    // Organic wobble: combine two frequencies for natural look
    edges.push(
      Math.floor(srand() * 6) - 3 +
      Math.floor(Math.sin(i * 0.15) * 4) +
      Math.floor(Math.sin(i * 0.07 + 2) * 3)
    );
  }
  seed = oldSeed;
  islandEdgeCache = edges;
  return edges;
}

function isOnIsland(x: number, y: number, margin: number): boolean {
  const bx = BUILDING_X;
  const by = BUILDING_Y;
  const bw = BUILDING_W;
  const bh = BUILDING_H;
  const edges = getIslandEdges();

  const left = bx - margin;
  const right = bx + bw + margin;
  const top = by - margin;
  const bottom = by + bh + margin;

  if (y < top || y >= bottom) return false;

  const edgeIdx = Math.max(0, Math.min(edges.length - 1, y));
  const wobble = edges[edgeIdx];

  // Different wobble for left vs right edge
  const leftEdge = left + wobble;
  const rightEdge = right - edges[(edgeIdx + 50) % edges.length];

  // Softer corners: shrink horizontal extent near top and bottom
  const vy = y < by ? (y - top) / margin : y > by + bh ? (bottom - y) / margin : 1;
  const cornerShrink = Math.floor((1 - vy) * margin * 0.6);

  return x >= leftEdge + cornerShrink && x < rightEdge - cornerShrink;
}

// Cached offscreen island canvas — built once per theme
let islandCanvasCache: { canvas: OffscreenCanvas; themeId: string } | null = null;

function buildIslandCanvas(theme: SceneTheme): OffscreenCanvas {
  const g = theme.ground;
  const island = g.island!;
  const oc = new OffscreenCanvas(W, H);
  const octx = oc.getContext("2d")!;

  // Water background
  for (let ty = 20; ty < H; ty += g.tileSize) {
    for (let tx = 0; tx < W; tx += g.tileSize) {
      octx.fillStyle = (tx / g.tileSize + ty / g.tileSize) % 2 === 0 ? island.waterColor1 : island.waterColor2;
      octx.fillRect(tx, ty, g.tileSize, g.tileSize);
    }
  }

  // Water highlights
  const oldSeed = seed;
  seed = 200;
  for (let i = 0; i < 40; i++) {
    const wx = Math.floor(srand() * W);
    const wy = 20 + Math.floor(srand() * (H - 20));
    if (!isOnIsland(wx, wy, island.margin + 2)) {
      octx.fillStyle = island.waterHighlight;
      octx.fillRect(wx, wy, 2, 1);
    }
  }

  // Island sand — pixel by pixel for organic edge
  for (let y = 20; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (isOnIsland(x, y, island.margin)) {
        if (!isOnIsland(x, y, island.margin - 2)) {
          octx.fillStyle = island.sandEdge;
        } else {
          const sandVariant = (Math.floor(x / g.tileSize) + Math.floor(y / g.tileSize)) % 2;
          octx.fillStyle = sandVariant === 0 ? g.baseColor1 : g.baseColor2;
        }
        octx.fillRect(x, y, 1, 1);
      }
    }
  }

  // Sand decor
  seed = 100;
  for (let i = 0; i < g.decorCount; i++) {
    const dx = Math.floor(srand() * W);
    const dy = 20 + Math.floor(srand() * (H - 20));
    if (isOnIsland(dx, dy, island.margin - 3)) {
      octx.fillStyle = g.decorColor;
      octx.fillRect(dx, dy, 1, g.decorHeight);
    }
  }
  seed = oldSeed;

  return oc;
}

function drawGround(ctx: CanvasRenderingContext2D, theme: SceneTheme) {
  const g = theme.ground;

  if (g.island) {
    // Use cached island canvas (built once)
    if (!islandCanvasCache || islandCanvasCache.themeId !== theme.id) {
      islandCanvasCache = { canvas: buildIslandCanvas(theme), themeId: theme.id };
    }
    ctx.drawImage(islandCanvasCache.canvas, 0, 0);
  } else {
    for (let ty = 20; ty < H; ty += g.tileSize) {
      for (let tx = 0; tx < W; tx += g.tileSize) {
        rect(ctx, tx, ty, g.tileSize, g.tileSize,
          (tx / g.tileSize + ty / g.tileSize) % 2 === 0 ? g.baseColor1 : g.baseColor2);
      }
    }
    seed = 100;
    for (let i = 0; i < g.decorCount; i++) {
      rect(ctx, Math.floor(srand() * W), 20 + Math.floor(srand() * (H - 20)), 1, g.decorHeight, g.decorColor);
    }
  }
}

function drawForestTree(ctx: CanvasRenderingContext2D, x: number, gy: number, variant: number, theme: SceneTheme) {
  const c = theme.vegetation.colors;
  const v = variant % 4;
  if (v === 0) {
    rect(ctx, x - 1, gy - 3, 2, 3, c.trunk);
    rect(ctx, x - 3, gy - 6, 6, 4, c.leaf2);
    rect(ctx, x - 2, gy - 7, 4, 2, c.leaf3);
    rect(ctx, x - 1, gy - 8, 2, 1, c.leaf4);
  } else if (v === 1) {
    rect(ctx, x - 1, gy - 5, 2, 5, c.trunk);
    rect(ctx, x, gy - 4, 1, 4, c.trunkLight);
    rect(ctx, x - 5, gy - 11, 10, 5, c.leaf2);
    rect(ctx, x - 4, gy - 13, 8, 3, c.leaf3);
    rect(ctx, x - 3, gy - 14, 6, 2, c.leaf4);
    rect(ctx, x - 2, gy - 12, 2, 2, "#55bb66");
  } else if (v === 2) {
    rect(ctx, x - 1, gy - 8, 2, 8, c.trunk);
    rect(ctx, x, gy - 6, 1, 6, c.trunkLight);
    rect(ctx, x - 6, gy - 16, 12, 6, c.leaf1);
    rect(ctx, x - 7, gy - 14, 14, 4, c.leaf2);
    rect(ctx, x - 5, gy - 19, 10, 4, c.leaf3);
    rect(ctx, x - 3, gy - 21, 6, 3, c.leaf4);
    rect(ctx, x - 2, gy - 18, 2, 2, "#55bb66");
  } else {
    rect(ctx, x, gy - 6, 2, 6, c.trunk);
    rect(ctx, x - 3, gy - 14, 8, 3, c.leaf2);
    rect(ctx, x - 2, gy - 11, 6, 3, c.leaf2);
    rect(ctx, x - 2, gy - 13, 5, 2, c.leaf3);
    rect(ctx, x - 1, gy - 16, 4, 3, c.leaf4);
    rect(ctx, x, gy - 17, 2, 2, "#55bb66");
  }
}

function drawPalmTree(ctx: CanvasRenderingContext2D, x: number, gy: number, variant: number, theme: SceneTheme) {
  const c = theme.vegetation.colors;
  const v = variant % 3;
  const trunkH = v === 0 ? 14 : v === 1 ? 18 : 12;

  rect(ctx, x, gy - trunkH, 2, trunkH, c.trunk);
  rect(ctx, x + 1, gy - trunkH + 2, 1, trunkH - 4, c.trunkLight);

  if (v === 1) {
    rect(ctx, x - 1, gy - trunkH, 2, 4, c.trunk);
    rect(ctx, x, gy - trunkH + 4, 2, 2, c.trunk);
  }

  const topY = gy - trunkH - 1;
  rect(ctx, x - 6, topY, 7, 2, c.leaf2);
  rect(ctx, x - 8, topY + 1, 4, 2, c.leaf3);
  rect(ctx, x - 4, topY - 1, 4, 2, c.leaf4);
  rect(ctx, x + 1, topY, 7, 2, c.leaf2);
  rect(ctx, x + 6, topY + 1, 4, 2, c.leaf3);
  rect(ctx, x + 2, topY - 1, 4, 2, c.leaf4);
  rect(ctx, x - 2, topY - 2, 6, 2, c.leaf4);
  if (v === 0) {
    px(ctx, x - 1, topY + 1, "#8a6a30");
    px(ctx, x + 2, topY + 1, "#8a6a30");
  }
}

function drawCactus(ctx: CanvasRenderingContext2D, x: number, gy: number, variant: number, theme: SceneTheme) {
  const c = theme.vegetation.colors;
  const v = variant % 3;

  if (v === 0) {
    rect(ctx, x, gy - 12, 3, 12, c.leaf2);
    rect(ctx, x + 1, gy - 12, 1, 12, c.leaf3);
    rect(ctx, x - 3, gy - 8, 3, 2, c.leaf2);
    rect(ctx, x - 3, gy - 10, 2, 3, c.leaf2);
    rect(ctx, x + 3, gy - 6, 3, 2, c.leaf2);
    rect(ctx, x + 4, gy - 9, 2, 4, c.leaf2);
  } else if (v === 1) {
    rect(ctx, x - 1, gy - 5, 4, 5, c.leaf2);
    rect(ctx, x, gy - 6, 2, 1, c.leaf3);
    rect(ctx, x, gy - 5, 2, 4, c.leaf3);
    px(ctx, x, gy - 7, "#ee6688");
    px(ctx, x + 1, gy - 7, "#ff88aa");
  } else {
    rect(ctx, x - 1, gy - 4, 4, 4, c.leaf2);
    rect(ctx, x - 3, gy - 6, 3, 4, c.leaf3);
    rect(ctx, x + 2, gy - 7, 3, 4, c.leaf2);
    rect(ctx, x, gy - 5, 2, 3, c.leaf3);
  }
}

function drawDesertBush(ctx: CanvasRenderingContext2D, x: number, gy: number, variant: number, _theme: SceneTheme) {
  const v = variant % 2;
  if (v === 0) {
    rect(ctx, x - 2, gy - 2, 5, 2, "#8a7a50");
    rect(ctx, x - 1, gy - 3, 3, 1, "#7a6a40");
  } else {
    rect(ctx, x - 2, gy - 3, 4, 3, "#8a7a50");
    rect(ctx, x - 1, gy - 4, 2, 1, "#7a6a40");
  }
}

function drawVegetation(ctx: CanvasRenderingContext2D, x: number, gy: number, variant: number, theme: SceneTheme) {
  switch (theme.vegetation.type) {
    case "trees":
      drawForestTree(ctx, x, gy, variant, theme);
      break;
    case "palms":
      if (variant % 3 === 0) drawPalmTree(ctx, x, gy, variant, theme);
      else drawDesertBush(ctx, x, gy, variant, theme);
      break;
    case "cacti":
      if (variant % 3 === 0) drawCactus(ctx, x, gy, variant, theme);
      else drawDesertBush(ctx, x, gy, variant, theme);
      break;
    case "mixed-desert":
      if (variant % 4 === 0) drawPalmTree(ctx, x, gy, variant, theme);
      else if (variant % 4 === 1) drawCactus(ctx, x, gy, variant, theme);
      else drawDesertBush(ctx, x, gy, variant, theme);
      break;
  }
}

function drawFlames(ctx: CanvasRenderingContext2D, fpx: number, fpy: number, frame: number) {
  const f = Math.floor(frame / 8) % 5;

  rect(ctx, fpx + 6, fpy + 19, 12, 2, "#553311");
  rect(ctx, fpx + 7, fpy + 18, 4, 2, "#664422");
  rect(ctx, fpx + 13, fpy + 18, 4, 2, "#664422");

  if (f === 0) {
    rect(ctx, fpx + 8, fpy + 15, 8, 3, "#aa3300");
    rect(ctx, fpx + 9, fpy + 14, 6, 3, "#cc4411");
    rect(ctx, fpx + 7, fpy + 14, 2, 2, "#cc4411");
    rect(ctx, fpx + 10, fpy + 13, 4, 2, "#ee6622");
    rect(ctx, fpx + 11, fpy + 12, 2, 2, "#ffaa33");
    px(ctx, fpx + 8, fpy + 13, "#ee6622");
    px(ctx, fpx + 11, fpy + 11, "#ffdd66");
    px(ctx, fpx + 7, fpy + 20, "#ff8833");
    px(ctx, fpx + 14, fpy + 20, "#cc4400");
  } else if (f === 1) {
    rect(ctx, fpx + 8, fpy + 15, 8, 3, "#aa3300");
    rect(ctx, fpx + 10, fpy + 14, 6, 3, "#cc4411");
    rect(ctx, fpx + 15, fpy + 15, 2, 2, "#aa3300");
    rect(ctx, fpx + 11, fpy + 13, 4, 2, "#ee6622");
    rect(ctx, fpx + 12, fpy + 12, 3, 2, "#ffaa33");
    px(ctx, fpx + 13, fpy + 11, "#ffdd66");
    px(ctx, fpx + 15, fpy + 20, "#ffaa44");
    px(ctx, fpx + 11, fpy + 20, "#ff6622");
  } else if (f === 2) {
    rect(ctx, fpx + 7, fpy + 15, 10, 3, "#aa3300");
    rect(ctx, fpx + 8, fpy + 14, 8, 3, "#cc4411");
    rect(ctx, fpx + 9, fpy + 13, 3, 2, "#ee6622");
    rect(ctx, fpx + 13, fpy + 13, 2, 2, "#ee6622");
    px(ctx, fpx + 10, fpy + 12, "#ffaa33");
    px(ctx, fpx + 13, fpy + 12, "#ffaa33");
    px(ctx, fpx + 7, fpy + 20, "#ff8833");
    px(ctx, fpx + 15, fpy + 20, "#ffaa44");
    px(ctx, fpx + 11, fpy + 20, "#ff6622");
  } else if (f === 3) {
    rect(ctx, fpx + 8, fpy + 15, 8, 3, "#aa3300");
    rect(ctx, fpx + 8, fpy + 14, 6, 3, "#cc4411");
    rect(ctx, fpx + 14, fpy + 14, 2, 2, "#cc4411");
    rect(ctx, fpx + 9, fpy + 13, 4, 2, "#ee6622");
    rect(ctx, fpx + 9, fpy + 12, 2, 2, "#ffaa33");
    px(ctx, fpx + 15, fpy + 13, "#ee6622");
    px(ctx, fpx + 10, fpy + 11, "#ffdd66");
    px(ctx, fpx + 7, fpy + 20, "#ff8833");
    px(ctx, fpx + 11, fpy + 20, "#cc4400");
  } else {
    rect(ctx, fpx + 8, fpy + 15, 8, 3, "#aa3300");
    rect(ctx, fpx + 8, fpy + 14, 4, 3, "#cc4411");
    rect(ctx, fpx + 13, fpy + 14, 3, 3, "#cc4411");
    rect(ctx, fpx + 9, fpy + 13, 2, 2, "#ee6622");
    rect(ctx, fpx + 13, fpy + 13, 2, 2, "#ee6622");
    px(ctx, fpx + 9, fpy + 12, "#ffaa33");
    px(ctx, fpx + 14, fpy + 12, "#ffaa33");
    px(ctx, fpx + 10, fpy + 12, "#ffdd66");
    px(ctx, fpx + 15, fpy + 20, "#ffaa44");
    px(ctx, fpx + 7, fpy + 20, "#ff6622");
  }
}

function drawFireVessel(ctx: CanvasRenderingContext2D, fpx: number, fpy: number, frame: number, theme: SceneTheme) {
  const fv = theme.fireVessel;

  if (fv.style === "fireplace") {
    rect(ctx, fpx, fpy, 24, 24, fv.stoneColor);
    rect(ctx, fpx + 1, fpy, 22, 1, fv.stoneLight);
    rect(ctx, fpx, fpy, 1, 24, fv.stoneLight);
    rect(ctx, fpx + 23, fpy, 1, 24, fv.stoneDark);
    for (let sy = 0; sy < 24; sy += 4) {
      for (let sx = 0; sx < 24; sx += 6) {
        const off = (sy / 4) % 2 === 0 ? 0 : 3;
        rect(ctx, fpx + ((sx + off) % 24), fpy + sy, 5, 3, fv.stoneBrick);
        rect(ctx, fpx + ((sx + off) % 24), fpy + sy, 5, 1, fv.stoneLight);
      }
    }
    rect(ctx, fpx + 4, fpy + 6, 16, 17, fv.interiorColor);
    rect(ctx, fpx + 5, fpy + 7, 14, 15, fv.interiorDeep);
    drawFlames(ctx, fpx, fpy, frame);
    rect(ctx, fpx - 2, fpy + 2, 28, 3, fv.mantleColor);
    rect(ctx, fpx - 2, fpy + 2, 28, 1, fv.mantleLight);
  } else if (fv.style === "brazier") {
    // Ancient Egyptian brazier — wide bowl on a pedestal
    rect(ctx, fpx + 6, fpy + 20, 12, 4, fv.stoneColor);
    rect(ctx, fpx + 7, fpy + 20, 10, 1, fv.stoneLight);
    rect(ctx, fpx + 8, fpy + 12, 8, 8, fv.stoneDark);
    rect(ctx, fpx + 9, fpy + 12, 6, 8, fv.stoneColor);
    px(ctx, fpx + 10, fpy + 14, fv.mantleColor);
    px(ctx, fpx + 12, fpy + 15, fv.mantleColor);
    px(ctx, fpx + 11, fpy + 17, fv.mantleColor);
    rect(ctx, fpx + 4, fpy + 8, 16, 5, fv.stoneColor);
    rect(ctx, fpx + 3, fpy + 9, 18, 3, fv.stoneColor);
    rect(ctx, fpx + 5, fpy + 8, 14, 1, fv.stoneLight);
    rect(ctx, fpx + 5, fpy + 9, 14, 3, fv.interiorColor);
    rect(ctx, fpx + 6, fpy + 9, 12, 2, fv.interiorDeep);
    drawFlames(ctx, fpx, fpy - 4, frame);
    rect(ctx, fpx + 3, fpy + 8, 18, 1, fv.mantleColor);
    px(ctx, fpx + 3, fpy + 9, fv.mantleLight);
    px(ctx, fpx + 20, fpy + 9, fv.mantleLight);
  } else {
    // Fire pit — stone ring on ground
    rect(ctx, fpx + 3, fpy + 14, 18, 10, fv.stoneColor);
    rect(ctx, fpx + 4, fpy + 14, 16, 1, fv.stoneLight);
    for (let i = 0; i < 6; i++) {
      const sx = fpx + 4 + i * 3;
      rect(ctx, sx, fpy + 14, 2, 2, fv.stoneBrick);
      rect(ctx, sx, fpy + 22, 2, 2, fv.stoneBrick);
    }
    rect(ctx, fpx + 3, fpy + 16, 2, 6, fv.stoneBrick);
    rect(ctx, fpx + 19, fpy + 16, 2, 6, fv.stoneBrick);
    rect(ctx, fpx + 5, fpy + 16, 14, 6, fv.interiorColor);
    rect(ctx, fpx + 6, fpy + 17, 12, 4, fv.interiorDeep);
    drawFlames(ctx, fpx, fpy - 2, frame);
  }

  const glowAlpha = 0.04 + 0.03 * Math.sin(frame * 0.08);
  rect(ctx, fpx - 2, fpy + 24, 28, 6, `rgba(255,120,40,${glowAlpha.toFixed(3)})`);
}

function drawBuilding(ctx: CanvasRenderingContext2D, frame: number, theme: SceneTheme) {
  const bx = BUILDING_X;
  const by = BUILDING_Y;
  const bw = BUILDING_W;
  const bh = BUILDING_H;
  const b = theme.building;

  if (b.style === "none") {
    // No building — open workspace on the ground. Skip walls entirely.
  } else if (b.style === "walled") {
    rect(ctx, bx, by, bw, bh, b.wallColor);
    rect(ctx, bx, by, bw, 2, b.wallDark);
    rect(ctx, bx, by, 3, bh, b.wallDark);
    rect(ctx, bx + bw - 3, by, 3, bh, b.wallDark);
    for (let wy = by + 5; wy < by + 24; wy += 5) {
      rect(ctx, bx + 4, wy, bw - 8, 1, b.wallAccent);
    }
  } else if (b.style === "open-air") {
    rect(ctx, bx, by, bw, bh, b.wallColor);
    rect(ctx, bx, by, 3, bh * 0.6, b.wallDark);
    rect(ctx, bx + bw - 3, by, 3, bh * 0.7, b.wallDark);
    rect(ctx, bx, by, bw, 8, b.wallDark);
    rect(ctx, bx + 3, by + 2, bw - 6, 4, b.wallAccent);
    for (let cy = by + 12; cy < by + bh; cy += 20) {
      rect(ctx, bx, cy, 4, 8, b.wallDark);
      rect(ctx, bx + 1, cy, 2, 1, b.wallAccent);
      rect(ctx, bx + bw - 4, cy, 4, 8, b.wallDark);
      rect(ctx, bx + bw - 3, cy, 2, 1, b.wallAccent);
    }
    for (let hx = bx + 10; hx < bx + bw - 10; hx += 12) {
      px(ctx, hx, by + 4, b.wallAccent);
      px(ctx, hx + 2, by + 3, b.wallAccent);
      px(ctx, hx + 1, by + 5, b.wallAccent);
    }
  } else {
    rect(ctx, bx, by, bw, bh, b.wallColor);
    rect(ctx, bx, by, bw, 3, b.wallDark);
    rect(ctx, bx, by, 4, bh, b.wallDark);
    rect(ctx, bx + bw - 4, by, 4, bh, b.wallDark);
    rect(ctx, bx + 4, by + 3, bw - 8, 3, b.wallAccent);
    rect(ctx, bx + 4, by + 3, bw - 8, 1, b.wallDark);
    for (let sy = by + 8; sy < by + 24; sy += 6) {
      for (let sx = bx + 5; sx < bx + bw - 5; sx += 8) {
        const off = ((sy - by) / 6) % 2 === 0 ? 0 : 4;
        rect(ctx, sx + off, sy, 7, 5, b.wallAccent);
        rect(ctx, sx + off, sy, 7, 1, b.wallColor);
      }
    }
  }

  // Fire vessel
  const fpx = bx + 5;
  const fpy = by + 2;
  drawFireVessel(ctx, fpx, fpy, frame, theme);

  // Glass panels / openings (skip if theme has no glass)
  const gp = theme.glassPanel;
  if (gp) {
  const glassY = by + 3;
  const glassH = 20;
  const glassStart = fpx + 28;
  const glassEnd = bx + bw - 10;
  const panelCount = 3;
  const glassGap = 4;
  const panelW = Math.floor(
    (glassEnd - glassStart - glassGap * (panelCount - 1)) / panelCount
  );
  for (let p = 0; p < panelCount; p++) {
    const gpx = glassStart + p * (panelW + glassGap);
    rect(ctx, gpx, glassY, panelW, glassH, gp.frameColor);
    rect(ctx, gpx + 1, glassY + 1, panelW - 2, glassH - 2, gp.glassColor);
    for (let gy = 0; gy < glassH - 2; gy += 3) {
      for (let gx = 0; gx < panelW - 2; gx += 3) {
        rect(ctx, gpx + 1 + gx, glassY + 1 + gy, 3, 3,
          (gx / 3 + gy / 3) % 2 === 0 ? gp.glassAlt : gp.glassColor);
      }
    }
    if (gp.throughGlass === "trees") {
      const treeClusters = [
        { dx: Math.floor(panelW * 0.25), dy: Math.floor(glassH * 0.35), r: 3 },
        { dx: Math.floor(panelW * 0.65), dy: Math.floor(glassH * 0.55), r: 2 },
        { dx: Math.floor(panelW * 0.45), dy: Math.floor(glassH * 0.7), r: 2 },
      ];
      for (const t of treeClusters) {
        const cx = Math.max(gpx + 2 + t.r, Math.min(gpx + panelW - 2 - t.r, gpx + t.dx));
        const cy = Math.max(glassY + 2 + t.r, Math.min(glassY + glassH - 2 - t.r, glassY + t.dy));
        rect(ctx, cx - t.r, cy - t.r + 1, t.r * 2, t.r * 2, gp.throughColor1);
        rect(ctx, cx - t.r + 1, cy - t.r, t.r * 2 - 2, t.r * 2 - 1, gp.throughColor2);
        px(ctx, cx - 1, cy - t.r + 1, gp.throughColor3);
      }
    } else if (gp.throughGlass === "desert" || gp.throughGlass === "dunes") {
      const horizonY = glassY + Math.floor(glassH * 0.5);
      rect(ctx, gpx + 1, glassY + 1, panelW - 2, horizonY - glassY - 1, gp.glassColor);
      rect(ctx, gpx + 1, horizonY, panelW - 2, glassY + glassH - 2 - horizonY, gp.throughColor1);
      for (let dx = 0; dx < panelW - 4; dx += 6) {
        const dh = 2 + (dx % 3);
        rect(ctx, gpx + 2 + dx, horizonY - dh, 5, dh, gp.throughColor2);
      }
    } else {
      rect(ctx, gpx + 1, glassY + 1, panelW - 2, glassH - 2, gp.throughColor1);
      rect(ctx, gpx + 1, glassY + Math.floor(glassH * 0.6), panelW - 2,
        Math.floor(glassH * 0.38), gp.throughColor2);
    }
    rect(ctx, gpx + 1, glassY + 1, panelW - 2, glassH - 2, "rgba(100,120,160,0.08)");
    rect(ctx, gpx + 2, glassY + 2, Math.floor(panelW * 0.3), 1, "rgba(255,255,255,0.15)");
    rect(ctx, gpx + Math.floor(panelW / 2), glassY + 1, 1, glassH - 2, "rgba(60,55,80,0.3)");
  }
  } // end glass panels

  // Floor (skip for "none" — ground already visible)
  const fy = FLOOR_Y;
  const fh = FLOOR_H;
  if (b.style !== "none") {
    rect(ctx, bx + 3, fy, bw - 6, fh, b.floorColor1);
    for (let row = 0; row < fh; row += 4) {
      for (let col = 0; col < bw - 6; col += 4) {
        rect(ctx, bx + 3 + col, fy + row, 4, 4, (col / 4 + row / 4) % 2 === 0 ? b.floorColor1 : b.floorColor2);
      }
    }
    rect(ctx, bx + 3, fy, bw - 6, 2, b.floorEdge1);
    rect(ctx, bx + 3, fy, bw - 6, 1, b.floorEdge2);
  }

  // Guitar (only in themes that have it)
  if (theme.hasGuitar) {
    const guitarX = bx + bw - 18;
    const guitarY = by + 3;
    rect(ctx, guitarX + 2, guitarY, 3, 2, "#555");
    rect(ctx, guitarX + 1, guitarY + 1, 5, 3, "#111");
    rect(ctx, guitarX + 1, guitarY + 1, 5, 1, "#222");
    px(ctx, guitarX, guitarY + 2, "#888");
    px(ctx, guitarX + 6, guitarY + 2, "#888");
    rect(ctx, guitarX + 3, guitarY + 4, 1, 12, "#664422");
    for (let f = 0; f < 5; f++) {
      px(ctx, guitarX + 3, guitarY + 5 + f * 2, "#887766");
    }
    rect(ctx, guitarX + 1, guitarY + 16, 5, 8, "#ddee00");
    rect(ctx, guitarX, guitarY + 17, 7, 6, "#ddee00");
    rect(ctx, guitarX + 1, guitarY + 17, 4, 4, "#eeff33");
    rect(ctx, guitarX + 5, guitarY + 15, 2, 2, "#ccdd00");
    rect(ctx, guitarX + 1, guitarY + 19, 4, 1, "#fff");
    rect(ctx, guitarX + 1, guitarY + 21, 4, 1, "#fff");
    rect(ctx, guitarX - 1, guitarY + 14, 9, 12, "rgba(220,238,0,0.04)");

    const ampX = guitarX - 5;
    const ampY = fy + 2;
    rect(ctx, ampX, ampY, 18, 14, "#1a1a1a");
    rect(ctx, ampX + 1, ampY + 1, 16, 12, "#222");
    rect(ctx, ampX + 1, ampY + 1, 16, 3, "#999");
    rect(ctx, ampX + 1, ampY + 1, 16, 1, "#bbb");
    rect(ctx, ampX + 4, ampY + 2, 10, 1, "#ddd");
    for (let k = 0; k < 5; k++) {
      px(ctx, ampX + 3 + k * 2, ampY + 3, "#555");
    }
    rect(ctx, ampX + 2, ampY + 5, 14, 7, "#2a2a2a");
    for (let sy = 0; sy < 7; sy += 2) {
      for (let sx = 0; sx < 14; sx += 2) {
        px(ctx, ampX + 2 + sx, ampY + 5 + sy, "#333");
      }
    }
    rect(ctx, ampX + 3, ampY + 6, 5, 5, "#181818");
    rect(ctx, ampX + 10, ampY + 6, 5, 5, "#181818");
    px(ctx, ampX + 5, ampY + 8, "#252525");
    px(ctx, ampX + 12, ampY + 8, "#252525");
    ctx.strokeStyle = "#333";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(guitarX + 3, guitarY + 24);
    ctx.lineTo(guitarX + 3, fy);
    ctx.lineTo(ampX + 9, ampY);
    ctx.stroke();
  }

  // Bookshelf
  if (theme.bookshelf) {
    const sh = theme.bookshelf;
    const shX = bx + 4;
    const shY = fy + 2;
    rect(ctx, shX, shY, 10, 22, sh.woodColor);
    rect(ctx, shX, shY, 10, 1, sh.shelfColor);
    rect(ctx, shX, shY + 7, 10, 1, sh.shelfColor);
    rect(ctx, shX, shY + 14, 10, 1, sh.shelfColor);
    for (let s = 0; s < 3; s++) {
      let bkX = shX + 1;
      for (let i = 0; i < 2; i++) {
        rect(ctx, bkX, shY + 1 + s * 7, 3, 5, sh.bookColors[s * 2 + i]);
        rect(ctx, bkX, shY + 1 + s * 7, 3, 1, "rgba(255,255,255,0.15)");
        bkX += 4;
      }
    }
  }

  // Wall clock
  if (theme.clock) {
    const cl = theme.clock;
    rect(ctx, bx + 6, by + 5, 6, 6, cl.frameColor);
    rect(ctx, bx + 7, by + 6, 4, 4, cl.faceColor);
    px(ctx, bx + 9, by + 7, "#111");
    px(ctx, bx + 9, by + 8, "#111");
    px(ctx, bx + 10, by + 8, "#cc3333");
  }

  // Plant
  if (theme.plant) {
    const pl = theme.plant;
    const plx = bx + 6;
    const ply = fy + fh - 6;
    if (pl.style === "potted") {
      rect(ctx, plx, ply, 5, 4, pl.potColor);
      rect(ctx, plx + 1, ply, 3, 1, pl.potLight);
      rect(ctx, plx + 1, ply - 7, 3, 8, pl.leafColor1);
      rect(ctx, plx - 1, ply - 5, 2, 4, pl.leafColor2);
      rect(ctx, plx + 4, ply - 4, 2, 3, pl.leafColor2);
    } else if (pl.style === "cactus") {
      rect(ctx, plx, ply, 5, 4, pl.potColor);
      rect(ctx, plx + 1, ply, 3, 1, pl.potLight);
      rect(ctx, plx + 1, ply - 6, 3, 7, pl.leafColor1);
      rect(ctx, plx + 2, ply - 6, 1, 7, pl.leafColor2);
      rect(ctx, plx - 1, ply - 3, 2, 1, pl.leafColor1);
      rect(ctx, plx - 1, ply - 5, 1, 3, pl.leafColor1);
      rect(ctx, plx + 4, ply - 2, 2, 1, pl.leafColor1);
      rect(ctx, plx + 5, ply - 4, 1, 3, pl.leafColor1);
    } else {
      // Papyrus
      rect(ctx, plx, ply, 5, 4, pl.potColor);
      rect(ctx, plx + 1, ply, 3, 1, pl.potLight);
      rect(ctx, plx + 2, ply - 8, 1, 9, pl.leafColor1);
      rect(ctx, plx, ply - 9, 5, 2, pl.leafColor2);
      rect(ctx, plx - 1, ply - 8, 7, 1, pl.leafColor1);
      rect(ctx, plx + 1, ply - 10, 3, 1, pl.leafColor2);
    }
  }
}

function drawBackgroundTrees(ctx: CanvasRenderingContext2D, theme: SceneTheme) {
  seed = 500;
  const count = Math.floor(16 * theme.vegetation.density);
  if (count <= 0) return;
  const spacing = Math.floor(W / count);
  for (let i = 0; i < count; i++) {
    drawVegetation(
      ctx,
      Math.floor(spacing * 0.5) + i * spacing + Math.floor(srand() * 6),
      28 + Math.floor(srand() * 4),
      Math.floor(srand() * 4),
      theme
    );
  }
}

function drawSideTrees(ctx: CanvasRenderingContext2D, theme: SceneTheme) {
  if (theme.vegetation.density <= 0) return;

  const leftBase = [
    { x: 10, y: 42, v: 2 }, { x: 18, y: 68, v: 1 }, { x: 6, y: 88, v: 3 },
    { x: 16, y: 110, v: 0 }, { x: 8, y: 130, v: 1 }, { x: 14, y: 155, v: 2 },
    { x: 6, y: 175, v: 0 }, { x: 18, y: 195, v: 3 },
  ];
  const rightBase = [
    { x: 306, y: 44, v: 2 }, { x: 312, y: 70, v: 3 }, { x: 302, y: 92, v: 1 },
    { x: 310, y: 115, v: 0 }, { x: 304, y: 138, v: 2 }, { x: 314, y: 160, v: 1 },
    { x: 300, y: 180, v: 3 }, { x: 308, y: 198, v: 0 },
  ];
  const frontBase = [
    { x: 40, y: 198, v: 0 }, { x: 80, y: 196, v: 1 }, { x: 130, y: 198, v: 0 },
    { x: 180, y: 195, v: 3 }, { x: 220, y: 198, v: 0 }, { x: 260, y: 196, v: 1 },
  ];

  const keep = (i: number, total: number) => i < Math.ceil(total * theme.vegetation.density);

  for (let i = 0; i < leftBase.length; i++) {
    if (keep(i, leftBase.length)) drawVegetation(ctx, leftBase[i].x, leftBase[i].y, leftBase[i].v, theme);
  }
  for (let i = 0; i < rightBase.length; i++) {
    if (keep(i, rightBase.length)) drawVegetation(ctx, rightBase[i].x, rightBase[i].y, rightBase[i].v, theme);
  }
  for (let i = 0; i < frontBase.length; i++) {
    if (keep(i, frontBase.length)) drawVegetation(ctx, frontBase[i].x, frontBase[i].y, frontBase[i].v, theme);
  }
}

function drawDesk(
  ctx: CanvasRenderingContext2D,
  dx: number,
  dy: number,
  hasLaptop: boolean,
  theme: SceneTheme
) {
  const d = theme.desk;
  rect(ctx, dx - 3, dy - 1, 6, 3, d.chairBack);
  rect(ctx, dx - 3, dy + 2, 6, 4, d.chairSeat);
  rect(ctx, dx - 2, dy + 3, 4, 2, d.chairLight);
  rect(ctx, dx - 10, dy + 6, 20, 2, d.topColor);
  rect(ctx, dx - 10, dy + 6, 20, 1, d.topColor);
  rect(ctx, dx - 10, dy + 7, 20, 1, d.legColor);
  rect(ctx, dx - 9, dy + 8, 2, 3, d.legColor);
  rect(ctx, dx + 7, dy + 8, 2, 3, d.legColor);
  if (hasLaptop) {
    rect(ctx, dx + 0, dy + 0, 9, 6, "#bbbbc4");
    rect(ctx, dx + 1, dy + 0, 7, 1, "#ccccd4");
    rect(ctx, dx + 0, dy + 5, 9, 1, "#aaaab4");
    rect(ctx, dx + 3, dy + 2, 2, 2, "#dddde8");
    px(ctx, dx + 3, dy + 2, "#e8e8f0");
    rect(ctx, dx + 1, dy + 6, 7, 1, "rgba(150,170,200,0.12)");
  }
}

export function drawEnvironment(
  ctx: CanvasRenderingContext2D,
  deskPositions: Array<{ x: number; y: number }>,
  occupiedDeskIndices: Set<number>,
  frame: number = 0,
  timeOverride?: TimeOfDay,
  theme: SceneTheme = forestTheme
) {
  const tod = timeOverride ?? getTimeOfDay();

  drawSky(ctx, tod, theme);
  for (const feat of theme.backgroundFeatures) {
    drawBackgroundFeature(ctx, feat.cx, feat.peak, feat.base, feat.halfWidth, feat.bodyColor, feat.capColor, feat.shape);
  }
  drawGround(ctx, theme);
  drawBackgroundTrees(ctx, theme);
  drawBuilding(ctx, frame, theme);

  for (let i = 0; i < deskPositions.length; i++) {
    drawDesk(ctx, deskPositions[i].x, deskPositions[i].y, occupiedDeskIndices.has(i), theme);
  }

  drawSideTrees(ctx, theme);

  const tint = theme.timeTints[tod];
  if (tint.opacity > 0) {
    ctx.globalAlpha = tint.opacity;
    rect(ctx, 0, 0, W, H, tint.color);
    ctx.globalAlpha = 1;
  }
}
