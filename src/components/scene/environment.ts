import { CANVAS_WIDTH, CANVAS_HEIGHT } from "../canvas-transform";
import type { SceneTheme } from "./themes/types";
import { forestTheme } from "./themes/forest";
import palletTownBgUrl from "../../assets/pallet-town-bg.png";
import jungleRuinsBgUrl from "../../assets/jungle-ruins-bg.png";
import { getAgentLevelAtDesk, getCurrentFrame } from "./renderer";

const W = CANVAS_WIDTH;
const H = CANVAS_HEIGHT;
const BORDER = 22;

// Preloaded background images
function preloadBg(url: string): () => HTMLImageElement | null {
  let img: HTMLImageElement | null = null;
  let loading = false;
  return () => {
    if (img) return img;
    if (!loading) {
      loading = true;
      const el = new Image();
      el.src = url;
      el.onload = () => { img = el; };
    }
    return null;
  };
}

export const getPalletTownBg = preloadBg(palletTownBgUrl);
export const getJungleRuinsBg = preloadBg(jungleRuinsBgUrl);

// --- Lunar shooting stars ---
interface ShootingStar {
  x: number;
  y: number;
  dx: number;
  dy: number;
  life: number;
  maxLife: number;
}
const shootingStars: ShootingStar[] = [];
let nextShootingStarFrame = 120; // first one after 2 sec

// --- UFO system (multi-UFO) ---
interface UfoState {
  phase: "idle" | "materializing" | "hovering" | "zipping" | "trail";
  x: number;
  y: number;
  frame: number;
  trailX: number;
  trailFrame: number;
  zipDir: number; // 1 = right, -1 = left
}
function makeUfo(): UfoState {
  return { phase: "idle", x: 0, y: 0, frame: 0, trailX: 0, trailFrame: 0, zipDir: 1 };
}
const ufos: UfoState[] = [makeUfo()];
let nextUfoFrame = 60 * 60 * (8 + Math.random() * 5); // 8-13 min

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
  // Lunar base: extend sky lower for more visible horizon
  const skyBottom = (theme.id === "lunar-base" || theme.id === "pokemoon") ? 20 : 10;
  rect(ctx, 0, 16, W, skyBottom, sky[2]);

  // Earth rise — lunar-base only, rounder 8x8 with clipped corners
  if (theme.id === "lunar-base" || theme.id === "pokemoon") {
    const ex = W - 60;
    const ey = 6;
    // Glow
    ctx.globalAlpha = 0.12;
    rect(ctx, ex - 1, ey - 1, 10, 10, "#4488cc");
    ctx.globalAlpha = 1;
    // Round body: 8x8 with corners clipped
    //   ..XXXX..
    //   .XXXXXX.
    //   XXXXXXXX  (rows 2-5)
    //   .XXXXXX.
    //   ..XXXX..
    rect(ctx, ex + 2, ey, 4, 1, "#4488cc");       // row 0
    rect(ctx, ex + 1, ey + 1, 6, 1, "#4488cc");   // row 1
    rect(ctx, ex, ey + 2, 8, 4, "#4488cc");        // rows 2-5 (ocean base)
    rect(ctx, ex + 1, ey + 6, 6, 1, "#226644");   // row 6
    rect(ctx, ex + 2, ey + 7, 4, 1, "#226644");   // row 7
    // Land masses
    rect(ctx, ex + 1, ey + 3, 3, 2, "#338855");
    rect(ctx, ex + 5, ey + 2, 2, 3, "#2a7744");
    rect(ctx, ex + 2, ey + 5, 2, 1, "#338855");
    // Polar cap
    rect(ctx, ex + 2, ey, 4, 1, "#ccddee");
    px(ctx, ex + 3, ey + 1, "#bbccdd");
    px(ctx, ex + 4, ey + 1, "#bbccdd");
  }

  // Stars — always visible on lunar-base (no atmosphere), otherwise night only
  if ((tod === "night" && theme.drawStarsAtNight) || theme.id === "lunar-base") {
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
  // Pull bottom in more — more visible water at front
  const bottom = by + bh + margin - 6;

  if (y < top || y >= bottom) return false;

  const edgeIdx = Math.max(0, Math.min(edges.length - 1, y));
  const wobble = edges[edgeIdx];

  const leftEdge = left + wobble;
  const rightEdge = right - edges[(edgeIdx + 50) % edges.length];

  const midX = bx + bw / 2;
  const isLeft = x < midX;

  // Per-region corner intensity
  // vy: 0 at edge, 1 in the building interior
  let vy: number;
  let cornerStrength: number;

  if (y < by) {
    // Back (top) — more aggressive on left
    vy = (y - top) / margin;
    cornerStrength = isLeft ? 2.2 : 1.4;
  } else if (y > by + bh) {
    // Front (bottom) — rounder on both sides, extra wobble
    vy = (bottom - y) / (margin - 6);
    cornerStrength = 2.0;
    // Extra uneven shoreline wobble at the front
    const frontWobble = edges[(edgeIdx * 3 + 77) % edges.length] * 0.5;
    if (y > bottom - 4) {
      const shrinkExtra = Math.floor((1 - vy) * frontWobble * 2);
      if (x < leftEdge + shrinkExtra + 8 || x >= rightEdge - shrinkExtra - 8) return false;
    }
  } else {
    vy = 1;
    cornerStrength = 0;
  }

  const cornerShrink = Math.floor((1 - vy * vy) * margin * cornerStrength);

  // Left side gets extra inset at back
  let leftShrink = cornerShrink;
  let rightShrink = cornerShrink;
  if (y < by && isLeft) {
    leftShrink = Math.floor(cornerShrink * 1.3);
  }

  return x >= leftEdge + leftShrink && x < rightEdge - rightShrink;
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

  // Island sand — per-pixel noise for natural sand look
  // Parse base sand colors once
  const sr1 = parseInt(g.baseColor1.slice(1, 3), 16);
  const sg1 = parseInt(g.baseColor1.slice(3, 5), 16);
  const sb1 = parseInt(g.baseColor1.slice(5, 7), 16);
  const sr2 = parseInt(g.baseColor2.slice(1, 3), 16);
  const sg2 = parseInt(g.baseColor2.slice(3, 5), 16);
  const sb2 = parseInt(g.baseColor2.slice(5, 7), 16);

  for (let y = 20; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (isOnIsland(x, y, island.margin)) {
        // Wider beach strip at the front (bottom), thinner elsewhere
        const beachWidth = y > BUILDING_Y + BUILDING_H ? 5 : 2;
        if (!isOnIsland(x, y, island.margin - beachWidth)) {
          octx.fillStyle = island.sandEdge;
        } else {
          // Deterministic per-pixel hash for grain
          const h = ((x * 374761393 + y * 668265263) >>> 0) % 256;
          const t = h / 255; // 0..1 blend between two sand colors
          const r = Math.round(sr1 + (sr2 - sr1) * t);
          const gc = Math.round(sg1 + (sg2 - sg1) * t);
          const b = Math.round(sb1 + (sb2 - sb1) * t);
          // Occasional brighter/darker grains for unevenness
          const grain = ((h * 31) >>> 0) % 100;
          if (grain < 4) {
            // Slightly darker speck
            octx.fillStyle = `rgb(${r - 12},${gc - 10},${b - 12})`;
          } else if (grain < 7) {
            // Slightly lighter speck
            octx.fillStyle = `rgb(${Math.min(255, r + 10)},${Math.min(255, gc + 8)},${Math.min(255, b + 6)})`;
          } else {
            octx.fillStyle = `rgb(${r},${gc},${b})`;
          }
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
  } else if (g.tileSize <= 1) {
    // Per-pixel noise ground
    const groundBase = (theme.id === "lunar-base" || theme.id === "pokemoon") ? 30 : 20;
    const sr1 = parseInt(g.baseColor1.slice(1, 3), 16);
    const sg1 = parseInt(g.baseColor1.slice(3, 5), 16);
    const sb1 = parseInt(g.baseColor1.slice(5, 7), 16);
    const sr2 = parseInt(g.baseColor2.slice(1, 3), 16);
    const sg2 = parseInt(g.baseColor2.slice(3, 5), 16);
    const sb2 = parseInt(g.baseColor2.slice(5, 7), 16);
    for (let y = groundBase; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const h = ((x * 374761393 + y * 668265263) >>> 0) % 256;
        const t = h / 255;
        const r = Math.round(sr1 + (sr2 - sr1) * t);
        const gc = Math.round(sg1 + (sg2 - sg1) * t);
        const b = Math.round(sb1 + (sb2 - sb1) * t);
        const grain = ((h * 31) >>> 0) % 100;
        if (grain < 4) {
          ctx.fillStyle = `rgb(${r - 12},${gc - 10},${b - 12})`;
        } else if (grain < 7) {
          ctx.fillStyle = `rgb(${Math.min(255, r + 10)},${Math.min(255, gc + 8)},${Math.min(255, b + 6)})`;
        } else {
          ctx.fillStyle = `rgb(${r},${gc},${b})`;
        }
        ctx.fillRect(x, y, 1, 1);
      }
    }
    // Lunar craters
    if (theme.id === "lunar-base" || theme.id === "pokemoon") {
      seed = 4242;
      // Mix of sizes: 3 huge, 4 medium, 7 small
      const craterSizes = [
        { min: 10, max: 16 }, { min: 10, max: 16 }, { min: 10, max: 16 },
        { min: 6, max: 9 }, { min: 6, max: 9 }, { min: 6, max: 9 }, { min: 6, max: 9 },
        { min: 3, max: 5 }, { min: 3, max: 5 }, { min: 3, max: 5 },
        { min: 3, max: 5 }, { min: 3, max: 5 }, { min: 3, max: 5 }, { min: 3, max: 5 },
      ];
      // Generate positions, then clamp the 3 lowest to the back (near horizon)
      const craterPositions: Array<{ x: number; y: number; s: typeof craterSizes[0] }> = [];
      for (let i = 0; i < craterSizes.length; i++) {
        const s = craterSizes[i];
        craterPositions.push({
          x: Math.floor(srand() * (W - 30)) + 15,
          y: Math.floor(srand() * (H - 45)) + 38,
          s,
        });
      }
      // Sort by Y descending, push the 3 lowest up near the back
      const sorted = [...craterPositions].sort((a, b) => b.y - a.y);
      for (let i = 0; i < 3; i++) {
        sorted[i].y = 36 + Math.floor(srand() * 8);
      }
      // Move specific craters
      craterPositions[7].x = 45;
      craterPositions[7].y = 170;
      // Move the crater between bottom-middle and bottom-right desks to bottom-left
      craterPositions[3].x = 55;
      craterPositions[3].y = 165;

      for (let i = 0; i < craterPositions.length; i++) {
        const s = craterPositions[i].s;
        const ccx = craterPositions[i].x;
        const ccy = craterPositions[i].y;
        const rx = Math.floor(srand() * (s.max - s.min)) + s.min; // horizontal radius
        const ry = Math.max(2, Math.floor(rx * (0.5 + srand() * 0.25))); // shorter vertically (elongated)
        // Outer ring — darker
        for (let dy = -ry; dy <= ry; dy++) {
          for (let dx = -rx; dx <= rx; dx++) {
            const d = (dx * dx) / (rx * rx) + (dy * dy) / (ry * ry);
            if (d <= 1 && d > Math.pow((rx - 1) / rx, 2)) {
              ctx.fillStyle = `rgb(${sr1 - 15},${sg1 - 12},${sb1 - 15})`;
              ctx.fillRect(ccx + dx, ccy + dy, 1, 1);
            }
          }
        }
        // Inner depression
        const irx = Math.max(1, rx - 1);
        const iry = Math.max(1, ry - 1);
        for (let dy = -iry; dy <= iry; dy++) {
          for (let dx = -irx; dx <= irx; dx++) {
            if ((dx * dx) / (irx * irx) + (dy * dy) / (iry * iry) <= 1) {
              ctx.fillStyle = `rgb(${sr1 - 8},${sg1 - 6},${sb1 - 8})`;
              ctx.fillRect(ccx + dx, ccy + dy, 1, 1);
            }
          }
        }
        // Highlight on upper rim — lit edge
        for (let dx = -rx + 1; dx < rx; dx++) {
          const normDx = dx / rx;
          const rimDy = -Math.floor(ry * Math.sqrt(1 - normDx * normDx));
          ctx.fillStyle = `rgb(${Math.min(255, sr2 + 15)},${Math.min(255, sg2 + 12)},${Math.min(255, sb2 + 10)})`;
          ctx.fillRect(ccx + dx, ccy + rimDy, 1, 1);
        }
      }
    }

    seed = 100;
    for (let i = 0; i < g.decorCount; i++) {
      rect(ctx, Math.floor(srand() * W), 20 + Math.floor(srand() * (H - 20)), 1, g.decorHeight, g.decorColor);
    }
  } else {
    // Standard tile checkerboard
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

  // GBA-style sand clearing — organic sand shape cut into the grass
  if (g.sandClearing) {
    const sc = g.sandClearing;
    const [inTop, inRight, inBot, inLeft] = Array.isArray(sc.inset)
      ? sc.inset : [sc.inset, sc.inset, sc.inset, sc.inset];
    const cx = BUILDING_X + inLeft;
    const cy = BUILDING_Y + inTop;
    const cw = BUILDING_W - inLeft - inRight;
    const ch = BUILDING_H - inTop - inBot;
    const margin = 6; // max edge wobble

    // Build seeded edge offsets — chunky 4-8px steps, small range
    let es = 6789;
    const nextE = () => { es = (es * 16807 + 11) & 0x7fffffff; return es; };

    const makeEdge = (len: number): number[] => {
      const edge: number[] = [];
      let i = 0;
      while (i < len) {
        const chunk = 4 + (nextE() % 5);
        const off = (nextE() % 7) - 2; // range -2 to +4
        for (let c = 0; c < chunk && i < len; c++, i++) edge.push(off);
      }
      return edge;
    };

    const topEdge = makeEdge(cw);
    const botEdge = makeEdge(cw);
    const leftEdge = makeEdge(ch);
    const rightEdge = makeEdge(ch);

    // isSand test — checks if (px,py) is inside the organic clearing
    const isSand = (px: number, py: number): boolean => {
      const rx = px - cx;
      const ry = py - cy;
      // Core rect
      if (rx >= 0 && rx < cw && ry >= 0 && ry < ch) {
        // Check if edge retracts inward
        if (ry < margin && topEdge[Math.min(rx, cw - 1)] < -ry) return false;
        if (ry >= ch - margin && botEdge[Math.min(rx, cw - 1)] < -(ch - 1 - ry)) return false;
        if (rx < margin && leftEdge[Math.min(ry, ch - 1)] < -rx) return false;
        if (rx >= cw - margin && rightEdge[Math.min(ry, ch - 1)] < -(cw - 1 - rx)) return false;
        return true;
      }
      // Outside core — check edge extensions
      if (ry < 0 && ry >= -margin && rx >= 0 && rx < cw)
        return ry >= -(topEdge[Math.min(rx, cw - 1)]);
      if (ry >= ch && ry < ch + margin && rx >= 0 && rx < cw)
        return ry < ch + botEdge[Math.min(rx, cw - 1)];
      if (rx < 0 && rx >= -margin && ry >= 0 && ry < ch)
        return rx >= -(leftEdge[Math.min(ry, ch - 1)]);
      if (rx >= cw && rx < cw + margin && ry >= 0 && ry < ch)
        return rx < cw + rightEdge[Math.min(ry, ch - 1)];
      return false;
    };

    // 1. Fill sand — solid color, fast rect fills
    rect(ctx, cx, cy, cw, ch, sc.sandColor1);

    // Fill edge extensions with solid sand
    for (let x = 0; x < cw; x++) {
      const te = topEdge[x];
      if (te > 0) rect(ctx, cx + x, cy - te, 1, te, sc.sandColor1);
      const be = botEdge[x];
      if (be > 0) rect(ctx, cx + x, cy + ch, 1, be, sc.sandColor1);
    }
    for (let y = 0; y < ch; y++) {
      const le = leftEdge[y];
      if (le > 0) rect(ctx, cx - le, cy + y, le, 1, sc.sandColor1);
      const re = rightEdge[y];
      if (re > 0) rect(ctx, cx + cw, cy + y, re, 1, sc.sandColor1);
    }

    // Erase sand where edge retracts inward (redraw grass)
    for (let x = 0; x < cw; x++) {
      const te = topEdge[x];
      if (te < 0) {
        const col = (Math.floor((cx + x) / g.tileSize) + Math.floor(cy / g.tileSize)) % 2 === 0 ? g.baseColor1 : g.baseColor2;
        rect(ctx, cx + x, cy, 1, -te, col);
      }
      const be = botEdge[x];
      if (be < 0) {
        const col = (Math.floor((cx + x) / g.tileSize) + Math.floor((cy + ch + be) / g.tileSize)) % 2 === 0 ? g.baseColor1 : g.baseColor2;
        rect(ctx, cx + x, cy + ch + be, 1, -be, col);
      }
    }
    for (let y = 0; y < ch; y++) {
      const le = leftEdge[y];
      if (le < 0) {
        const col = (Math.floor(cx / g.tileSize) + Math.floor((cy + y) / g.tileSize)) % 2 === 0 ? g.baseColor1 : g.baseColor2;
        rect(ctx, cx, cy + y, -le, 1, col);
      }
      const re = rightEdge[y];
      if (re < 0) {
        const col = (Math.floor((cx + cw + re) / g.tileSize) + Math.floor((cy + y) / g.tileSize)) % 2 === 0 ? g.baseColor1 : g.baseColor2;
        rect(ctx, cx + cw + re, cy + y, -re, 1, col);
      }
    }

    // 2. Sparse subtle sand marks (like GBA footprint marks)
    let ms = 4321;
    const nextM = () => { ms = (ms * 16807 + 11) & 0x7fffffff; return ms; };
    for (let i = 0; i < 8; i++) {
      const mx = cx + 10 + (nextM() % (cw - 20));
      const my = cy + 10 + (nextM() % (ch - 20));
      ctx.fillStyle = sc.sandColor2;
      ctx.fillRect(mx, my, 2, 1);
      ctx.fillRect(mx + 1, my + 1, 1, 1);
    }

    // 3. Dark border — 2px thick on grass side
    const scanR = margin + 2;
    for (let y = cy - scanR; y < cy + ch + scanR; y++) {
      for (let x = cx - scanR; x < cx + cw + scanR; x++) {
        if (isSand(x, y)) continue;
        // Check if any of the 8 neighbors is sand
        if (
          isSand(x - 1, y) || isSand(x + 1, y) ||
          isSand(x, y - 1) || isSand(x, y + 1) ||
          isSand(x - 1, y - 1) || isSand(x + 1, y - 1) ||
          isSand(x - 1, y + 1) || isSand(x + 1, y + 1)
        ) {
          ctx.fillStyle = sc.borderColor;
          ctx.fillRect(x, y, 1, 1);
        }
      }
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

function drawRoundTree(ctx: CanvasRenderingContext2D, x: number, gy: number, variant: number, theme: SceneTheme) {
  const c = theme.vegetation.colors;
  const v = variant % 3;
  // GBA Pokemon-style round puffy trees — dense, repeated canopy
  if (v === 0) {
    rect(ctx, x, gy - 4, 2, 4, c.trunk);
    // Round canopy (layered circles approximated with rects)
    rect(ctx, x - 4, gy - 10, 10, 5, c.leaf1);
    rect(ctx, x - 5, gy - 9, 12, 3, c.leaf2);
    rect(ctx, x - 3, gy - 12, 8, 3, c.leaf3);
    rect(ctx, x - 2, gy - 13, 6, 2, c.leaf4);
    // Canopy highlights
    rect(ctx, x - 1, gy - 11, 3, 1, c.leaf4);
    rect(ctx, x + 2, gy - 9, 2, 1, c.leaf4);
  } else if (v === 1) {
    // Slightly taller variant
    rect(ctx, x, gy - 5, 2, 5, c.trunk);
    rect(ctx, x + 1, gy - 4, 1, 3, c.trunkLight);
    rect(ctx, x - 5, gy - 12, 12, 6, c.leaf1);
    rect(ctx, x - 6, gy - 11, 14, 4, c.leaf2);
    rect(ctx, x - 4, gy - 15, 10, 4, c.leaf3);
    rect(ctx, x - 3, gy - 16, 8, 2, c.leaf4);
    rect(ctx, x - 1, gy - 13, 4, 2, c.leaf4);
  } else {
    // Small bush-tree
    rect(ctx, x, gy - 3, 2, 3, c.trunk);
    rect(ctx, x - 3, gy - 8, 8, 4, c.leaf2);
    rect(ctx, x - 4, gy - 7, 10, 2, c.leaf2);
    rect(ctx, x - 2, gy - 9, 6, 2, c.leaf3);
    rect(ctx, x - 1, gy - 10, 4, 2, c.leaf4);
    rect(ctx, x, gy - 8, 2, 1, c.leaf4);
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

function drawBoulder(ctx: CanvasRenderingContext2D, x: number, gy: number, variant: number, theme: SceneTheme) {
  const c = theme.vegetation.colors;
  const v = variant % 3;
  if (v === 0) {
    // Large angular boulder
    rect(ctx, x - 3, gy - 5, 6, 5, c.trunk);
    rect(ctx, x - 2, gy - 5, 5, 1, c.trunkLight);
    rect(ctx, x - 3, gy - 1, 6, 1, c.leaf1);
    rect(ctx, x - 2, gy - 4, 4, 3, c.trunk);
  } else if (v === 1) {
    // Medium rounded rock
    rect(ctx, x - 2, gy - 3, 4, 3, c.trunk);
    rect(ctx, x - 1, gy - 3, 3, 1, c.trunkLight);
  } else {
    // Small pebble cluster
    rect(ctx, x - 1, gy - 2, 2, 2, c.trunk);
    rect(ctx, x + 2, gy - 1, 2, 1, c.leaf2);
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
    case "boulders":
      if (variant % 2 === 0) drawBoulder(ctx, x, gy, variant, theme);
      break;
    case "round-trees":
      drawRoundTree(ctx, x, gy, variant, theme);
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
  } else if (fv.style === "reactor") {
    // Reactor power core — metallic housing with cyan energy cell
    rect(ctx, fpx + 3, fpy + 8, 18, 14, fv.stoneDark);
    rect(ctx, fpx + 4, fpy + 8, 16, 13, fv.stoneColor);
    rect(ctx, fpx + 4, fpy + 8, 16, 1, fv.stoneLight);
    // Panel lines
    rect(ctx, fpx + 4, fpy + 14, 16, 1, fv.stoneBrick);
    rect(ctx, fpx + 11, fpy + 9, 1, 12, fv.stoneBrick);
    // Cyan energy cell
    const glow = 0.6 + 0.3 * Math.sin(frame * 0.06);
    ctx.globalAlpha = glow;
    rect(ctx, fpx + 6, fpy + 10, 5, 3, fv.interiorColor);
    rect(ctx, fpx + 13, fpy + 10, 5, 3, fv.interiorColor);
    rect(ctx, fpx + 7, fpy + 15, 3, 4, fv.interiorDeep);
    rect(ctx, fpx + 14, fpy + 15, 3, 4, fv.interiorDeep);
    ctx.globalAlpha = 1;
    // Top vent
    rect(ctx, fpx + 2, fpy + 6, 20, 3, fv.mantleColor);
    rect(ctx, fpx + 2, fpy + 6, 20, 1, fv.mantleLight);
    // Cyan glow on ground
    const cyanGlow = 0.03 + 0.02 * Math.sin(frame * 0.06);
    rect(ctx, fpx - 2, fpy + 22, 28, 6, `rgba(34,170,204,${cyanGlow.toFixed(3)})`);
    return; // skip the default orange glow below
  } else if (fv.style === "fire-pit" && (theme.id === "pallet-town" || theme.id === "jungle-ruins")) {
    // PNG-backed themes: flames only, no stone — fire pit is in the bg image
    drawFlames(ctx, fpx - 1, fpy + 2, frame);
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
    // Back wall only (low ruined wall, not full background)
    rect(ctx, bx, by, bw, 8, b.wallDark);
    rect(ctx, bx + 3, by + 2, bw - 6, 4, b.wallAccent);
    // Partial side walls (crumbling)
    rect(ctx, bx, by, 3, bh * 0.6, b.wallDark);
    rect(ctx, bx + bw - 3, by, 3, bh * 0.7, b.wallDark);
    // Column stumps
    for (let cy = by + 12; cy < by + bh; cy += 20) {
      rect(ctx, bx, cy, 4, 8, b.wallDark);
      rect(ctx, bx + 1, cy, 2, 1, b.wallAccent);
      rect(ctx, bx + bw - 4, cy, 4, 8, b.wallDark);
      rect(ctx, bx + bw - 3, cy, 2, 1, b.wallAccent);
    }
    // Hieroglyph decorations on back wall
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

  // Fire vessel drawn after tint overlay (see drawEnvironment)
  const fpx = bx + 5;

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
    if (theme.ground.tileSize <= 1) {
      // Per-pixel sand floor matching the ground
      const fr1 = parseInt(b.floorColor1.slice(1, 3), 16);
      const fg1 = parseInt(b.floorColor1.slice(3, 5), 16);
      const fb1 = parseInt(b.floorColor1.slice(5, 7), 16);
      const fr2 = parseInt(b.floorColor2.slice(1, 3), 16);
      const fg2 = parseInt(b.floorColor2.slice(3, 5), 16);
      const fb2 = parseInt(b.floorColor2.slice(5, 7), 16);
      for (let y = fy; y < fy + fh; y++) {
        for (let x = bx + 3; x < bx + 3 + bw - 6; x++) {
          const h = ((x * 374761393 + y * 668265263) >>> 0) % 256;
          const t = h / 255;
          const r = Math.round(fr1 + (fr2 - fr1) * t);
          const gc = Math.round(fg1 + (fg2 - fg1) * t);
          const bl = Math.round(fb1 + (fb2 - fb1) * t);
          const grain = ((h * 31) >>> 0) % 100;
          if (grain < 4) {
            ctx.fillStyle = `rgb(${r - 12},${gc - 10},${bl - 12})`;
          } else if (grain < 7) {
            ctx.fillStyle = `rgb(${Math.min(255, r + 10)},${Math.min(255, gc + 8)},${Math.min(255, bl + 6)})`;
          } else {
            ctx.fillStyle = `rgb(${r},${gc},${bl})`;
          }
          ctx.fillRect(x, y, 1, 1);
        }
      }
    } else {
      // Carpet covering entire floor
      const cx = bx + 3;
      const cw = bw - 6;
      rect(ctx, cx, fy, cw, fh, "#6e6880");

      // Top edge highlight
      rect(ctx, cx, fy, cw, 2, "#767090");
      rect(ctx, cx, fy, cw, 1, "#7a7494");

      // Subtle color flecks throughout
      let fleckSeed = 12345;
      const nextFleck = () => { fleckSeed = (fleckSeed * 16807 + 11) & 0x7fffffff; return fleckSeed; };
      const fleckColors = ["#7a7492", "#726c86", "#6a6480", "#786e8e", "#665e78", "#7e758a"];
      for (let y = fy + 2; y < fy + fh; y++) {
        for (let x = cx; x < cx + cw; x++) {
          const r = nextFleck();
          if (r % 7 === 0) {
            ctx.fillStyle = fleckColors[r % fleckColors.length];
            ctx.fillRect(x, y, 1, 1);
          }
        }
      }
    }
  }

  // Guitar + amp (only in themes that have it)
  if (theme.hasGuitar) {
    // Amp — aligned with monolith base (by + 32 is monolith stone base bottom)
    const ampX = bx + bw - 22;
    const ampY = by + 18; // bottom of amp aligns with monolith base
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

    // Cable from guitar to front of amp (drawn first so guitar covers it)
    const guitarX = ampX - 12; // moved left by ~4 more
    const guitarH = 24;
    const guitarY = ampY + 14 - guitarH;
    ctx.strokeStyle = "#111111";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(guitarX + 3, guitarY + 24);  // bottom of guitar
    ctx.lineTo(guitarX + 3, ampY + 12);     // hang down to floor level
    ctx.lineTo(ampX + 3, ampY + 12);        // along floor to front of amp
    ctx.lineTo(ampX + 3, ampY + 6);         // up to front input jack
    ctx.stroke();

    // Guitar — to the left of the amp, bottom aligned
    // Headstock (narrow)
    rect(ctx, guitarX + 2, guitarY, 2, 2, "#555");
    rect(ctx, guitarX + 2, guitarY + 1, 3, 2, "#111");
    rect(ctx, guitarX + 2, guitarY + 1, 3, 1, "#222");
    px(ctx, guitarX + 1, guitarY + 2, "#888");
    px(ctx, guitarX + 5, guitarY + 2, "#888");
    // Neck
    rect(ctx, guitarX + 3, guitarY + 4, 1, 12, "#664422");
    for (let f = 0; f < 5; f++) {
      px(ctx, guitarX + 3, guitarY + 5 + f * 2, "#887766");
    }
    // Body
    rect(ctx, guitarX + 1, guitarY + 16, 5, 8, "#ddee00");
    rect(ctx, guitarX, guitarY + 17, 7, 6, "#ddee00");
    rect(ctx, guitarX + 1, guitarY + 17, 4, 4, "#eeff33");
    rect(ctx, guitarX + 5, guitarY + 15, 2, 2, "#ccdd00");
    rect(ctx, guitarX + 1, guitarY + 19, 4, 1, "#fff");
    rect(ctx, guitarX + 1, guitarY + 21, 4, 1, "#fff");
    rect(ctx, guitarX - 1, guitarY + 14, 9, 12, "rgba(220,238,0,0.04)");

    // Pedalboard — in front of the amp (on the floor)
    const pbX = ampX - 2;
    const pbY = ampY + 15;
    // Board frame (silver rails like a Pedaltrain)
    rect(ctx, pbX, pbY, 20, 8, "#3a3a3a");
    rect(ctx, pbX + 1, pbY, 18, 1, "#555");
    rect(ctx, pbX + 1, pbY + 7, 18, 1, "#2a2a2a");
    // Top row of pedals — Morningstar controller + smaller pedals
    rect(ctx, pbX + 1, pbY + 1, 6, 3, "#222"); // morningstar (dark, wide)
    px(ctx, pbX + 2, pbY + 2, "#3388ff"); // blue LED
    px(ctx, pbX + 4, pbY + 2, "#33ff88"); // green LED
    px(ctx, pbX + 6, pbY + 2, "#ff3333"); // red LED
    rect(ctx, pbX + 8, pbY + 1, 3, 3, "#aa2222"); // red pedal (blood/mood)
    rect(ctx, pbX + 12, pbY + 1, 3, 3, "#22aa66"); // green pedal
    rect(ctx, pbX + 16, pbY + 1, 3, 3, "#6666aa"); // context reverb (blue-ish)
    // Bottom row — HX stomp (big screen) + expression + small pedals
    rect(ctx, pbX + 1, pbY + 4, 7, 3, "#333"); // HX Stomp
    rect(ctx, pbX + 2, pbY + 4, 5, 2, "#556677"); // screen
    px(ctx, pbX + 3, pbY + 5, "#88aacc"); // screen highlight
    rect(ctx, pbX + 9, pbY + 4, 4, 3, "#444"); // expression pedal
    rect(ctx, pbX + 9, pbY + 4, 4, 1, "#666"); // exp top highlight
    rect(ctx, pbX + 14, pbY + 4, 2, 3, "#885522"); // small brown pedal
    rect(ctx, pbX + 17, pbY + 4, 2, 3, "#224488"); // small blue pedal
    // Patch cables between pedals
    ctx.strokeStyle = "#111111";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(pbX + 7, pbY + 3);
    ctx.lineTo(pbX + 8, pbY + 3);
    ctx.moveTo(pbX + 11, pbY + 3);
    ctx.lineTo(pbX + 12, pbY + 3);
    ctx.moveTo(pbX + 15, pbY + 3);
    ctx.lineTo(pbX + 16, pbY + 3);
    ctx.stroke();

    // Cat tree — to the left of the guitar with spacing
    const ctX = guitarX - 19;
    const ctBottom = ampY + 14; // align with back wall line
    // Base platform
    rect(ctx, ctX, ctBottom - 4, 10, 4, "#666");
    rect(ctx, ctX, ctBottom - 4, 10, 1, "#777");
    // Left post (sisal)
    rect(ctx, ctX + 1, ctBottom - 16, 2, 12, "#b8955a");
    rect(ctx, ctX + 1, ctBottom - 16, 1, 12, "#c8a56a");
    // Right post (sisal)
    rect(ctx, ctX + 7, ctBottom - 14, 2, 10, "#b8955a");
    rect(ctx, ctX + 7, ctBottom - 14, 1, 10, "#c8a56a");
    // Middle platform
    rect(ctx, ctX - 1, ctBottom - 16, 12, 3, "#666");
    rect(ctx, ctX - 1, ctBottom - 16, 12, 1, "#777");
    // Bowl/basket on middle platform
    rect(ctx, ctX + 5, ctBottom - 15, 4, 2, "#555");
    rect(ctx, ctX + 6, ctBottom - 15, 2, 1, "#5a5a5a");
    // Cubby hole below middle platform
    rect(ctx, ctX + 2, ctBottom - 13, 5, 4, "#555");
    rect(ctx, ctX + 3, ctBottom - 12, 3, 3, "#2a2a2a"); // dark interior
    // Tall post to top perch (sisal)
    rect(ctx, ctX + 4, ctBottom - 26, 2, 10, "#b8955a");
    rect(ctx, ctX + 4, ctBottom - 26, 1, 10, "#c8a56a");
    // Top perch (oval cushion)
    rect(ctx, ctX + 1, ctBottom - 28, 8, 3, "#666");
    rect(ctx, ctX + 2, ctBottom - 28, 6, 1, "#777");
    rect(ctx, ctX + 2, ctBottom - 27, 6, 2, "#5a5a5a");
    // Dangling toy from middle platform
    px(ctx, ctX + 10, ctBottom - 14, "#b8955a");
    px(ctx, ctX + 10, ctBottom - 13, "#b8955a");
    px(ctx, ctX + 10, ctBottom - 12, "#ddaa44");

  }

  // Golden ruins — crumbled pillars and stones where guitar/amp area would be
  if (theme.id === "golden-ruins" && !theme.hasGuitar) {
    const ruX = bx + bw - 38;
    const ruY = by + 18;
    // Fallen column — horizontal
    rect(ctx, ruX, ruY + 10, 14, 3, "#a08860");
    rect(ctx, ruX, ruY + 10, 14, 1, "#b8a070");
    rect(ctx, ruX + 1, ruY + 12, 12, 1, "#8a7050");
    // Column segments (fluting detail)
    for (let s = 0; s < 14; s += 3) {
      px(ctx, ruX + s, ruY + 11, "#8a7050");
    }
    // Standing column stump
    rect(ctx, ruX + 18, ruY + 4, 4, 9, "#a08860");
    rect(ctx, ruX + 18, ruY + 4, 4, 1, "#b8a070");
    rect(ctx, ruX + 17, ruY + 3, 6, 2, "#b8a070"); // capital
    rect(ctx, ruX + 18, ruY + 12, 4, 1, "#8a7050"); // base
    // Rubble stones
    rect(ctx, ruX + 4, ruY + 13, 3, 2, "#8a7050");
    rect(ctx, ruX + 9, ruY + 12, 2, 2, "#a08860");
    rect(ctx, ruX + 24, ruY + 10, 3, 3, "#8a7050");
    rect(ctx, ruX + 24, ruY + 10, 3, 1, "#a08860");
    rect(ctx, ruX + 28, ruY + 11, 2, 2, "#6a5840");
    // Broken tablet leaning against stump
    rect(ctx, ruX + 15, ruY + 6, 3, 7, "#a08860");
    rect(ctx, ruX + 15, ruY + 6, 3, 1, "#b8a070");
    px(ctx, ruX + 16, ruY + 8, "#6a5840"); // carved mark
    px(ctx, ruX + 16, ruY + 10, "#6a5840"); // carved mark
    // Small scattered stones
    px(ctx, ruX + 1, ruY + 13, "#6a5840");
    px(ctx, ruX + 30, ruY + 12, "#8a7050");
    px(ctx, ruX + 22, ruY + 13, "#6a5840");
  }

  // Pallet Town — Pokemon GBA-style outdoor scene
  if (theme.id === "pallet-town") {
    const grassBright = "#78c878";

    // Houses on the back wall
    // Right house (teal roof)
    const hx = bx + bw - 40;
    const hy = by + 1;
    rect(ctx, hx - 2, hy, 24, 3, "#449988");
    rect(ctx, hx - 1, hy, 22, 2, "#55bbaa");
    rect(ctx, hx, hy, 20, 1, "#66ccbb");
    rect(ctx, hx, hy + 3, 20, 12, "#c8b890");
    rect(ctx, hx + 1, hy + 3, 18, 11, "#d8c8a0");
    rect(ctx, hx + 1, hy + 7, 18, 1, "#c0b080");
    rect(ctx, hx + 8, hy + 7, 5, 8, "#7a5a33");
    rect(ctx, hx + 9, hy + 7, 3, 7, "#8a6a44");
    px(ctx, hx + 11, hy + 10, "#ddaa44");
    rect(ctx, hx + 2, hy + 4, 5, 4, "#88bbdd");
    rect(ctx, hx + 3, hy + 4, 3, 3, "#aaddee");
    rect(ctx, hx + 14, hy + 4, 5, 4, "#88bbdd");
    rect(ctx, hx + 15, hy + 4, 3, 3, "#aaddee");
    rect(ctx, hx + 16, hy - 3, 3, 4, "#887766");

    // Left house (red roof) — away from fireplace
    const h2x = bx + 30;
    const h2y = by + 3;
    rect(ctx, h2x - 1, h2y, 16, 3, "#cc5544");
    rect(ctx, h2x, h2y, 14, 2, "#dd6655");
    rect(ctx, h2x + 1, h2y, 12, 1, "#ee8877");
    rect(ctx, h2x, h2y + 3, 14, 10, "#eee8d8");
    rect(ctx, h2x + 1, h2y + 3, 12, 9, "#f0ebe0");
    rect(ctx, h2x + 5, h2y + 6, 4, 7, "#7a5a33");
    rect(ctx, h2x + 6, h2y + 6, 2, 6, "#8a6a44");
    rect(ctx, h2x + 1, h2y + 4, 4, 3, "#88bbdd");
    rect(ctx, h2x + 2, h2y + 4, 2, 2, "#aaddee");
    // Mailbox
    rect(ctx, h2x - 3, h2y + 10, 3, 3, "#cc4433");
    rect(ctx, h2x - 3, h2y + 10, 3, 1, "#dd5544");
    rect(ctx, h2x - 2, h2y + 13, 1, 2, "#665544");

    // Flowers
    const flowers = [
      { x: bx + 6, y: fy + 3, c: "#ee6688" },
      { x: bx + 18, y: fy + 4, c: "#ffaa44" },
      { x: bx + bw - 10, y: fy + 3, c: "#ee6688" },
      { x: bx + 5, y: fy + fh - 4, c: "#ffcc44" },
      { x: bx + bw - 6, y: fy + fh - 3, c: "#ee6688" },
    ];
    for (const f of flowers) {
      px(ctx, f.x, f.y, f.c);
      px(ctx, f.x + 1, f.y, f.c);
      px(ctx, f.x, f.y - 1, grassBright);
    }

    // Sign post
    rect(ctx, bx + bw / 2 + 22, fy + fh - 10, 2, 6, "#665544");
    rect(ctx, bx + bw / 2 + 20, fy + fh - 12, 6, 3, "#aa9060");
    rect(ctx, bx + bw / 2 + 20, fy + fh - 12, 6, 1, "#bba070");
  }

  // Tropical island decorations
  if (theme.id === "tropical-island") {
    // Skeleton half-buried in sand — right side where guitar/amp would be
    const skx = bx + bw - 20;
    const sky = fy + 4;
    // Skull
    ctx.fillStyle = "#e8e0d0";
    ctx.fillRect(skx + 1, sky, 4, 3);
    ctx.fillRect(skx, sky + 1, 6, 2);
    ctx.fillStyle = "#d8d0c0";
    ctx.fillRect(skx + 1, sky + 3, 4, 1); // jaw
    // Eye sockets
    ctx.fillStyle = "#2a2218";
    ctx.fillRect(skx + 1, sky + 1, 1, 1);
    ctx.fillRect(skx + 4, sky + 1, 1, 1);
    // Nose
    ctx.fillStyle = "#3a3228";
    ctx.fillRect(skx + 3, sky + 2, 1, 1);
    // Ribs poking out of sand
    ctx.fillStyle = "#d8d0c0";
    ctx.fillRect(skx + 2, sky + 5, 5, 1);
    ctx.fillRect(skx + 3, sky + 7, 4, 1);
    ctx.fillRect(skx + 4, sky + 9, 3, 1);
    ctx.fillStyle = "#c8c0b0";
    ctx.fillRect(skx + 1, sky + 6, 1, 1);
    ctx.fillRect(skx + 2, sky + 8, 1, 1);
    // Arm bone reaching out
    ctx.fillStyle = "#e0d8c8";
    ctx.fillRect(skx - 2, sky + 4, 3, 1);
    ctx.fillRect(skx - 4, sky + 3, 2, 1);
    // Hand bones
    ctx.fillStyle = "#d0c8b8";
    ctx.fillRect(skx - 5, sky + 2, 1, 1);
    ctx.fillRect(skx - 5, sky + 4, 1, 1);
    ctx.fillRect(skx - 6, sky + 3, 1, 1);
    // Sand partially covering
    ctx.fillStyle = "#d4c490";
    ctx.fillRect(skx + 1, sky + 10, 6, 2);
    ctx.fillRect(skx + 3, sky + 9, 1, 1);
    ctx.globalAlpha = 0.4;
    ctx.fillStyle = "#d4c490";
    ctx.fillRect(skx + 5, sky + 7, 2, 2);
    ctx.fillRect(skx + 2, sky + 4, 1, 1);
    ctx.globalAlpha = 1;

    // Shipwreck on the water — middle right shoreline
    const swx = bx + bw + 12;
    const swy = fy + Math.floor(fh / 2);
    // Hull
    ctx.fillStyle = "#5a3a1a";
    ctx.fillRect(swx, swy + 2, 14, 4);
    ctx.fillRect(swx + 1, swy + 1, 12, 1);
    ctx.fillRect(swx + 2, swy, 10, 1);
    ctx.fillStyle = "#4a2a10";
    ctx.fillRect(swx, swy + 5, 14, 1);
    ctx.fillRect(swx - 1, swy + 6, 16, 1);
    // Hull highlight
    ctx.fillStyle = "#6a4a2a";
    ctx.fillRect(swx + 2, swy + 1, 10, 1);
    // Plank lines
    ctx.fillStyle = "#4a2a10";
    ctx.fillRect(swx + 1, swy + 3, 12, 1);
    // Broken mast
    ctx.fillStyle = "#5a4020";
    ctx.fillRect(swx + 5, swy - 6, 2, 8);
    ctx.fillStyle = "#4a3018";
    ctx.fillRect(swx + 5, swy - 6, 1, 1);
    // Tilted — mast leans right
    ctx.fillStyle = "#5a4020";
    ctx.fillRect(swx + 7, swy - 7, 1, 2);
    ctx.fillRect(swx + 8, swy - 8, 1, 2);
    // Torn sail remnant
    ctx.fillStyle = "#c8c0a8";
    ctx.fillRect(swx + 7, swy - 5, 3, 3);
    ctx.fillRect(swx + 7, swy - 4, 4, 2);
    ctx.fillStyle = "#b8b098";
    ctx.fillRect(swx + 9, swy - 3, 2, 1);
    // Water lapping at hull
    ctx.globalAlpha = 0.3;
    ctx.fillStyle = "#44aacc";
    ctx.fillRect(swx - 1, swy + 5, 2, 1);
    ctx.fillRect(swx + 13, swy + 4, 2, 1);
    ctx.fillRect(swx - 2, swy + 7, 18, 1);
    ctx.globalAlpha = 1;
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
  const hasIsland = !!theme.ground.island;
  const islandMargin = theme.ground.island?.margin ?? 0;

  // For round-trees: dense clustered rows like GBA Pokemon
  if (theme.vegetation.type === "round-trees") {
    // Two dense rows of tightly packed round trees
    for (let row = 0; row < 2; row++) {
      const vy = 26 + row * 8;
      for (let tx = 4; tx < W - 4; tx += 8) {
        const offset = row % 2 === 0 ? 0 : 4; // stagger rows
        drawRoundTree(ctx, tx + offset + Math.floor(srand() * 2), vy + Math.floor(srand() * 2), Math.floor(srand() * 3), theme);
      }
    }
    return;
  }

  const count = Math.floor(16 * theme.vegetation.density);
  if (count <= 0) return;
  const spacing = Math.floor(W / count);
  for (let i = 0; i < count; i++) {
    const vx = Math.floor(spacing * 0.5) + i * spacing + Math.floor(srand() * 6);
    const vyBase = (theme.id === "lunar-base" || theme.id === "pokemoon") ? 34 : 28;
    const vy = vyBase + Math.floor(srand() * 4);
    const vv = Math.floor(srand() * 4);
    if (!hasIsland || isOnIsland(vx, vy, islandMargin)) {
      drawVegetation(ctx, vx, vy, vv, theme);
    }
  }
}

function drawSideTrees(ctx: CanvasRenderingContext2D, theme: SceneTheme) {
  if (theme.vegetation.density <= 0) return;

  // Round-trees: dense clustered columns on both sides and bottom
  if (theme.vegetation.type === "round-trees") {
    seed = 800;
    // Left column — 2 trees wide, packed vertically
    for (let gy = 38; gy < H - 8; gy += 10) {
      drawRoundTree(ctx, 8, gy, Math.floor(srand() * 3), theme);
      drawRoundTree(ctx, 18, gy + 4, Math.floor(srand() * 3), theme);
    }
    // Right column
    for (let gy = 40; gy < H - 8; gy += 10) {
      drawRoundTree(ctx, W - 10, gy, Math.floor(srand() * 3), theme);
      drawRoundTree(ctx, W - 20, gy + 4, Math.floor(srand() * 3), theme);
    }
    // Bottom row — dense
    for (let gx = 30; gx < W - 30; gx += 10) {
      drawRoundTree(ctx, gx, H - 4, Math.floor(srand() * 3), theme);
    }
    return;
  }

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
  const hasIsland = !!theme.ground.island;
  const islandMargin = theme.ground.island?.margin ?? 0;

  const canDraw = (x: number, y: number) =>
    !hasIsland || isOnIsland(x, y, islandMargin);

  for (let i = 0; i < leftBase.length; i++) {
    if (keep(i, leftBase.length) && canDraw(leftBase[i].x, leftBase[i].y))
      drawVegetation(ctx, leftBase[i].x, leftBase[i].y, leftBase[i].v, theme);
  }
  for (let i = 0; i < rightBase.length; i++) {
    if (keep(i, rightBase.length) && canDraw(rightBase[i].x, rightBase[i].y))
      drawVegetation(ctx, rightBase[i].x, rightBase[i].y, rightBase[i].v, theme);
  }
  for (let i = 0; i < frontBase.length; i++) {
    if (keep(i, frontBase.length) && canDraw(frontBase[i].x, frontBase[i].y))
      drawVegetation(ctx, frontBase[i].x, frontBase[i].y, frontBase[i].v, theme);
  }
}

function drawDeskChair(
  ctx: CanvasRenderingContext2D,
  dx: number,
  dy: number,
  theme: SceneTheme
) {
  const d = theme.desk;
  if (!d.hideChairs) {
    rect(ctx, dx - 3, dy - 1, 6, 3, d.chairBack);
    rect(ctx, dx - 3, dy + 2, 6, 4, d.chairSeat);
    rect(ctx, dx - 2, dy + 3, 4, 2, d.chairLight);
  }
}

function drawDeskFront(
  ctx: CanvasRenderingContext2D,
  dx: number,
  dy: number,
  hasLaptop: boolean,
  theme: SceneTheme,
  deskIndex: number = -1
) {
  const d = theme.desk;
  if (!d.hideDesks) {
    rect(ctx, dx - 10, dy + 6, 20, 2, d.topColor);
    rect(ctx, dx - 10, dy + 6, 20, 1, d.topColor);
    rect(ctx, dx - 10, dy + 7, 20, 1, d.legColor);
    rect(ctx, dx - 9, dy + 8, 2, 3, d.legColor);
    rect(ctx, dx + 7, dy + 8, 2, 3, d.legColor);
  }
  if (hasLaptop) {
    if (theme.id === "pallet-town" || theme.id === "pokemoon" || theme.id === "jungle-ruins") {
      // Pokeball — 7x7 centered at dx+3, dy-1
      const bx = dx + 1;
      const by = dy - 1;
      // Outline circle (7x7 with clipped corners)
      //  .XXXXX.
      //  XXXXXXX
      //  XXXXXXX
      //  XXXXXXX
      //  XXXXXXX
      //  XXXXXXX
      //  .XXXXX.
      const BK = "#222222";
      // Top/bottom rows (clipped corners)
      rect(ctx, bx + 1, by, 5, 1, BK);
      rect(ctx, bx + 1, by + 6, 5, 1, BK);
      // Left/right edges
      rect(ctx, bx, by + 1, 1, 5, BK);
      rect(ctx, bx + 6, by + 1, 1, 5, BK);
      // Pokeball tiers: standard → great(20) → ultra(30) → gold top(50) → full gold(75)
      const agentLevel = getAgentLevelAtDesk(deskIndex);
      const isGreat = agentLevel >= 20;
      const isUltra = agentLevel >= 30;
      const isGold = agentLevel >= 50;
      const isFullGold = agentLevel >= 75;

      // Top half (rows 1-2)
      const topColor = isGold ? "#cc8800" : isUltra ? "#222222" : isGreat ? "#3366cc" : "#cc2222";
      const topHighlight = isGold ? "#ddaa22" : isUltra ? "#444444" : isGreat ? "#4488ee" : "#dd3333";
      rect(ctx, bx + 1, by + 1, 5, 2, topColor);
      rect(ctx, bx + 2, by + 1, 3, 1, topHighlight);
      // Bottom half (rows 4-5)
      const bottomColor = isFullGold ? "#ddaa22" : isUltra ? "#ccaa00" : "#e8e0d8";
      const bottomShadow = isFullGold ? "#ccaa00" : isUltra ? "#bb9900" : "#d0c8c0";
      rect(ctx, bx + 1, by + 4, 5, 2, bottomColor);
      rect(ctx, bx + 1, by + 5, 3, 1, bottomShadow);

      // Full gold shimmer at Lv75+
      if (isFullGold) {
        const frame = getCurrentFrame();
        const shimmerPhase = Math.floor(frame / 12) % 4;
        const shimmerPixels = [[bx+2, by+1], [bx+4, by+2], [bx+2, by+4], [bx+4, by+5]];
        const sp = shimmerPixels[shimmerPhase];
        ctx.fillStyle = "#ffee88";
        ctx.fillRect(sp[0], sp[1], 1, 1);
      }
      // Black middle band (row 3)
      rect(ctx, bx + 1, by + 3, 5, 1, BK);
      // Center button (white dot) — this is the glow target
      px(ctx, bx + 3, by + 3, "#f0f0f0");
    } else {
      rect(ctx, dx + 0, dy + 0, 9, 6, "#bbbbc4");
      rect(ctx, dx + 1, dy + 0, 7, 1, "#ccccd4");
      rect(ctx, dx + 0, dy + 5, 9, 1, "#aaaab4");
      rect(ctx, dx + 3, dy + 2, 2, 2, "#dddde8");
      px(ctx, dx + 3, dy + 2, "#e8e8f0");
      rect(ctx, dx + 1, dy + 6, 7, 1, "rgba(150,170,200,0.12)");
    }
  }
}

function drawDesk(
  ctx: CanvasRenderingContext2D,
  dx: number,
  dy: number,
  hasLaptop: boolean,
  theme: SceneTheme,
  deskIndex: number = -1
) {
  drawDeskChair(ctx, dx, dy, theme);
  drawDeskFront(ctx, dx, dy, hasLaptop, theme, deskIndex);
}

function updateAndDrawShootingStars(ctx: CanvasRenderingContext2D) {
  // Spawn new shooting stars
  nextShootingStarFrame--;
  if (nextShootingStarFrame <= 0) {
    shootingStars.push({
      x: Math.random() * W * 0.8,
      y: Math.random() * 12 + 2,
      dx: 1.5 + Math.random() * 1.5,
      dy: 0.3 + Math.random() * 0.4,
      life: 0,
      maxLife: 15 + Math.floor(Math.random() * 15),
    });
    nextShootingStarFrame = 60 * (3 + Math.random() * 8); // 3-11 sec between
  }

  for (let i = shootingStars.length - 1; i >= 0; i--) {
    const s = shootingStars[i];
    s.life++;
    s.x += s.dx;
    s.y += s.dy;
    if (s.life > s.maxLife) {
      shootingStars.splice(i, 1);
      continue;
    }
    const alpha = 1 - s.life / s.maxLife;
    // Trail
    for (let t = 0; t < 4; t++) {
      const tx = s.x - s.dx * t * 0.7;
      const ty = s.y - s.dy * t * 0.7;
      ctx.globalAlpha = alpha * (1 - t * 0.25);
      ctx.fillStyle = t === 0 ? "#ffffff" : "#aaccff";
      ctx.fillRect(Math.floor(tx), Math.floor(ty), 1, 1);
    }
    ctx.globalAlpha = 1;
  }
}

function updateSingleUfo(ctx: CanvasRenderingContext2D, ufo: UfoState): boolean {
  if (ufo.phase === "idle") return false; // nothing to draw

  ufo.frame++;
  const ux = Math.floor(ufo.x);
  const uy = Math.floor(ufo.y);

  if (ufo.phase === "materializing") {
    const alpha = Math.min(1, ufo.frame / 60);
    drawUfoSprite(ctx, ux, uy, alpha, ufo.frame);
    if (ufo.frame >= 60) {
      ufo.phase = "hovering";
      ufo.frame = 0;
    }
  } else if (ufo.phase === "hovering") {
    const bob = Math.sin(ufo.frame * 0.05) * 0.5;
    drawUfoSprite(ctx, ux, Math.floor(ufo.y + bob), 1, ufo.frame);
    if (ufo.frame >= 600) {
      ufo.phase = "zipping";
      ufo.frame = 0;
      ufo.trailX = ufo.x;
    }
  } else if (ufo.phase === "zipping") {
    ufo.x += 25 * ufo.zipDir;
    drawUfoSprite(ctx, Math.floor(ufo.x), uy, Math.max(0, 1 - ufo.frame / 10), ufo.frame);
    if (ufo.frame >= 10) {
      ufo.phase = "trail";
      ufo.frame = 0;
    }
  } else if (ufo.phase === "trail") {
    const alpha = Math.max(0, 1 - ufo.frame / 120);
    const trailLen = Math.min(Math.abs(ufo.x - ufo.trailX), W);
    const startX = ufo.zipDir > 0 ? ufo.trailX : ufo.x;
    for (let t = 0; t < trailLen; t += 2) {
      const tx = startX + t;
      const fade = t / trailLen;
      const dirFade = ufo.zipDir > 0 ? fade : 1 - fade;
      ctx.globalAlpha = alpha * (0.1 + dirFade * 0.5);
      ctx.fillStyle = dirFade > 0.7 ? "#ffffff" : "#88ddff";
      ctx.fillRect(Math.floor(tx), uy + 2, 2, 1);
    }
    ctx.globalAlpha = 1;
    if (ufo.frame >= 120) {
      ufo.phase = "idle";
    }
  }
  return true;
}

function updateAndDrawUfos(ctx: CanvasRenderingContext2D, autoSpawn: boolean) {
  // Auto-spawn countdown (only in certain themes)
  if (autoSpawn) {
    nextUfoFrame--;
    if (nextUfoFrame <= 0) {
      // Find or create an idle UFO
      let idle = ufos.find((u) => u.phase === "idle");
      if (!idle) { idle = makeUfo(); ufos.push(idle); }
      idle.phase = "materializing";
      idle.x = 30 + Math.random() * (W - 80);
      idle.y = 3 + Math.random() * 6;
      idle.frame = 0;
      idle.zipDir = Math.random() < 0.5 ? 1 : -1;
      nextUfoFrame = 60 * 60 * (8 + Math.random() * 5);
    }
  }
  // Update and draw all active UFOs
  for (const u of ufos) {
    updateSingleUfo(ctx, u);
  }
}

function drawUfoSprite(ctx: CanvasRenderingContext2D, x: number, y: number, alpha: number, frame: number) {
  ctx.globalAlpha = alpha;
  // Glow under dome
  ctx.fillStyle = `rgba(100,220,255,${0.15 + 0.05 * Math.sin(frame * 0.1)})`;
  ctx.fillRect(x, y - 1, 9, 2);
  // Dome — glowing top
  ctx.fillStyle = "#66ddff";
  ctx.fillRect(x + 3, y, 3, 1);
  ctx.fillRect(x + 2, y + 1, 5, 1);
  // Dome shine
  ctx.fillStyle = "#aaeeff";
  ctx.fillRect(x + 3, y, 2, 1);
  // Body — wide bright disc
  ctx.fillStyle = "#b0b8c0";
  ctx.fillRect(x + 1, y + 2, 7, 1);
  ctx.fillStyle = "#99a0a8";
  ctx.fillRect(x, y + 3, 9, 1);
  ctx.fillStyle = "#808890";
  ctx.fillRect(x + 1, y + 4, 7, 1);
  // Lights — blinking
  const lightOn = frame % 20 < 10;
  ctx.fillStyle = lightOn ? "#ff5555" : "#883333";
  ctx.fillRect(x + 1, y + 3, 1, 1);
  ctx.fillStyle = lightOn ? "#55ff55" : "#338833";
  ctx.fillRect(x + 7, y + 3, 1, 1);
  ctx.fillStyle = !lightOn ? "#ffff55" : "#888833";
  ctx.fillRect(x + 4, y + 3, 1, 1);
  ctx.globalAlpha = 1;
}

// Deferred desk fronts — drawn by renderer after agents
let _pendingDeskFronts: {
  ctx: CanvasRenderingContext2D;
  positions: Array<{ x: number; y: number }>;
  occupied: Set<number>;
  theme: SceneTheme;
} | null = null;

export function drawDeskFronts() {
  if (!_pendingDeskFronts) return;
  const { ctx, positions, occupied, theme } = _pendingDeskFronts;
  for (let i = 0; i < positions.length; i++) {
    drawDeskFront(ctx, positions[i].x, positions[i].y, occupied.has(i), theme, i);
  }
  _pendingDeskFronts = null;
}

/** Trigger a UFO to appear (supports up to 20 simultaneous) */
export function triggerUfo(): boolean {
  if (ufos.length >= 20 && !ufos.some((u) => u.phase === "idle")) return false;
  let idle = ufos.find((u) => u.phase === "idle");
  if (!idle) { idle = makeUfo(); ufos.push(idle); }
  idle.phase = "materializing";
  idle.x = 30 + Math.random() * (W - 80);
  idle.y = 3 + Math.random() * 6;
  idle.frame = 0;
  idle.zipDir = Math.random() < 0.5 ? 1 : -1;
  return true;
}

export function drawEnvironment(
  ctx: CanvasRenderingContext2D,
  deskPositions: Array<{ x: number; y: number }>,
  occupiedDeskIndices: Set<number>,
  frame: number = 0,
  timeOverride?: TimeOfDay,
  theme: SceneTheme = forestTheme,
  beforeTint?: () => void,
  skipTint?: boolean
) {
  const tod = timeOverride ?? getTimeOfDay();

  // PNG-backed themes: use preloaded background image if available
  const palletBg = theme.id === "pallet-town" && getPalletTownBg();
  const jungleBg = theme.id === "jungle-ruins" && getJungleRuinsBg();
  const useBgImage = palletBg || jungleBg;

  // Always draw sky first — bg image has transparent sky so it shows through
  drawSky(ctx, tod, theme);

  if (useBgImage) {
    // Draw PNG on top — transparent sky lets the procedural sky show through
    ctx.drawImage(useBgImage, 0, 1, W, H);
  } else if (theme.id === "pallet-town" || theme.id === "jungle-ruins") {
    // PNG-backed theme without image loaded — just show sky, skip everything
    return;
  } else {
    for (const feat of theme.backgroundFeatures) {
      drawBackgroundFeature(ctx, feat.cx, feat.peak, feat.base, feat.halfWidth, feat.bodyColor, feat.capColor, feat.shape);
    }

    // Sky effects — shooting stars (lunar + pokemoon)
    if (theme.id === "lunar-base" || theme.id === "pokemoon") {
      updateAndDrawShootingStars(ctx);
    }
    // UFOs draw in all scenes, auto-spawn only in lunar + desert
    const ufoAutoSpawn = theme.id === "lunar-base" || theme.id === "golden-ruins" || theme.id === "pokemoon";
    updateAndDrawUfos(ctx, ufoAutoSpawn);

    drawGround(ctx, theme);
    drawBackgroundTrees(ctx, theme);
    drawBuilding(ctx, frame, theme);
  }

  // Draw chairs (behind agents)
  for (let i = 0; i < deskPositions.length; i++) {
    drawDeskChair(ctx, deskPositions[i].x, deskPositions[i].y, theme);
  }
  // Tables + laptops drawn later by renderer (in front of agents)
  _pendingDeskFronts = { ctx, positions: deskPositions, occupied: occupiedDeskIndices, theme };

  if (!useBgImage) {
    drawSideTrees(ctx, theme);
  }

  if (beforeTint) beforeTint();

  const tint = theme.timeTints[tod];
  if (tint.opacity > 0 && !skipTint) {
    ctx.globalAlpha = tint.opacity;
    rect(ctx, 0, 0, W, H, tint.color);
    ctx.globalAlpha = 1;
  }

  // Fire drawn on top of tint so it always burns bright
  const fpx = BUILDING_X + 5;
  const fpy = BUILDING_Y + 2;
  drawFireVessel(ctx, fpx, fpy, frame, theme);

  // Enhanced glow around fire at night/dawn
  if (tod === "night" || tod === "dawn") {
    const isLunar = theme.fireVessel.style === "reactor";
    const radius = tod === "night" ? 40 : 28;
    const alpha = tod === "night" ? 0.18 : 0.1;
    const cx = fpx + 12;
    const cy = fpy + 14;
    const grad = ctx.createRadialGradient(cx, cy, 2, cx, cy, radius);
    if (isLunar) {
      grad.addColorStop(0, `rgba(34,170,204,${alpha})`);
      grad.addColorStop(0.5, `rgba(20,120,180,${alpha * 0.5})`);
      grad.addColorStop(1, "rgba(20,100,160,0)");
    } else {
      grad.addColorStop(0, `rgba(255,140,50,${alpha})`);
      grad.addColorStop(0.5, `rgba(255,100,30,${alpha * 0.5})`);
      grad.addColorStop(1, "rgba(255,80,20,0)");
    }
    ctx.fillStyle = grad;
    ctx.fillRect(cx - radius, cy - radius, radius * 2, radius * 2);
  }
}
