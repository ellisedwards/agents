import { TEAM_COLORS, type AgentState } from "@/shared/types";
import type { CharacterType } from "../characters/sprite-cache";
import { getSprite, type buildSpriteCache } from "../characters/sprite-cache";
import { assignDesks, DESK_POSITIONS } from "./desk-layout";
import { drawEnvironment } from "./environment";
import { CANVAS_WIDTH } from "../canvas-transform";
import {
  createWalkState,
  updateWalkState,
  getWalkSpriteState,
  type WalkState,
  type AvoidZone,
} from "./walking";
import { useAgentOfficeStore, type MonitorStatus, type ClawHealth } from "../store";

// Walk states persist across frames
const walkStates = new Map<string, WalkState>();
// Smoothed render positions — lerp toward target to prevent blinking
const smoothPos = new Map<string, { x: number; y: number }>();
let catWalkState: WalkState | null = null;

// Space cat floating away state
let floatingAway = false;
let floatY = 0;
let floatStartX = 0;
let floatFrame = 0;
let floatMaxHeight = -20; // how high before returning (varies)
let nextFloatCheck = 60 * 60 * (4 + Math.random() * 6); // 4-10 min at 60fps

/** Wake/startle the cat when poked. */
export function pokeCat(): boolean {
  if (!catWalkState) return false;
  // Startle the cat — jump + freeze for ~1 second
  catWalkState.startledFrames = 60;
  if (catWalkState.isSleeping) {
    catWalkState.isSleeping = false;
    catWalkState.sleepFramesRemaining = 0;
    catWalkState.idleCyclesSinceNap = 0;
  }
  catWalkState.isMoving = false;
  catWalkState.idleFramesRemaining = 45; // short pause after startled
  return true;
}

/** Trigger the floating-away animation for space cat */
export function triggerFloat(): boolean {
  if (!catWalkState || floatingAway) return false;
  floatingAway = true;
  floatY = catWalkState.currentY;
  floatStartX = catWalkState.currentX;
  floatFrame = 0;
  // Vary: sometimes just a short float (20-40px up), sometimes off screen
  floatMaxHeight = catWalkState.currentY - (20 + Math.random() * 80);
  return true;
}

/** Get the cat's current canvas position for hit testing */
export function getCatPosition(): { x: number; y: number } | null {
  if (!catWalkState) return null;
  return { x: catWalkState.currentX, y: catWalkState.currentY };
}

/** Get an agent's current rendered position (walk position or desk position) */
export function getAgentPosition(agentId: string): { x: number; y: number } | null {
  const ws = walkStates.get(agentId);
  if (ws) return { x: ws.currentX, y: ws.currentY };
  return null;
}

// Teleport beam system — subtle beam-up / beam-down when agents transition
interface TeleportBeam {
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  frame: number;
  agentId: string;
}
const activeBeams: TeleportBeam[] = [];
const BEAM_UP_DURATION = 14;   // frames to dissolve up
const BEAM_DOWN_DURATION = 14; // frames to reassemble
const BEAM_TOTAL = BEAM_UP_DURATION + BEAM_DOWN_DURATION + 4; // +4 gap
const BEAM_COLORS = ["#aaccff", "#88aadd", "#ccddff", "#ffffff", "#99bbee"];
// Track which agents are currently beaming (hide their sprite)
const beamingAgents = new Set<string>();
// Track last known state to detect wander→desk transitions
const lastAgentState = new Map<string, string>();
// Track known agents to detect first appearance (beam-in)
const knownAgentIds = new Set<string>();
// Sticky quadrant assignment — each CC keeps its slot for the session
const stickyQuadrants = new Map<string, number>();

// Poof particle system
interface Poof {
  x: number;
  y: number;
  frame: number;
  color: string;
}
const activePoofs: Poof[] = [];
const poofedIds = new Set<string>();
const POOF_DURATION = 30;
const POOF_COLORS = ["#ffee88", "#ffcc44", "#ffaa22", "#fff", "#eedd66", "#ff88ff", "#88eeff"];

// Cat wanders across the whole room floor
import { BUILDING_X, BUILDING_Y, BUILDING_W, FLOOR_Y, FLOOR_H } from "./environment";
const CAT_HOME_X = BUILDING_X + BUILDING_W / 2;
const CAT_HOME_Y = FLOOR_Y + FLOOR_H / 2;

function hashForPhase(id: string): number {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = (hash * 17 + id.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

interface DrawableEntity {
  x: number;
  y: number;
  spriteKey: CharacterType;
  spriteState: string;
  agentId: string;
  isUnreachable: boolean;
  parentId: string | null;
  flipX: boolean;
  teamColor: number;
  isMainCC: boolean;
  activityState: string;
  source: string;
}

/** Get health poster bounds for click hit-testing */
export function getHealthPosterBounds(): { x: number; y: number; w: number; h: number } | null {
  const { healthPosterOn, statusPosterOn, clawHealth } = useAgentOfficeStore.getState();
  if (!healthPosterOn || !clawHealth) return null;
  const posterBaseX = BUILDING_X + 33 + 5;
  const contentW = 3 * 3 + 1 + 2;
  const pad = 2;
  const totalW = contentW + pad * 2 + 2;
  const totalH = (3 * 4 - 2) + pad * 2 + 2;
  const monitors = useAgentOfficeStore.getState().monitors;
  const showStatus = statusPosterOn && monitors.length > 0;
  const px = showStatus ? posterBaseX + totalW + 4 : posterBaseX;
  return { x: px - pad - 1, y: BUILDING_Y + 3 + 5 - pad - 1, w: totalW, h: totalH };
}

// Status poster — on the back wall near the fireplace
const STATUS_UP = "#22c55e";
const STATUS_DOWN = "#ef4444";
const BAR_COLOR = "#2a2a2a";

function renderStatusPoster(
  ctx: CanvasRenderingContext2D,
  monitors: MonitorStatus[],
  theme: SceneTheme
) {
  const contentW = 3 * 3 + 1 + 2;
  const contentH = 3 * 4 - 2;
  const pad = 2;
  const mount = theme.posterMount;

  // Position: near fireplace area, adjusted for building-less themes
  const px = BUILDING_X + 33 + 5;
  const py = BUILDING_Y + 3 + 5;

  const totalW = contentW + pad * 2 + 2;
  const totalH = contentH + pad * 2 + 2;
  const mx = px - pad - 1;
  const my = py - pad - 1;

  if (mount.style === "wall") {
    // Simple wall-mounted poster
    ctx.fillStyle = mount.colorDark;
    ctx.fillRect(mx, my, totalW, totalH);
    ctx.fillStyle = mount.color;
    ctx.fillRect(mx + 1, my + 1, totalW - 2, totalH - 2);
  } else if (mount.style === "stone-tablet") {
    // Carved stone tablet with chiseled edges
    ctx.fillStyle = mount.colorDark;
    ctx.fillRect(mx - 1, my - 1, totalW + 2, totalH + 4);
    ctx.fillStyle = mount.color;
    ctx.fillRect(mx, my, totalW, totalH + 2);
    ctx.fillStyle = mount.colorLight;
    ctx.fillRect(mx, my, totalW, 1); // top chisel highlight
    ctx.fillRect(mx, my, 1, totalH + 2); // left highlight
    // Pedestal base
    ctx.fillStyle = mount.colorDark;
    ctx.fillRect(mx - 1, my + totalH + 2, totalW + 2, 2);
    ctx.fillStyle = mount.colorLight;
    ctx.fillRect(mx, my + totalH + 2, totalW, 1);
  } else if (mount.style === "wooden-sign") {
    // Wooden sign on two posts
    // Posts
    ctx.fillStyle = mount.colorDark;
    ctx.fillRect(mx + 1, my - 2, 2, totalH + 6);
    ctx.fillRect(mx + totalW - 3, my - 2, 2, totalH + 6);
    // Sign board
    ctx.fillStyle = mount.color;
    ctx.fillRect(mx, my, totalW, totalH);
    ctx.fillStyle = mount.colorLight;
    ctx.fillRect(mx, my, totalW, 1);
    // Rope lashings at top
    ctx.fillStyle = mount.colorDark;
    ctx.fillRect(mx + 1, my - 1, 2, 2);
    ctx.fillRect(mx + totalW - 3, my - 1, 2, 2);
  } else if (mount.style === "metal-panel") {
    // Metal panel on a thin post
    // Post
    ctx.fillStyle = mount.colorDark;
    ctx.fillRect(mx + Math.floor(totalW / 2), my + totalH, 2, 6);
    // Metal plate
    ctx.fillStyle = mount.color;
    ctx.fillRect(mx, my, totalW, totalH);
    ctx.fillStyle = mount.colorLight;
    ctx.fillRect(mx, my, totalW, 1);
    // Bolt dots at corners
    ctx.fillStyle = mount.colorDark;
    ctx.fillRect(mx + 1, my + 1, 1, 1);
    ctx.fillRect(mx + totalW - 2, my + 1, 1, 1);
    ctx.fillRect(mx + 1, my + totalH - 2, 1, 1);
    ctx.fillRect(mx + totalW - 2, my + totalH - 2, 1, 1);
  } else {
    // Driftwood — weathered plank on angled stick
    // Angled support stick
    ctx.fillStyle = mount.colorDark;
    ctx.fillRect(mx + Math.floor(totalW / 2), my - 3, 2, totalH + 8);
    ctx.fillRect(mx + Math.floor(totalW / 2) - 1, my + totalH + 3, 4, 2);
    // Weathered plank
    ctx.fillStyle = mount.color;
    ctx.fillRect(mx - 1, my, totalW + 2, totalH);
    ctx.fillStyle = mount.colorLight;
    ctx.fillRect(mx - 1, my, totalW + 2, 1);
    // Wood grain
    ctx.fillStyle = mount.colorDark;
    ctx.fillRect(mx + 2, my + 2, totalW - 4, 1);
    ctx.fillRect(mx + 3, my + totalH - 3, totalW - 6, 1);
  }

  // Content area background
  ctx.fillStyle = "rgba(0,0,0,0.3)";
  ctx.fillRect(px - pad, py - pad, contentW + pad * 2, contentH + pad * 2);

  const barCounts = [3, 2, 1];
  const rowH = 4;
  const dotCol = px + 3 * 3 + 1;

  for (let i = 0; i < 3 && i < monitors.length; i++) {
    const mon = monitors[i];
    const ry = py + i * rowH;

    ctx.fillStyle = BAR_COLOR;
    for (let b = 0; b < barCounts[i]; b++) {
      ctx.fillRect(px + b * 3, ry, 2, 2);
    }

    ctx.fillStyle = mon.up ? STATUS_UP : STATUS_DOWN;
    ctx.fillRect(dotCol, ry, 2, 2);
  }
}

function renderHealthPoster(
  ctx: CanvasRenderingContext2D,
  clawHealth: ClawHealth,
  theme: SceneTheme,
  posterX: number
) {
  // Match dimensions/style of the status poster (same height: 3 rows)
  const contentW = 3 * 3 + 1 + 2; // same as status poster
  const contentH = 3 * 4 - 2; // same 3-row height as status poster
  const pad = 2;
  const mount = theme.posterMount;

  const px = posterX;
  const py = BUILDING_Y + 3 + 5;

  const totalW = contentW + pad * 2 + 2;
  const totalH = contentH + pad * 2 + 2;
  const mx = px - pad - 1;
  const my = py - pad - 1;

  // Draw themed mount (same logic as status poster)
  if (mount.style === "wall") {
    ctx.fillStyle = mount.colorDark;
    ctx.fillRect(mx, my, totalW, totalH);
    ctx.fillStyle = mount.color;
    ctx.fillRect(mx + 1, my + 1, totalW - 2, totalH - 2);
  } else if (mount.style === "stone-tablet") {
    ctx.fillStyle = mount.colorDark;
    ctx.fillRect(mx - 1, my - 1, totalW + 2, totalH + 4);
    ctx.fillStyle = mount.color;
    ctx.fillRect(mx, my, totalW, totalH + 2);
    ctx.fillStyle = mount.colorLight;
    ctx.fillRect(mx, my, totalW, 1);
    ctx.fillRect(mx, my, 1, totalH + 2);
    ctx.fillStyle = mount.colorDark;
    ctx.fillRect(mx - 1, my + totalH + 2, totalW + 2, 2);
    ctx.fillStyle = mount.colorLight;
    ctx.fillRect(mx, my + totalH + 2, totalW, 1);
  } else if (mount.style === "wooden-sign") {
    ctx.fillStyle = mount.colorDark;
    ctx.fillRect(mx + 1, my - 2, 2, totalH + 6);
    ctx.fillRect(mx + totalW - 3, my - 2, 2, totalH + 6);
    ctx.fillStyle = mount.color;
    ctx.fillRect(mx, my, totalW, totalH);
    ctx.fillStyle = mount.colorLight;
    ctx.fillRect(mx, my, totalW, 1);
    ctx.fillStyle = mount.colorDark;
    ctx.fillRect(mx + 1, my - 1, 2, 2);
    ctx.fillRect(mx + totalW - 3, my - 1, 2, 2);
  } else if (mount.style === "metal-panel") {
    ctx.fillStyle = mount.colorDark;
    ctx.fillRect(mx + Math.floor(totalW / 2), my + totalH, 2, 6);
    ctx.fillStyle = mount.color;
    ctx.fillRect(mx, my, totalW, totalH);
    ctx.fillStyle = mount.colorLight;
    ctx.fillRect(mx, my, totalW, 1);
    ctx.fillStyle = mount.colorDark;
    ctx.fillRect(mx + 1, my + 1, 1, 1);
    ctx.fillRect(mx + totalW - 2, my + 1, 1, 1);
    ctx.fillRect(mx + 1, my + totalH - 2, 1, 1);
    ctx.fillRect(mx + totalW - 2, my + totalH - 2, 1, 1);
  } else {
    ctx.fillStyle = mount.colorDark;
    ctx.fillRect(mx + Math.floor(totalW / 2), my - 3, 2, totalH + 8);
    ctx.fillRect(mx + Math.floor(totalW / 2) - 1, my + totalH + 3, 4, 2);
    ctx.fillStyle = mount.color;
    ctx.fillRect(mx - 1, my, totalW + 2, totalH);
    ctx.fillStyle = mount.colorLight;
    ctx.fillRect(mx - 1, my, totalW + 2, 1);
    ctx.fillStyle = mount.colorDark;
    ctx.fillRect(mx + 2, my + 2, totalW - 4, 1);
    ctx.fillRect(mx + 3, my + totalH - 3, totalW - 6, 1);
  }

  // Content area background
  ctx.fillStyle = "rgba(0,0,0,0.3)";
  ctx.fillRect(px - pad, py - pad, contentW + pad * 2, contentH + pad * 2);

  const dotCol = px + 3 * 3 + 1;

  // Row 1 (top): claw server — simple "C" shape
  const r1y = py + 1;
  ctx.fillStyle = BAR_COLOR;
  ctx.fillRect(px + 1, r1y, 3, 1);     // top bar
  ctx.fillRect(px, r1y + 1, 1, 1);     // left side
  ctx.fillRect(px + 1, r1y + 2, 3, 1); // bottom bar
  ctx.fillStyle = clawHealth.reachable ? STATUS_UP : STATUS_DOWN;
  ctx.fillRect(dotCol, r1y, 2, 2);

  // Row 2 (bottom): yeelight — rays around a dot
  const r2y = py + contentH - 3;
  ctx.fillStyle = BAR_COLOR;
  ctx.fillRect(px + 2, r2y, 1, 1);     // top ray
  ctx.fillRect(px + 1, r2y + 1, 3, 1); // middle band with center
  ctx.fillRect(px + 2, r2y + 2, 1, 1); // bottom ray
  ctx.fillRect(px, r2y + 1, 1, 1);     // left ray
  ctx.fillRect(px + 4, r2y + 1, 1, 1); // right ray
  ctx.fillStyle = clawHealth.yeelightConnected ? STATUS_UP : STATUS_DOWN;
  ctx.fillRect(dotCol, r2y, 2, 2);
}

import { getTimeOfDay, type TimeOfDay } from "./environment";
import type { SceneTheme } from "./themes/types";
import { forestTheme } from "./themes/forest";
import { getPixelTowerData } from "@/hooks/use-pixel-tower";

const OBELISK_COLS = 5;
const OBELISK_ROWS = 5;
const OBELISK_DOT = 2;    // each pixel dot is 2x2 canvas pixels
const OBELISK_GAP = 1;    // 1px gap between dots
const OBELISK_PAD = 2;    // padding inside the slab
const OBELISK_PANEL_GAP = 3; // gap between panels

function drawObelisk(ctx: CanvasRenderingContext2D, theme: SceneTheme, frame: number, timeOverride?: TimeOfDay) {
  const { data, connected } = getPixelTowerData();
  if (!connected) return;

  const dotStep = OBELISK_DOT + OBELISK_GAP;
  const panelW = OBELISK_COLS * dotStep - OBELISK_GAP;
  const panelH = OBELISK_ROWS * dotStep - OBELISK_GAP;
  const slabW = panelW + OBELISK_PAD * 2;
  const slabH = 3 * panelH + 2 * OBELISK_PANEL_GAP + OBELISK_PAD * 2;

  // Centered along back wall, towers above it
  const cx = Math.floor(BUILDING_X + BUILDING_W / 2) - 3;
  const ox = cx - Math.floor(slabW / 2);
  const oy = BUILDING_Y - slabH + 29; // top extends above the back wall


  // Tropical island: worship stones around the base
  if (theme.id === "tropical-island") {
    const baseY = oy + slabH;
    const baseCX = cx;
    const stoneColors = ["#8a7a60", "#7a6a50", "#6a5a40", "#9a8a70", "#857560"];
    const stoneHighlight = "#a09078";
    const stones = [
      { dx: -12, dy: 4, w: 4, h: 3 }, { dx: -7, dy: 6, w: 3, h: 2 },
      { dx: -1, dy: 7, w: 4, h: 3 }, { dx: 6, dy: 6, w: 3, h: 2 },
      { dx: 10, dy: 4, w: 4, h: 3 },
      { dx: -14, dy: -2, w: 3, h: 3 }, { dx: -15, dy: 1, w: 3, h: 2 },
      { dx: 12, dy: -2, w: 3, h: 3 }, { dx: 13, dy: 1, w: 3, h: 2 },
      { dx: -18, dy: 3, w: 2, h: 2 }, { dx: 17, dy: 5, w: 2, h: 2 },
      { dx: -4, dy: 9, w: 2, h: 2 }, { dx: 4, dy: 10, w: 3, h: 2 },
    ];
    for (let si = 0; si < stones.length; si++) {
      const s = stones[si];
      const sx = baseCX + s.dx;
      const sy = baseY + s.dy;
      ctx.fillStyle = stoneColors[(si * 3) % stoneColors.length];
      ctx.fillRect(sx, sy, s.w, s.h);
      ctx.fillStyle = stoneHighlight;
      ctx.fillRect(sx, sy, s.w, 1);
    }
  }

  // Golden Ruins: crumbling Egyptian temple blocks around the obelisk
  if (theme.id === "golden-ruins") {
    const baseY = oy + slabH;
    const baseCX = cx;
    const blockDark = "#8a7050";
    const blockMid = "#a08860";
    const blockLight = "#b8a070";
    const blockShadow = "#6a5840";

    // Large broken column base — left side
    ctx.fillStyle = blockShadow;
    ctx.fillRect(baseCX - 24, baseY - 8, 8, 12);
    ctx.fillStyle = blockMid;
    ctx.fillRect(baseCX - 24, baseY - 8, 8, 10);
    ctx.fillStyle = blockLight;
    ctx.fillRect(baseCX - 24, baseY - 8, 8, 1);
    // Crumbled top — jagged
    ctx.fillStyle = blockMid;
    ctx.fillRect(baseCX - 23, baseY - 10, 3, 2);
    ctx.fillRect(baseCX - 19, baseY - 9, 2, 1);

    // Large broken column base — right side
    ctx.fillStyle = blockShadow;
    ctx.fillRect(baseCX + 16, baseY - 8, 8, 12);
    ctx.fillStyle = blockMid;
    ctx.fillRect(baseCX + 16, baseY - 8, 8, 10);
    ctx.fillStyle = blockLight;
    ctx.fillRect(baseCX + 16, baseY - 8, 8, 1);
    ctx.fillStyle = blockMid;
    ctx.fillRect(baseCX + 17, baseY - 10, 2, 2);
    ctx.fillRect(baseCX + 21, baseY - 9, 3, 1);

    // Stepped platform / altar base beneath obelisk
    ctx.fillStyle = blockShadow;
    ctx.fillRect(baseCX - 14, baseY + 1, 28, 5);
    ctx.fillStyle = blockMid;
    ctx.fillRect(baseCX - 14, baseY + 1, 28, 4);
    ctx.fillStyle = blockLight;
    ctx.fillRect(baseCX - 14, baseY + 1, 28, 1);
    // Wider lower step
    ctx.fillStyle = blockShadow;
    ctx.fillRect(baseCX - 18, baseY + 5, 36, 4);
    ctx.fillStyle = blockMid;
    ctx.fillRect(baseCX - 18, baseY + 5, 36, 3);
    ctx.fillStyle = blockLight;
    ctx.fillRect(baseCX - 18, baseY + 5, 36, 1);

    // Fallen blocks — scattered rubble
    const rubble = [
      { dx: -20, dy: 6, w: 5, h: 3 },
      { dx: -28, dy: 2, w: 6, h: 4 },
      { dx: -30, dy: 5, w: 4, h: 3 },
      { dx: 22, dy: 6, w: 5, h: 3 },
      { dx: 26, dy: 3, w: 6, h: 4 },
      { dx: 30, dy: 6, w: 4, h: 2 },
      // Small debris
      { dx: -16, dy: 10, w: 3, h: 2 },
      { dx: 14, dy: 11, w: 3, h: 2 },
      { dx: -8, dy: 12, w: 2, h: 2 },
      { dx: 8, dy: 13, w: 2, h: 2 },
      { dx: -33, dy: 7, w: 2, h: 2 },
      { dx: 34, dy: 8, w: 2, h: 2 },
    ];
    for (let ri = 0; ri < rubble.length; ri++) {
      const r = rubble[ri];
      const rx = baseCX + r.dx;
      const ry = baseY + r.dy;
      ctx.fillStyle = blockShadow;
      ctx.fillRect(rx, ry, r.w, r.h);
      ctx.fillStyle = ri < 6 ? blockMid : blockDark;
      ctx.fillRect(rx, ry, r.w, r.h - 1);
      ctx.fillStyle = blockLight;
      ctx.fillRect(rx, ry, r.w, 1);
    }

    // Carved line detail on the column bases
    ctx.fillStyle = blockShadow;
    ctx.fillRect(baseCX - 23, baseY - 4, 6, 1);
    ctx.fillRect(baseCX + 17, baseY - 4, 6, 1);
  }

  // Forest: spirit shrine (disabled for now)
  if (false && theme.id === "forest") {
    const baseY = oy + slabH;
    const baseCX = cx;

    // Shallow wide puddle — mostly horizontal, barely extends down
    const poolDark = "#2a5a4a";
    const poolMid = "#3a7a5a";
    const poolLight = "#5a9a7a";
    const poolShimmer = "#7abaa0";

    // Wide shallow shape
    ctx.fillStyle = poolDark;
    ctx.fillRect(baseCX - 22, baseY + 2, 44, 4);
    ctx.fillRect(baseCX - 18, baseY + 1, 36, 2);
    ctx.fillStyle = poolMid;
    ctx.fillRect(baseCX - 20, baseY + 2, 40, 3);
    // Ripple highlights
    ctx.fillStyle = poolLight;
    ctx.fillRect(baseCX - 14, baseY + 3, 5, 1);
    ctx.fillRect(baseCX + 6, baseY + 3, 4, 1);
    ctx.fillStyle = poolShimmer;
    ctx.fillRect(baseCX - 8, baseY + 2, 2, 1);
    ctx.fillRect(baseCX + 10, baseY + 3, 2, 1);

    // Mossy stones — wide ring, mostly to the sides
    const mossStone = "#3a4a2a";
    const mossStoneLt = "#4a5a3a";
    const mossStoneHi = "#5a6a4a";
    const mossTop = "#6a8a4a"; // bright moss cap
    const stones = [
      // Left flank
      { dx: -24, dy: -1, w: 4, h: 3 },
      { dx: -26, dy: 2, w: 3, h: 2 },
      { dx: -22, dy: 4, w: 3, h: 2 },
      // Right flank
      { dx: 22, dy: -1, w: 4, h: 3 },
      { dx: 24, dy: 2, w: 3, h: 2 },
      { dx: 20, dy: 4, w: 3, h: 2 },
      // Front — spread wide, not deep
      { dx: -14, dy: 5, w: 3, h: 2 },
      { dx: -6, dy: 6, w: 3, h: 2 },
      { dx: 5, dy: 6, w: 3, h: 2 },
      { dx: 13, dy: 5, w: 3, h: 2 },
    ];
    for (const s of stones) {
      const sx = baseCX + s.dx;
      const sy = baseY + s.dy;
      ctx.fillStyle = mossStone;
      ctx.fillRect(sx, sy, s.w, s.h);
      ctx.fillStyle = mossStoneLt;
      ctx.fillRect(sx, sy, s.w, s.h - 1);
      ctx.fillStyle = mossStoneHi;
      ctx.fillRect(sx, sy, s.w, 1);
      // Moss patches on top
      ctx.fillStyle = mossTop;
      ctx.fillRect(sx + 1, sy, 1, 1);
    }

    // Lush fern clusters — flanking wide
    const fern1 = "#1a6a2a";
    const fern2 = "#2a8a3a";
    const fern3 = "#3aaa4a";
    const fernBright = "#5acc6a";

    // Left fern cluster — tall, bushy
    ctx.fillStyle = fern1;
    ctx.fillRect(baseCX - 26, baseY - 4, 2, 6);
    ctx.fillRect(baseCX - 28, baseY - 2, 1, 4);
    ctx.fillRect(baseCX - 24, baseY - 6, 1, 4);
    ctx.fillStyle = fern2;
    ctx.fillRect(baseCX - 27, baseY - 5, 2, 4);
    ctx.fillRect(baseCX - 25, baseY - 7, 2, 4);
    ctx.fillStyle = fern3;
    ctx.fillRect(baseCX - 26, baseY - 7, 1, 2);
    ctx.fillRect(baseCX - 28, baseY - 3, 1, 1);
    ctx.fillStyle = fernBright;
    ctx.fillRect(baseCX - 25, baseY - 8, 1, 1);

    // Right fern cluster
    ctx.fillStyle = fern1;
    ctx.fillRect(baseCX + 24, baseY - 4, 2, 6);
    ctx.fillRect(baseCX + 27, baseY - 2, 1, 4);
    ctx.fillRect(baseCX + 23, baseY - 6, 1, 4);
    ctx.fillStyle = fern2;
    ctx.fillRect(baseCX + 25, baseY - 5, 2, 4);
    ctx.fillRect(baseCX + 23, baseY - 7, 2, 4);
    ctx.fillStyle = fern3;
    ctx.fillRect(baseCX + 25, baseY - 7, 1, 2);
    ctx.fillRect(baseCX + 27, baseY - 3, 1, 1);
    ctx.fillStyle = fernBright;
    ctx.fillRect(baseCX + 24, baseY - 8, 1, 1);

    // Small ground ferns along the stone ring
    const groundFerns = [
      { dx: -16, dy: 5 }, { dx: -8, dy: 6 },
      { dx: 7, dy: 6 }, { dx: 15, dy: 5 },
      { dx: -23, dy: 3 }, { dx: 25, dy: 3 },
    ];
    for (const f of groundFerns) {
      ctx.fillStyle = fern2;
      ctx.fillRect(baseCX + f.dx, baseY + f.dy, 2, 1);
      ctx.fillStyle = fern3;
      ctx.fillRect(baseCX + f.dx, baseY + f.dy - 1, 1, 1);
      ctx.fillRect(baseCX + f.dx + 1, baseY + f.dy - 1, 1, 1);
    }

    // Exotic glowing flowers
    const flower1 = "#cc55aa";
    const flower2 = "#aa44dd";
    const flower3 = "#55ddbb";
    const flowers = [
      { dx: -27, dy: -6, c: flower1 }, { dx: 26, dy: -6, c: flower2 },
      { dx: -15, dy: 5, c: flower3 }, { dx: 14, dy: 5, c: flower1 },
      { dx: -7, dy: 7, c: flower2 }, { dx: 8, dy: 7, c: flower3 },
    ];
    for (const fl of flowers) {
      ctx.fillStyle = fl.c;
      ctx.fillRect(baseCX + fl.dx, baseY + fl.dy, 1, 1);
    }

    // Hanging vine tendrils down the obelisk sides
    ctx.fillStyle = fern1;
    ctx.fillRect(ox - 1, baseY - 6, 1, 6);
    ctx.fillRect(ox - 2, baseY - 3, 1, 3);
    ctx.fillRect(ox + slabW, baseY - 5, 1, 5);
    ctx.fillRect(ox + slabW + 1, baseY - 3, 1, 3);
    ctx.fillStyle = fern2;
    ctx.fillRect(ox - 1, baseY - 8, 1, 3);
    ctx.fillRect(ox + slabW, baseY - 7, 1, 3);
  }


  // Stone base (slightly wider)
  ctx.fillStyle = "#222228";
  ctx.fillRect(ox - 1, oy + slabH, slabW + 2, 3);
  ctx.fillStyle = "#2a2a30";
  ctx.fillRect(ox - 1, oy + slabH, slabW + 2, 1);

  // Black obsidian slab
  ctx.fillStyle = "#0a0a10";
  ctx.fillRect(ox, oy, slabW, slabH);
  // Subtle edge highlights
  ctx.fillStyle = "#1a1a22";
  ctx.fillRect(ox, oy, slabW, 1);
  ctx.fillRect(ox, oy, 1, slabH);
  ctx.fillStyle = "#060608";
  ctx.fillRect(ox + slabW - 1, oy, 1, slabH);

  // Apply time-of-day color cast to the slab
  const tod = timeOverride ?? getTimeOfDay();
  const tint = theme.timeTints[tod];
  if (tint.opacity > 0) {
    ctx.globalAlpha = tint.opacity * 0.7;
    ctx.fillStyle = tint.color;
    ctx.fillRect(ox, oy, slabW, slabH);
    ctx.globalAlpha = 1;
  }

  // Draw three panels (top = diffused, middle/bottom = dots)
  const panels = [data.panels.top, data.panels.middle, data.panels.bottom];
  for (let p = 0; p < 3; p++) {
    const pixels = panels[p];
    const panelY = oy + OBELISK_PAD + p * (panelH + OBELISK_PANEL_GAP);
    const panelX = ox + OBELISK_PAD;

    if (p === 0) {
      // Top panel: diffusion screen with 4 corner quadrants (2x2 each), no center dot
      // Corner quadrants: TL(0,1,5,6) TR(3,4,8,9) BL(15,16,20,21) BR(18,19,23,24)
      const quadrants = [
        [0, 1, 5, 6],     // top-left
        [3, 4, 8, 9],     // top-right
        [15, 16, 20, 21], // bottom-left
        [18, 19, 23, 24], // bottom-right
      ];

      // Average all lit colors for the pulsing overlay
      let rSum = 0, gSum = 0, bSum = 0, litCount = 0;
      for (const color of pixels) {
        if (color !== "#000000") {
          rSum += parseInt(color.slice(1, 3), 16);
          gSum += parseInt(color.slice(3, 5), 16);
          bSum += parseInt(color.slice(5, 7), 16);
          litCount++;
        }
      }

      // Draw the 4 corner quadrant dots through diffusion
      for (const quad of quadrants) {
        for (const i of quad) {
          const col = i % OBELISK_COLS;
          const row = (OBELISK_ROWS - 1) - Math.floor(i / OBELISK_COLS);
          const color = pixels[i];
          const dx = panelX + col * dotStep;
          const dy = panelY + row * dotStep;

          if (color !== "#000000") {
            // Brighten color by 35%
            const br = Math.min(255, Math.round(parseInt(color.slice(1, 3), 16) * 1.35));
            const bg = Math.min(255, Math.round(parseInt(color.slice(3, 5), 16) * 1.35));
            const bb = Math.min(255, Math.round(parseInt(color.slice(5, 7), 16) * 1.35));
            const bright = `rgb(${br},${bg},${bb})`;
            // Diffused glow per dot
            ctx.globalAlpha = 0.25;
            ctx.fillStyle = bright;
            ctx.fillRect(dx - 1, dy - 1, OBELISK_DOT + 2, OBELISK_DOT + 2);
            // Brighter core
            ctx.globalAlpha = 0.6;
            ctx.fillStyle = bright;
            ctx.fillRect(dx, dy, OBELISK_DOT, OBELISK_DOT);
          }
        }
      }
      ctx.globalAlpha = 1;

      if (litCount > 0) {
        // Static white diffusion panel over the whole face when active
        ctx.globalAlpha = 0.08;
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(panelX, panelY, panelW, panelH);
        ctx.globalAlpha = 1;
      }

    } else {
      // Middle and bottom panels: individual dots
      for (let i = 0; i < pixels.length; i++) {
        const col = i % OBELISK_COLS;
        const row = (OBELISK_ROWS - 1) - Math.floor(i / OBELISK_COLS);
        const color = pixels[i];
        const isLit = color !== "#000000";

        const dx = panelX + col * dotStep;
        const dy = panelY + row * dotStep;

        if (isLit) {
          ctx.globalAlpha = 0.2;
          ctx.fillStyle = color;
          ctx.fillRect(dx - 1, dy - 1, OBELISK_DOT + 2, OBELISK_DOT + 2);
          ctx.globalAlpha = 1;
          ctx.fillStyle = color;
          ctx.fillRect(dx, dy, OBELISK_DOT, OBELISK_DOT);
        }
      }
    }
  }
}

export function renderScene(
  ctx: CanvasRenderingContext2D,
  agents: AgentState[],
  spriteCache: ReturnType<typeof buildSpriteCache>,
  frame: number,
  monitors?: MonitorStatus[],
  timeOverride?: TimeOfDay,
  theme: SceneTheme = forestTheme
) {
  // 1. Desk avoid zones — shared by all walkers
  const deskAvoidZones: AvoidZone[] = DESK_POSITIONS.map((d) => ({
    x: d.x,
    y: d.y,
    hw: 14,
    hh: 10,
  }));

  // 2. Assign desks only to non-lounging agents
  const deskEligible = agents.filter((a) => a.state !== "lounging" && a.state !== "departing");
  const deskMap = assignDesks(deskEligible.map((a) => a.id));

  // 3. Determine which desk indices have laptops (main agents only, not subagents/mages)
  const occupiedDeskIndices = new Set<number>();
  for (const agent of deskEligible) {
    if (agent.subagentClass !== null && agent.subagentClass !== undefined) continue;
    const pos = deskMap.get(agent.id);
    if (!pos) continue;
    const idx = DESK_POSITIONS.indexOf(pos);
    if (idx >= 0) occupiedDeskIndices.add(idx);
  }

  // 4. Draw environment
  const deskCenters = DESK_POSITIONS.map((d) => ({ x: d.x, y: d.y }));
  drawEnvironment(ctx, deskCenters, occupiedDeskIndices, frame, timeOverride, theme);

  // 4.5. Posters on the back wall
  const { statusPosterOn, healthPosterOn } = useAgentOfficeStore.getState();
  const clawHealth = useAgentOfficeStore.getState().clawHealth;
  const posterBaseX = BUILDING_X + 33 + 5;
  const posterContentW = 3 * 3 + 1 + 2;
  const posterTotalW = posterContentW + 2 * 2 + 2; // contentW + pad*2 + border
  const showStatusPoster = statusPosterOn && monitors && monitors.length > 0;

  if (showStatusPoster) {
    renderStatusPoster(ctx, monitors!, theme);
  }

  if (healthPosterOn && clawHealth) {
    const healthX = showStatusPoster ? posterBaseX + posterTotalW + 4 : posterBaseX;
    renderHealthPoster(ctx, clawHealth, theme, healthX);
  }

  // 4.6. Obelisk (in-scene pixel tower)
  const { towerSize, towerVisible } = useAgentOfficeStore.getState();
  if (towerVisible && towerSize === "obelisk") {
    drawObelisk(ctx, theme, frame, timeOverride);
  }

  // 4.7. Laptop glow — each CC agent mapped to its tower quadrant
  //   Quadrant lit (gold)  → gold laptop glow
  //   Agent doing tool     → hirst color cycle
  //   Quadrant off (black) → no glow
  const towerInfo = getPixelTowerData();
  if (towerInfo.connected) {
    const topPixels = towerInfo.data.panels.top;
    const SLOT_PIXELS = [
      [15, 16, 20, 21], // slot 0 — BL quadrant (claw slot 0)
      [18, 19, 23, 24], // slot 1 — BR quadrant (claw slot 1)
      [0, 1, 5, 6],     // slot 2 — TL quadrant (claw slot 2)
      [3, 4, 8, 9],     // slot 3 — TR quadrant (claw slot 3)
    ];
    // Collect main CC agents (non-subagent)
    const mainCCs = agents.filter(
      (a) => a.source === "cc" && (a.subagentClass === null || a.subagentClass === undefined)
    );
    // Sticky quadrant assignment — first CC claims slot 0, second claims slot 1, etc.
    // Clean up agents that left
    for (const id of stickyQuadrants.keys()) {
      if (!mainCCs.some((a) => a.id === id)) stickyQuadrants.delete(id);
    }
    // Assign unassigned CCs to the next free slot
    const takenSlots = new Set(stickyQuadrants.values());
    for (const agent of mainCCs) {
      if (stickyQuadrants.has(agent.id)) continue;
      for (let s = 0; s < 4; s++) {
        if (!takenSlots.has(s)) {
          stickyQuadrants.set(agent.id, s);
          takenSlots.add(s);
          break;
        }
      }
    }
    // Draw glow for each assigned CC based on their quadrant's pixels
    for (const agent of mainCCs) {
      const slot = stickyQuadrants.get(agent.id);
      if (slot === undefined) continue;
      const quadrantLit = SLOT_PIXELS[slot].some((i) => topPixels[i] !== "#000000");
      if (!quadrantLit) continue;
      if (agent.state === "lounging" || agent.state === "departing") continue;
      const pos = deskMap.get(agent.id);
      if (!pos) continue;
      const dx = pos.x;
      const dy = pos.y;
      const isTool = agent.state === "reading" || agent.state === "typing" || agent.state === "waiting";
      if (isTool) {
        // Hirst cycle — muted, slow
        const HIRST = [
          "#cc5544", "#cc9944", "#aacc55", "#55aa77",
          "#5599aa", "#5566cc", "#8855aa", "#aa5577",
        ];
        const color = HIRST[Math.floor(frame / 4) % HIRST.length];
        ctx.globalAlpha = 0.15;
        ctx.fillStyle = color;
        ctx.fillRect(dx + 2, dy + 1, 4, 4);
        ctx.globalAlpha = 0.3;
        ctx.fillRect(dx + 2, dy + 1, 3, 3);
        ctx.globalAlpha = 0.55;
        ctx.fillRect(dx + 3, dy + 2, 2, 2);
        ctx.globalAlpha = 1;
      } else {
        // Gold glow — thinking phase
        ctx.globalAlpha = 0.1;
        ctx.fillStyle = "#cc8800";
        ctx.fillRect(dx + 2, dy + 1, 4, 4);
        ctx.globalAlpha = 0.25;
        ctx.fillStyle = "#ddaa22";
        ctx.fillRect(dx + 2, dy + 1, 3, 3);
        ctx.globalAlpha = 0.7;
        ctx.fillStyle = "#ffcc44";
        ctx.fillRect(dx + 3, dy + 2, 2, 2);
        ctx.globalAlpha = 1;
      }
    }
  }

  // 5. Lounge zones — fireplace area (left) and guitar/amp area (right)
  const loungeFireplace = { x: BUILDING_X + 18, y: FLOOR_Y + 12 };
  const loungeGuitar = { x: BUILDING_X + BUILDING_W - 20, y: FLOOR_Y + 12 };

  // 6. Build drawable entities
  const entities: DrawableEntity[] = [];

  for (const agent of agents) {
    // Departing — spawn poof and skip
    if (agent.state === "departing" && !poofedIds.has(agent.id)) {
      const ws = walkStates.get(agent.id);
      const pos = deskMap.get(agent.id);
      const px = ws ? ws.currentX : pos ? pos.characterX : 0;
      const py = ws ? ws.currentY : pos ? pos.characterY : 0;
      activePoofs.push({ x: px, y: py, frame: 0, color: POOF_COLORS[Math.floor(Math.random() * POOF_COLORS.length)] });
      poofedIds.add(agent.id);
      continue;
    }
    if (agent.state === "departing") continue;

    let charType: CharacterType;
    if (agent.subagentClass !== null && agent.subagentClass !== undefined) {
      charType = `mage-${agent.subagentClass}` as CharacterType;
    } else if (agent.source === "openclaw") {
      charType = "claw";
    } else {
      charType = "clawd";
    }

    let drawX: number;
    let drawY: number;
    let spriteState: string = agent.state;
    let flipX = false;

    if (agent.state === "lounging") {
      // Lounging agents wander near fireplace or guitar
      const loungeHome = hashForPhase(agent.id) % 2 === 0 ? loungeFireplace : loungeGuitar;
      if (!walkStates.has(agent.id)) {
        walkStates.set(agent.id, createWalkState(loungeHome.x, loungeHome.y));
      }
      const ws = walkStates.get(agent.id)!;
      updateWalkState(ws, false, loungeHome.x, loungeHome.y, 18, deskAvoidZones);
      drawX = ws.currentX;
      drawY = ws.currentY;
      flipX = ws.facingRight;
      const walkSprite = getWalkSpriteState(ws);
      spriteState = walkSprite ?? "idle";
    } else if (agent.subagentClass !== null && agent.subagentClass !== undefined) {
      // Subagents walk near their desk — avoid other desks but not their own
      const pos = deskMap.get(agent.id);
      const homeX = pos ? pos.characterX : BUILDING_X + BUILDING_W / 2;
      const homeY = pos ? pos.characterY : FLOOR_Y + FLOOR_H / 2;
      if (!walkStates.has(agent.id)) {
        walkStates.set(agent.id, createWalkState(homeX, homeY));
      }
      const ws = walkStates.get(agent.id)!;
      const otherDesks = pos
        ? deskAvoidZones.filter((z) => z.x !== pos.x || z.y !== pos.y)
        : deskAvoidZones;
      updateWalkState(ws, false, homeX, homeY, 20, otherDesks);
      drawX = ws.currentX;
      drawY = ws.currentY;
      flipX = ws.facingRight;
      const walkSprite = getWalkSpriteState(ws);
      if (walkSprite) spriteState = walkSprite;
    } else {
      // Active desk-bound agents sit at their desk
      const pos = deskMap.get(agent.id);
      if (!pos) continue;
      // Beam-in for newly appearing agents
      if (!knownAgentIds.has(agent.id) && !beamingAgents.has(agent.id)) {
        knownAgentIds.add(agent.id);
        activeBeams.push({
          fromX: pos.characterX,
          fromY: pos.characterY - 30, // beam down from above
          toX: pos.characterX,
          toY: pos.characterY,
          frame: 0,
          agentId: agent.id,
        });
        beamingAgents.add(agent.id);
      }
      // Detect wander→desk transition: spawn teleport beam
      const ws = walkStates.get(agent.id);
      if (ws && !beamingAgents.has(agent.id)) {
        const dist = Math.sqrt(
          (ws.currentX - pos.characterX) ** 2 + (ws.currentY - pos.characterY) ** 2
        );
        if (dist > 4) {
          // Far enough to warrant a teleport instead of just snapping
          activeBeams.push({
            fromX: ws.currentX,
            fromY: ws.currentY,
            toX: pos.characterX,
            toY: pos.characterY,
            frame: 0,
            agentId: agent.id,
          });
          beamingAgents.add(agent.id);
        }
        // Clear smooth position so it doesn't lerp during beam
        smoothPos.delete(agent.id);
      }
      drawX = pos.characterX;
      drawY = pos.characterY;
      walkStates.delete(agent.id);
    }
    lastAgentState.set(agent.id, agent.state);

    // Smooth position — lerp toward target to prevent blinking on state changes
    // Skip lerp for beaming agents — they teleport, not slide
    if (beamingAgents.has(agent.id)) {
      smoothPos.delete(agent.id);
    }
    const sp = smoothPos.get(agent.id);
    if (sp) {
      const lerpSpeed = 0.15; // 15% per frame — smooth but responsive
      sp.x += (drawX - sp.x) * lerpSpeed;
      sp.y += (drawY - sp.y) * lerpSpeed;
      // Snap if very close to avoid sub-pixel wobble
      if (Math.abs(drawX - sp.x) < 0.3 && Math.abs(drawY - sp.y) < 0.3) {
        sp.x = drawX;
        sp.y = drawY;
      }
      drawX = sp.x;
      drawY = sp.y;
    } else {
      smoothPos.set(agent.id, { x: drawX, y: drawY });
    }

    // Idle bob — barely perceptible, brief 1px lift every ~3s, only when stationary
    const phase = hashForPhase(agent.id) % 200;
    const sinVal = Math.sin((frame + phase) * 0.035);
    const ws = walkStates.get(agent.id);
    const isWalking = ws?.isMoving;
    if (!isWalking && sinVal > 0.85) {
      drawY -= 1;
    }

    const isUnreachable = agent.source === "openclaw" && agent.lastActivity === 0;

    entities.push({
      x: drawX,
      y: drawY,
      spriteKey: charType,
      spriteState,
      agentId: agent.id,
      isUnreachable,
      parentId: agent.parentId,
      flipX,
      teamColor: agent.teamColor,
      isMainCC: agent.subagentClass === null && agent.source === "cc",
      activityState: agent.state,
      source: agent.source,
    });
  }

  // Cat
  if (!catWalkState) {
    catWalkState = createWalkState(CAT_HOME_X + 8, CAT_HOME_Y);
  }

  const isSpaceCat = theme.petType === "space-cat";

  // Float-away: auto-trigger only in lunar (space-cat), manual trigger works everywhere
  if (isSpaceCat && !floatingAway) {
    nextFloatCheck--;
    if (nextFloatCheck <= 0 && !catWalkState.isSleeping && catWalkState.startledFrames === 0) {
      floatingAway = true;
      floatY = catWalkState.currentY;
      floatStartX = catWalkState.currentX;
      floatFrame = 0;
      floatMaxHeight = catWalkState.currentY - (20 + Math.random() * 80);
      nextFloatCheck = 60 * 60 * (4 + Math.random() * 6);
    }
  }

  if (floatingAway) {
    floatFrame++;
    floatY -= 0.3; // drift upward
    // Return when reaching max height or off screen
    if (floatY < floatMaxHeight || floatY < -20) {
      floatingAway = false;
      catWalkState.currentY = CAT_HOME_Y;
      catWalkState.currentX = CAT_HOME_X + 8;
      catWalkState.idleFramesRemaining = 60;
      catWalkState.isMoving = false;
    } else {
      // Wiggling legs — fast frantic alternation
      const wiggleSprite = floatFrame % 4 < 2 ? "walk1" : "walk2";
      entities.push({
        x: floatStartX,
        y: floatY,
        spriteKey: theme.petType,
        spriteState: wiggleSprite,
        agentId: "__cat_float__",
        isUnreachable: false,
        parentId: null,
        flipX: catWalkState.facingRight,
        teamColor: 0,
        isMainCC: false,
        activityState: "idle",
        source: "cat",
      });
    }
  }

  if (!floatingAway) {
    if (catWalkState.startledFrames > 0) {
      catWalkState.startledFrames--;
    } else {
      updateWalkState(catWalkState, true, CAT_HOME_X, CAT_HOME_Y, 60, deskAvoidZones);
    }
    const catWalkSprite = getWalkSpriteState(catWalkState);
    let catSprite = catWalkState.startledFrames > 0 ? "startled" : (catWalkSprite ?? "idle");

    // Space cat now has its own sleep sprite — no fallback needed
    let catSpriteKey: string = theme.petType;

    // Small vertical jump during first half of startle
    const startledJump = catWalkState.startledFrames > 30 ? -2 : 0;
    entities.push({
      x: catWalkState.currentX,
      y: catWalkState.currentY + startledJump,
      spriteKey: catSpriteKey as any,
      spriteState: catSprite,
      agentId: "__cat__",
      isUnreachable: false,
      parentId: null,
      flipX: catWalkState.facingRight,
      teamColor: 0,
      isMainCC: false,
      activityState: "idle",
      source: "cat",
    });
  }

  // Sort all entities by Y for z-ordering
  entities.sort((a, b) => a.y - b.y);

  // 7. Draw teleport beams
  for (let bi = activeBeams.length - 1; bi >= 0; bi--) {
    const beam = activeBeams[bi];
    beam.frame++;
    if (beam.frame > BEAM_TOTAL) {
      activeBeams.splice(bi, 1);
      beamingAgents.delete(beam.agentId);
      continue;
    }

    const beamUpT = Math.min(beam.frame / BEAM_UP_DURATION, 1);
    const gapEnd = BEAM_UP_DURATION + 4;
    const beamDownT = beam.frame > gapEnd
      ? Math.min((beam.frame - gapEnd) / BEAM_DOWN_DURATION, 1)
      : -1;

    // Beam-up: particles rise from the source position
    if (beamUpT < 1) {
      const alpha = 1 - beamUpT;
      for (let p = 0; p < 6; p++) {
        const px = beam.fromX + (p % 3) - 1;
        const riseOffset = beamUpT * (8 + p * 2);
        const py = beam.fromY - p * 2 - riseOffset;
        ctx.globalAlpha = alpha * (0.4 + 0.3 * ((p + beam.frame) % 2));
        ctx.fillStyle = BEAM_COLORS[p % BEAM_COLORS.length];
        ctx.fillRect(Math.floor(px), Math.floor(py), 1, 1);
      }
      // Fading column at source
      ctx.globalAlpha = alpha * 0.2;
      ctx.fillStyle = "#aaccff";
      ctx.fillRect(beam.fromX - 2, beam.fromY - 10 - beamUpT * 4, 4, 10);
      ctx.globalAlpha = 1;
    }

    // Beam-down: particles descend to the destination
    if (beamDownT >= 0 && beamDownT < 1) {
      const alpha = beamDownT;
      for (let p = 0; p < 6; p++) {
        const px = beam.toX + (p % 3) - 1;
        const fallOffset = (1 - beamDownT) * (8 + p * 2);
        const py = beam.toY - p * 2 - fallOffset;
        ctx.globalAlpha = alpha * (0.4 + 0.3 * ((p + beam.frame) % 2));
        ctx.fillStyle = BEAM_COLORS[p % BEAM_COLORS.length];
        ctx.fillRect(Math.floor(px), Math.floor(py), 1, 1);
      }
      // Forming column at dest
      ctx.globalAlpha = alpha * 0.2;
      ctx.fillStyle = "#aaccff";
      ctx.fillRect(beam.toX - 2, beam.toY - 10 - (1 - beamDownT) * 4, 4, 10);
      ctx.globalAlpha = 1;
    }
  }

  // 8. Draw all entities
  for (const entity of entities) {
    // Hide sprite during teleport beam
    if (beamingAgents.has(entity.agentId)) {
      // Show at destination during beam-down phase
      const beam = activeBeams.find((b) => b.agentId === entity.agentId);
      if (beam) {
        const gapEnd = BEAM_UP_DURATION + 4;
        const beamDownT = beam.frame > gapEnd
          ? (beam.frame - gapEnd) / BEAM_DOWN_DURATION
          : -1;
        if (beamDownT < 0.5) continue; // still invisible
        // Fade in during second half of beam-down
        ctx.globalAlpha = Math.min(1, (beamDownT - 0.5) * 2);
      } else {
        continue;
      }
    }

    const sprite = getSprite(
      spriteCache,
      entity.spriteKey,
      entity.spriteState as any
    ) ?? getSprite(spriteCache, entity.spriteKey, "idle");
    if (!sprite) continue;

    if (entity.isUnreachable) {
      ctx.globalAlpha = 0.3;
      ctx.filter = "grayscale(1)";
    }

    if (entity.flipX) {
      ctx.save();
      ctx.translate(entity.x, entity.y - sprite.height / 2);
      ctx.scale(-1, 1);
      ctx.drawImage(sprite.canvas, -sprite.width / 2, 0);
      ctx.restore();
    } else {
      ctx.drawImage(
        sprite.canvas,
        entity.x - sprite.width / 2,
        entity.y - sprite.height / 2
      );
    }

    if (entity.isUnreachable) {
      ctx.globalAlpha = 1;
      ctx.filter = "none";
      ctx.fillStyle = "#666";
      ctx.font = "4px monospace";
      ctx.fillText("zzz", entity.x - 4, entity.y - sprite.height / 2 - 3);
    }
    // Reset alpha after beam fade-in draw
    if (beamingAgents.has(entity.agentId)) {
      ctx.globalAlpha = 1;
    }

    // Floating cat worried "!!"
    if (entity.agentId === "__cat_float__") {
      const wobble = Math.sin(frame * 0.5) * 0.8;
      ctx.fillStyle = "#ffaa44";
      ctx.font = "bold 4px monospace";
      ctx.fillText("!!", entity.x + 3, entity.y - sprite.height / 2 - 2 + wobble);
    }

    // Startled cat "!"
    if (entity.agentId === "__cat__" && entity.spriteState === "startled") {
      const bounce = Math.sin(frame * 0.4) * 0.5;
      ctx.fillStyle = "#ff4444";
      ctx.font = "bold 4px monospace";
      ctx.fillText("!", entity.x + 5, entity.y - sprite.height / 2 - 2 + bounce);
    }

    // Sleeping cat "zzz"
    if (entity.agentId === "__cat__" && entity.spriteState === "sleep") {
      const zPhase = Math.floor(frame / 30) % 3;
      ctx.fillStyle = "#8888aa";
      ctx.font = "3px monospace";
      const zx = entity.x + 5;
      const zy = entity.y - sprite.height / 2 - 2;
      ctx.globalAlpha = 0.6;
      ctx.fillText("z", zx, zy);
      if (zPhase >= 1) ctx.fillText("z", zx + 3, zy - 3);
      if (zPhase >= 2) ctx.fillText("z", zx + 6, zy - 5);
      ctx.globalAlpha = 1;
    }

    // Status bubble for openclaw
    if (entity.source === "openclaw" && !entity.isUnreachable) {
      const bubbleY = entity.y - sprite.height / 2 - 3;
      if (entity.activityState === "thinking") {
        // Thought bubble: three ascending dots + ellipsis cloud
        const dotX = entity.x + 5;
        ctx.fillStyle = "#cccccc";
        ctx.fillRect(dotX, bubbleY + 1, 1, 1);
        ctx.fillRect(dotX + 2, bubbleY - 1, 2, 2);
        // Cloud
        const cx = dotX + 6;
        const cy = bubbleY - 5;
        ctx.fillStyle = "#eeeeff";
        ctx.fillRect(cx - 7, cy - 1, 14, 5);
        ctx.fillRect(cx - 6, cy - 2, 12, 7);
        // Animated dots inside cloud (centered)
        ctx.fillStyle = "#9966cc";
        const dotPhase = Math.floor(frame / 12) % 3;
        for (let d = 0; d < 3; d++) {
          if (d <= dotPhase) {
            ctx.fillRect(cx - 5 + d * 4, cy + 1, 2, 2);
          }
        }
      } else if (entity.activityState === "typing") {
        // Speech bubble with text lines
        const cx = entity.x + 6;
        const cy = bubbleY - 6;
        // Bubble body
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(cx - 8, cy - 2, 16, 7);
        ctx.fillRect(cx - 7, cy - 3, 14, 9);
        // Tail
        ctx.fillRect(cx - 5, cy + 5, 2, 1);
        ctx.fillRect(cx - 4, cy + 6, 1, 1);
        // Animated text lines
        ctx.fillStyle = "#ddaa33";
        const lineW = 4 + Math.floor(((Math.sin(frame * 0.15) + 1) / 2) * 4);
        ctx.fillRect(cx - 4, cy - 1, lineW, 1);
        ctx.fillRect(cx - 4, cy + 1, Math.max(2, lineW - 2), 1);
      }
    }

    // Sub-agent connection line
    if (entity.parentId) {
      const parentEntity = entities.find((e) => e.agentId === entity.parentId);
      if (parentEntity) {
        const tc = TEAM_COLORS[entity.teamColor] ?? "#c4856c";
        ctx.strokeStyle = tc + "44";
        ctx.setLineDash([2, 2]);
        ctx.lineWidth = 0.5;
        ctx.beginPath();
        ctx.moveTo(entity.x, entity.y);
        ctx.lineTo(parentEntity.x, parentEntity.y);
        ctx.stroke();
        ctx.setLineDash([]);
      }
    }
  }

  // Draw and advance poof particles
  for (let i = activePoofs.length - 1; i >= 0; i--) {
    const p = activePoofs[i];
    p.frame++;
    if (p.frame > POOF_DURATION) {
      activePoofs.splice(i, 1);
      continue;
    }
    const t = p.frame / POOF_DURATION;
    const alpha = Math.max(0, 1 - t * 1.2);

    // Big center flash at start
    if (p.frame < 10) {
      const flashAlpha = 1 - p.frame / 10;
      ctx.globalAlpha = flashAlpha;
      ctx.fillStyle = "#fff";
      const flashSize = Math.max(1, 10 - p.frame);
      ctx.fillRect(
        Math.floor(p.x - flashSize / 2),
        Math.floor(p.y - flashSize / 2),
        flashSize,
        flashSize
      );
      // Yellow glow behind
      ctx.fillStyle = "#ffee44";
      const glowSize = flashSize + 4;
      ctx.globalAlpha = flashAlpha * 0.5;
      ctx.fillRect(
        Math.floor(p.x - glowSize / 2),
        Math.floor(p.y - glowSize / 2),
        glowSize,
        glowSize
      );
    }

    // 10 sparkle particles expanding outward
    ctx.globalAlpha = alpha;
    for (let s = 0; s < 10; s++) {
      const angle = (s / 10) * Math.PI * 2 + s * 0.7;
      const speed = 0.6 + (s % 3) * 0.3;
      const spread = p.frame * speed;
      const sx = p.x + Math.cos(angle) * spread;
      const sy = p.y + Math.sin(angle) * spread - t * 6;
      ctx.fillStyle = POOF_COLORS[s % POOF_COLORS.length];
      const size = Math.max(1, 3 - Math.floor(t * 3));
      ctx.fillRect(Math.floor(sx), Math.floor(sy), size, size);
    }

    ctx.globalAlpha = 1;
  }

  // Clean up walk states and poof tracking for agents that no longer exist
  const activeIds = new Set(agents.map((a) => a.id));
  for (const id of walkStates.keys()) {
    if (!activeIds.has(id)) walkStates.delete(id);
  }
  for (const id of poofedIds) {
    if (!activeIds.has(id)) poofedIds.delete(id);
  }
  for (const id of smoothPos.keys()) {
    if (!activeIds.has(id)) smoothPos.delete(id);
  }
  for (const id of lastAgentState.keys()) {
    if (!activeIds.has(id)) lastAgentState.delete(id);
  }
  for (const id of knownAgentIds) {
    if (!activeIds.has(id)) knownAgentIds.delete(id);
  }
}
