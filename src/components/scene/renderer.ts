import { TEAM_COLORS, type AgentState } from "@/shared/types";
import type { CharacterType } from "../characters/sprite-cache";
import { getSprite, type buildSpriteCache } from "../characters/sprite-cache";
import { assignDesks, DESK_POSITIONS } from "./desk-layout";
import { drawEnvironment, drawDeskFronts, getPalletTownBg } from "./environment";
import { CANVAS_WIDTH, CANVAS_HEIGHT } from "../canvas-transform";
import {
  createWalkState,
  updateWalkState,
  getWalkSpriteState,
  type WalkState,
  type AvoidZone,
} from "./walking";
import { useAgentOfficeStore, type MonitorStatus, type ClawHealth, type EditMode } from "../store";
import { loadDecoPixels } from "../overlay/pixel-editor";

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
let nextFloatCheck = 30 * 60 * (4 + Math.random() * 6); // 4-10 min at 30fps

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
// Remember last desk position so lounging agents can wander from where they sat
const lastDeskPos = new Map<string, { x: number; y: number }>();
// Track known agents to detect first appearance (beam-in)
const knownAgentIds = new Set<string>();
// Sticky quadrant assignment — each CC keeps its slot for the session
const stickyQuadrants = new Map<string, number>();

// Trainer blink state — random blinking for openclaw "trainer" characters
const blinkTimers = new Map<string, number>(); // frames until next blink
const blinkActive = new Map<string, number>(); // frames remaining in blink
export function getAgentSlot(agentId: string): number | undefined {
  return stickyQuadrants.get(agentId);
}
export function getSlotMap(): Map<string, number> {
  return stickyQuadrants;
}
// Sticky starter assignment — round-robin charmander/squirtle/bulbasaur, no dupes until all 3 used
const STARTERS: CharacterType[] = ["charmander", "squirtle", "bulbasaur", "mew"];
const stickyStarters = new Map<string, CharacterType>();
function assignStarter(agentId: string, agents: AgentState[]): CharacterType {
  // Return existing assignment if still active
  if (stickyStarters.has(agentId)) return stickyStarters.get(agentId)!;
  // Clean up departed agents (preserve manual overrides)
  const activeIds = new Set(agents.map(a => a.id));
  for (const id of stickyStarters.keys()) {
    if (!activeIds.has(id)) {
      stickyStarters.delete(id);
      manualOverrides.delete(id);
    }
  }
  // Find which starters are already in use (only count auto-assigned, not manual overrides)
  const used = new Set<CharacterType>();
  for (const [id, char] of stickyStarters) {
    if (!manualOverrides.has(id)) used.add(char);
  }
  // Pick the first unused starter, or fall back to round-robin if all 4 are taken
  let pick = STARTERS.find(s => !used.has(s));
  if (!pick) pick = STARTERS[stickyStarters.size % STARTERS.length];
  stickyStarters.set(agentId, pick);
  return pick;
}

const manualOverrides = new Set<string>();
export function setAgentCharacter(agentId: string, character: CharacterType) {
  stickyStarters.set(agentId, character);
  manualOverrides.add(agentId);
}
export function getAgentCharacter(agentId: string): CharacterType | undefined {
  return stickyStarters.get(agentId);
}
export { STARTERS };

// Monolith materialize transition
let monolithVisible = false;
let monolithTransition = 0; // 0 = gone, 1 = fully materialized
let monolithDelayFrames = 20; // wait before starting materialize on page load
const MONOLITH_MATERIALIZE_FRAMES = 40;

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

// Level-up celebration state
interface LevelUpEffect {
  x: number;
  y: number;
  frame: number;
  teamColor: string;
  particles: Array<{ angle: number; speed: number; color: string }>;
}
const activeLevelUps: LevelUpEffect[] = [];
let screenFlashAlpha = 0;
const previousLevels = new Map<string, number>();

const pokeballFlashes = new Map<string, number>(); // agentId → remaining frames

// Game mode: expose agent level and frame to environment.ts for golden pokeball
const agentLevelAtDesk = new Map<number, number>(); // deskIndex → level
let currentFrame = 0; // updated each renderScene call

export function getAgentLevelAtDesk(deskIndex: number): number {
  return agentLevelAtDesk.get(deskIndex) ?? 0;
}
export function getCurrentFrame(): number {
  return currentFrame;
}

export function triggerLevelUp(x: number, y: number, teamColor: string) {
  screenFlashAlpha = 0.15;
  const particles: LevelUpEffect["particles"] = [];
  const colors = [teamColor, "#ffcc44", "#ffffff"];
  for (let i = 0; i < 15; i++) {
    particles.push({
      angle: (i / 15) * Math.PI * 2 + Math.random() * 0.3,
      speed: 0.8 + Math.random() * 0.6,
      color: colors[i % 3],
    });
  }
  activeLevelUps.push({ x, y, frame: 0, teamColor, particles });
}

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

function drawWoodSign(
  ctx: CanvasRenderingContext2D,
  mx: number, my: number, totalW: number, totalH: number,
  mount: { color: string; colorLight: string; colorDark: string }
) {
  const r = parseInt(mount.color.slice(1, 3), 16);
  const g = parseInt(mount.color.slice(3, 5), 16);
  const b = parseInt(mount.color.slice(5, 7), 16);
  const woodShades = [
    mount.color,
    mount.colorLight,
    `rgb(${Math.max(0,r-18)},${Math.max(0,g-14)},${Math.max(0,b-10)})`,
    `rgb(${Math.min(255,r+10)},${Math.min(255,g+8)},${Math.min(255,b+3)})`,
    `rgb(${Math.max(0,r-8)},${Math.max(0,g-6)},${Math.max(0,b-8)})`,
    `rgb(${Math.min(255,r+5)},${Math.min(255,g+12)},${Math.min(255,b+6)})`,
    `rgb(${Math.max(0,r-24)},${Math.max(0,g-18)},${Math.max(0,b-14)})`,
    mount.colorDark,
  ];

  // Scrambled hash for less patterned look
  function woodHash(x: number, y: number): number {
    let h = x * 2654435761 ^ y * 2246822519;
    h = ((h >> 16) ^ h) * 0x45d9f3b;
    return Math.abs(h);
  }

  // Posts with speckle
  for (const postX of [mx + 1, mx + totalW - 3]) {
    for (let py = my - 2; py < my + totalH + 4; py++) {
      const h0 = woodHash(postX, py);
      ctx.fillStyle = woodShades[h0 % 6]; // lighter shades only
      ctx.fillRect(postX, py, 1, 1);
      ctx.fillStyle = woodShades[(h0 >> 4) % 4 + 2]; // darker face
      ctx.fillRect(postX + 1, py, 1, 1);
    }
  }

  // Sign board — speckled fill with horizontal slat banding
  const slatHeight = Math.max(2, Math.floor(totalH / 3));
  for (let py = 0; py < totalH; py++) {
    const slatEdge = py % slatHeight === 0 && py > 0;
    for (let px = 0; px < totalW; px++) {
      const h = woodHash(mx + px, my + py);
      if (slatEdge) {
        // Dark slat seam
        ctx.fillStyle = mount.colorDark;
      } else {
        // Per-pixel variation — bias toward mid tones
        ctx.fillStyle = woodShades[h % woodShades.length];
      }
      ctx.fillRect(mx + px, my + py, 1, 1);
    }
  }

  // Dark border on all edges
  ctx.fillStyle = mount.colorDark;
  ctx.fillRect(mx, my, totalW, 1);
  ctx.fillRect(mx, my + totalH - 1, totalW, 1);
  ctx.fillRect(mx, my, 1, totalH);
  ctx.fillRect(mx + totalW - 1, my, 1, totalH);

  // Subtle inner highlight on top-left
  ctx.fillStyle = mount.colorLight;
  ctx.fillRect(mx + 1, my + 1, totalW - 2, 1);
  ctx.fillRect(mx + 1, my + 1, 1, totalH - 2);

  // Rope lashings
  ctx.fillStyle = mount.colorDark;
  ctx.fillRect(mx + 1, my - 1, 2, 2);
  ctx.fillRect(mx + totalW - 3, my - 1, 2, 2);
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
    drawWoodSign(ctx, mx, my, totalW, totalH, mount);
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
    drawWoodSign(ctx, mx, my, totalW, totalH, mount);
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

const MONOLITH_COLS = 5;
const MONOLITH_ROWS = 5;
const MONOLITH_DOT = 2;    // each pixel dot is 2x2 canvas pixels
const MONOLITH_GAP = 1;    // 1px gap between dots
const MONOLITH_PAD = 2;    // padding inside the slab
const MONOLITH_PANEL_GAP = 3; // gap between panels

function monolithGeometry() {
  const dotStep = MONOLITH_DOT + MONOLITH_GAP;
  const panelW = MONOLITH_COLS * dotStep - MONOLITH_GAP;
  const panelH = MONOLITH_ROWS * dotStep - MONOLITH_GAP;
  const slabW = panelW + MONOLITH_PAD * 2;
  const slabH = 3 * panelH + 2 * MONOLITH_PANEL_GAP + MONOLITH_PAD * 2;
  const cx = Math.floor(BUILDING_X + BUILDING_W / 2) - 3;
  const ox = cx - Math.floor(slabW / 2);
  const oy = BUILDING_Y - slabH + 29;
  return { dotStep, panelW, panelH, slabW, slabH, cx, ox, oy };
}

/** Draw monolith surrounds (stones, ruins, ferns) — called before time-of-day tint */
export function drawMonolithSurrounds(ctx: CanvasRenderingContext2D, theme: SceneTheme) {
  const { towerSize, towerVisible } = useAgentOfficeStore.getState();
  if (!towerVisible || towerSize !== "monolith") return;
  const surroundAlpha = Math.max(0, (monolithTransition - 0.4) / 0.6);
  if (surroundAlpha <= 0) return;

  ctx.globalAlpha = surroundAlpha;
  const { slabW, slabH, cx, ox, oy } = monolithGeometry();

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

  // Golden Ruins: crumbling Egyptian temple blocks around the monolith
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

    // Stepped platform / altar base beneath monolith
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

    // Hanging vine tendrils down the monolith sides
    ctx.fillStyle = fern1;
    ctx.fillRect(ox - 1, baseY - 6, 1, 6);
    ctx.fillRect(ox - 2, baseY - 3, 1, 3);
    ctx.fillRect(ox + slabW, baseY - 5, 1, 5);
    ctx.fillRect(ox + slabW + 1, baseY - 3, 1, 3);
    ctx.fillStyle = fern2;
    ctx.fillRect(ox - 1, baseY - 8, 1, 3);
    ctx.fillRect(ox + slabW, baseY - 7, 1, 3);
  }

  // Pallet Town: bush + hedge decoration around monolith base
  if (theme.id === "pallet-town") {
    const baseY = oy + slabH;
    const baseCX = cx;

    // Bush palette — matched to pallet-town scene bushes
    const bushColors = ["#264a30", "#325a3a", "#2e4d35", "#3e6a45", "#2a3e2e", "#486b44"];
    const bushHighlight = "#5a8a50";
    const bushShadow = "#1a3024";

    const grassPatches = [
      { dx: -16, dy: 2, w: 6, h: 4 },
      { dx: -20, dy: 4, w: 5, h: 3 },
      { dx: -12, dy: 5, w: 4, h: 3 },
      // Right side (trimmed to avoid house overlap)
      { dx: 10, dy: 2, w: 5, h: 4 },
      { dx: 8, dy: 5, w: 4, h: 3 },
      // Front
      { dx: -6, dy: 7, w: 4, h: 3 },
      { dx: 4, dy: 8, w: 5, h: 3 },
    ];
    for (let gi = 0; gi < grassPatches.length; gi++) {
      const g = grassPatches[gi];
      const gx = baseCX + g.dx;
      const gy = baseY + g.dy;
      ctx.fillStyle = bushShadow;
      ctx.fillRect(gx, gy, g.w, g.h);
      for (let py = 0; py < g.h; py++) {
        for (let px = 0; px < g.w; px++) {
          const hash = (gx + px) * 7 + (gy + py) * 13 + gi * 3;
          ctx.fillStyle = bushColors[hash % bushColors.length];
          ctx.fillRect(gx + px, gy + py, 1, 1);
        }
      }
      for (let t = 0; t < g.w; t++) {
        const hash = (gx + t) * 11 + gi * 5;
        if (hash % 3 === 0) {
          ctx.fillStyle = bushHighlight;
          ctx.fillRect(gx + t, gy, 1, 1);
        }
        if (hash % 4 === 0) {
          ctx.fillStyle = bushColors[(hash + 2) % bushColors.length];
          ctx.fillRect(gx + t, gy - 1, 1, 1);
        }
      }
      for (let t = 0; t < g.w; t++) {
        if ((gx + t + gi) % 3 === 0) {
          ctx.fillStyle = bushShadow;
          ctx.fillRect(gx + t, gy + g.h - 1, 1, 1);
        }
      }
    }

    // Grey corner accents on monolith base
    ctx.fillStyle = "#5a5a5e";
    ctx.fillRect(baseCX - 10, baseY - 2, 1, 2);
    ctx.fillRect(baseCX + 9, baseY - 2, 1, 2);

    // Hedge around monolith base
    ctx.fillStyle = "#2c625d";
    // Row +3: 147-166
    ctx.fillRect(baseCX - 10, baseY + 3, 20, 1);
    // Row +4: 147-166
    ctx.fillRect(baseCX - 10, baseY + 4, 20, 1);
    // Row +5: 149-165
    ctx.fillRect(baseCX - 8, baseY + 5, 17, 1);
    // Row +6: 149-154 + 151-165 (filled: 149-165)
    ctx.fillRect(baseCX - 8, baseY + 6, 18, 1);
    // Row +7: 149-150 + 155-164
    ctx.fillRect(baseCX - 8, baseY + 7, 2, 1);
    ctx.fillRect(baseCX - 2, baseY + 7, 10, 1);
    // Row +8: 148-150 + 155-160
    ctx.fillRect(baseCX - 9, baseY + 8, 3, 1);
    ctx.fillRect(baseCX - 2, baseY + 8, 6, 1);
    // Row +9: 148-160
    ctx.fillRect(baseCX - 9, baseY + 9, 13, 1);
  }

  // Lunar base: scattered lunar rocks + crater ring around monolith base
  if (theme.id === "lunar-base") {
    const baseY = oy + slabH;
    const baseCX = cx;
    const rockDark = "#383840";
    const rockMid = "#484850";
    const rockLight = "#585860";
    const rockHighlight = "#686870";

    ctx.fillStyle = "#303038";
    ctx.fillRect(baseCX - 16, baseY + 2, 32, 3);
    ctx.fillRect(baseCX - 14, baseY + 5, 28, 2);
    ctx.fillStyle = "#3a3a42";
    ctx.fillRect(baseCX - 14, baseY + 3, 28, 2);
    ctx.fillStyle = rockLight;
    ctx.fillRect(baseCX - 16, baseY + 1, 32, 1);

    const rocks = [
      { dx: -20, dy: -2, w: 5, h: 4 },
      { dx: -24, dy: 3, w: 4, h: 3 },
      { dx: -18, dy: 6, w: 3, h: 2 },
      { dx: -26, dy: 0, w: 3, h: 2 },
      { dx: 16, dy: -2, w: 5, h: 4 },
      { dx: 22, dy: 3, w: 4, h: 3 },
      { dx: 14, dy: 6, w: 3, h: 2 },
      { dx: 24, dy: 1, w: 3, h: 2 },
      { dx: -8, dy: 8, w: 3, h: 2 },
      { dx: 5, dy: 9, w: 4, h: 2 },
      { dx: -3, dy: 10, w: 2, h: 2 },
    ];
    for (let ri = 0; ri < rocks.length; ri++) {
      const r = rocks[ri];
      const rx = baseCX + r.dx;
      const ry = baseY + r.dy;
      ctx.fillStyle = rockDark;
      ctx.fillRect(rx, ry, r.w, r.h);
      ctx.fillStyle = ri < 8 ? rockMid : rockDark;
      ctx.fillRect(rx, ry, r.w, r.h - 1);
      ctx.fillStyle = rockHighlight;
      ctx.fillRect(rx, ry, r.w, 1);
    }

    ctx.fillStyle = "#303038";
    ctx.fillRect(baseCX - 22, baseY + 7, 3, 2);
    ctx.fillRect(baseCX + 20, baseY + 8, 2, 2);
    ctx.fillStyle = "#282830";
    ctx.fillRect(baseCX - 21, baseY + 7, 1, 1);
    ctx.fillRect(baseCX + 21, baseY + 8, 1, 1);
  }

  // Pokemoon: scattered lunar rocks + crater ring around monolith base
  if (theme.id === "pokemoon") {
    const baseY = oy + slabH;
    const baseCX = cx;
    const rockDark = "#383840";
    const rockMid = "#484850";
    const rockLight = "#585860";
    const rockHighlight = "#686870";

    // Crater ring — shallow depression around base
    ctx.fillStyle = "#303038";
    ctx.fillRect(baseCX - 16, baseY + 2, 32, 3);
    ctx.fillRect(baseCX - 14, baseY + 5, 28, 2);
    ctx.fillStyle = "#3a3a42";
    ctx.fillRect(baseCX - 14, baseY + 3, 28, 2);
    // Rim highlights
    ctx.fillStyle = rockLight;
    ctx.fillRect(baseCX - 16, baseY + 1, 32, 1);

    // Scattered rocks — left side
    const rocks = [
      { dx: -20, dy: -2, w: 5, h: 4 },
      { dx: -24, dy: 3, w: 4, h: 3 },
      { dx: -18, dy: 6, w: 3, h: 2 },
      { dx: -26, dy: 0, w: 3, h: 2 },
      // Right side
      { dx: 16, dy: -2, w: 5, h: 4 },
      { dx: 22, dy: 3, w: 4, h: 3 },
      { dx: 14, dy: 6, w: 3, h: 2 },
      { dx: 24, dy: 1, w: 3, h: 2 },
      // Front scattered
      { dx: -8, dy: 8, w: 3, h: 2 },
      { dx: 5, dy: 9, w: 4, h: 2 },
      { dx: -3, dy: 10, w: 2, h: 2 },
    ];
    for (let ri = 0; ri < rocks.length; ri++) {
      const r = rocks[ri];
      const rx = baseCX + r.dx;
      const ry = baseY + r.dy;
      ctx.fillStyle = rockDark;
      ctx.fillRect(rx, ry, r.w, r.h);
      ctx.fillStyle = ri < 8 ? rockMid : rockDark;
      ctx.fillRect(rx, ry, r.w, r.h - 1);
      ctx.fillStyle = rockHighlight;
      ctx.fillRect(rx, ry, r.w, 1);
    }

    // Small craters near base
    ctx.fillStyle = "#303038";
    ctx.fillRect(baseCX - 22, baseY + 7, 3, 2);
    ctx.fillRect(baseCX + 20, baseY + 8, 2, 2);
    ctx.fillStyle = "#282830";
    ctx.fillRect(baseCX - 21, baseY + 7, 1, 1);
    ctx.fillRect(baseCX + 21, baseY + 8, 1, 1);
  }

  ctx.globalAlpha = 1;
}

function drawMonolith(ctx: CanvasRenderingContext2D, theme: SceneTheme, frame: number, timeOverride?: TimeOfDay, materialize = 1) {
  const { data, connected } = getPixelTowerData();
  if (!connected) return;

  const { dotStep, panelW, panelH, slabW, slabH, cx, ox, oy } = monolithGeometry();

  // Stone base (slightly wider)
  ctx.fillStyle = "#222228";
  ctx.fillRect(ox - 1, oy + slabH, slabW + 2, 3);
  ctx.fillStyle = "#2a2a30";
  ctx.fillRect(ox - 1, oy + slabH, slabW + 2, 1);

  // Materialize transition — clip and shimmer
  const isMaterializing = materialize < 1;
  if (isMaterializing) {
    ctx.save();
    // Reveal from bottom to top
    const revealH = Math.floor(slabH * materialize);
    const clipY = oy + slabH - revealH;
    ctx.beginPath();
    ctx.rect(ox - 2, clipY, slabW + 4, revealH + 4);
    ctx.clip();
    // Overall fade
    ctx.globalAlpha = Math.min(1, materialize * 1.5);
  }

  // Black obsidian slab
  ctx.fillStyle = "#0a0a10";
  ctx.fillRect(ox, oy, slabW, slabH);
  // Subtle edge highlights
  ctx.fillStyle = "#0e0e14";
  ctx.fillRect(ox, oy, slabW, 1);
  ctx.fillStyle = "#111118";
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
    const panelY = oy + MONOLITH_PAD + p * (panelH + MONOLITH_PANEL_GAP);
    const panelX = ox + MONOLITH_PAD;

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
          const col = i % MONOLITH_COLS;
          const row = (MONOLITH_ROWS - 1) - Math.floor(i / MONOLITH_COLS);
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
            ctx.fillRect(dx - 1, dy - 1, MONOLITH_DOT + 2, MONOLITH_DOT + 2);
            // Brighter core
            ctx.globalAlpha = 0.6;
            ctx.fillStyle = bright;
            ctx.fillRect(dx, dy, MONOLITH_DOT, MONOLITH_DOT);
          }
        }
      }
      ctx.globalAlpha = 1;

      if (litCount > 0) {
        // Static white diffusion panel with inset depth edge
        ctx.fillStyle = "#ffffff";
        // Outer edge — softer
        ctx.globalAlpha = 0.04;
        ctx.fillRect(panelX - 1, panelY - 1, panelW + 2, panelH + 2);
        // Inner fill — brighter
        ctx.globalAlpha = 0.08;
        ctx.fillRect(panelX, panelY, panelW, panelH);
        ctx.globalAlpha = 1;
      }

    } else {
      // Middle and bottom panels: individual dots
      for (let i = 0; i < pixels.length; i++) {
        const col = i % MONOLITH_COLS;
        const row = (MONOLITH_ROWS - 1) - Math.floor(i / MONOLITH_COLS);
        const color = pixels[i];
        const isLit = color !== "#000000";

        const dx = panelX + col * dotStep;
        const dy = panelY + row * dotStep;

        if (isLit) {
          ctx.globalAlpha = 0.2;
          ctx.fillStyle = color;
          ctx.fillRect(dx - 1, dy - 1, MONOLITH_DOT + 2, MONOLITH_DOT + 2);
          ctx.globalAlpha = 1;
          ctx.fillStyle = color;
          ctx.fillRect(dx, dy, MONOLITH_DOT, MONOLITH_DOT);
        }
      }
    }
  }

  // Particle effects during materialize/dematerialize
  if (isMaterializing) {
    const revealH = Math.floor(slabH * materialize);
    const edgeY = oy + slabH - revealH;
    const fx = theme.monolithEffect;
    const intensity = 1 - materialize; // stronger when less materialized

    // Glowing edge line
    ctx.globalAlpha = 0.7 * intensity;
    ctx.fillStyle = fx.color;
    ctx.fillRect(ox - 1, edgeY - 1, slabW + 2, 2);
    ctx.globalAlpha = 0.3 * intensity;
    ctx.fillRect(ox - 2, edgeY - 2, slabW + 4, 1);

    // Rising particles along both sides of the monolith
    for (let i = 0; i < 14; i++) {
      const seed = (i * 7919 + 31) | 0;
      const side = i % 2 === 0 ? ox - 2 - (seed % 4) : ox + slabW + 1 + (seed % 4);
      const rise = ((frame * 1.5 + i * 11) % (slabH + 10)) | 0;
      const py = oy + slabH - rise;
      if (py < oy - 5 || py > oy + slabH + 3) continue;
      const fadeEdge = Math.min(1, rise / 10, (slabH + 10 - rise) / 10);
      ctx.globalAlpha = 0.4 * intensity * fadeEdge;
      ctx.fillStyle = fx.color;
      ctx.fillRect(side, py, 1, 1);
    }

    // Floating particles around the edge zone
    for (let i = 0; i < 20; i++) {
      const seed = ((i * 3571 + frame * 17) | 0);
      const px = ox - 3 + (Math.abs(seed * 37) % (slabW + 6));
      const spread = 8 + Math.floor(intensity * 12);
      const py = edgeY - spread + (Math.abs(seed * 53) % (spread * 2));
      const flicker = ((frame + i * 3) % 4 < 3) ? 1 : 0;
      ctx.globalAlpha = 0.25 * intensity * flicker * (0.5 + (i % 3) * 0.25);
      ctx.fillStyle = i % 3 === 0 ? "#ffffff" : fx.color;
      ctx.fillRect(px, py, 1, 1);
    }

    // Scanline static across the revealed portion
    for (let row = 0; row < revealH; row += 2) {
      const scanAlpha = Math.sin((row + frame * 2) * 0.3) * 0.5 + 0.5;
      if (scanAlpha < 0.3) continue;
      ctx.globalAlpha = 0.04 * intensity * scanAlpha;
      ctx.fillStyle = fx.color;
      ctx.fillRect(ox, edgeY + row, slabW, 1);
    }

    ctx.globalAlpha = 1;
    ctx.restore();
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
  // Ensure pixel-perfect rendering every frame
  ctx.imageSmoothingEnabled = false;
  currentFrame = frame;

  // Pallet Town: don't render anything until the background PNG is loaded
  if (theme.id === "pallet-town" && !getPalletTownBg()) return;

  // 0. Per-theme vertical offset for agents and desks
  const oY = theme.floorOffsetY ?? 0;

  // 1. Desk avoid zones — shared by all walkers
  const deskAvoidZones: AvoidZone[] = DESK_POSITIONS.map((d) => ({
    x: d.x,
    y: d.y + oY,
    hw: 14,
    hh: 10,
  }));

  // 2. Assign desks only to main agents (not subagents, lounging, or departing)
  const deskEligible = agents.filter((a) =>
    a.state !== "lounging" && a.state !== "departing" &&
    (a.subagentClass === null || a.subagentClass === undefined)
  );
  const rawDeskMap = assignDesks(deskEligible.map((a) => a.id), stickyQuadrants);
  const deskMap = new Map<string, { x: number; y: number; characterX: number; characterY: number }>();
  for (const [id, pos] of rawDeskMap) {
    deskMap.set(id, { x: pos.x, y: pos.y + oY, characterX: pos.characterX, characterY: pos.characterY + oY });
  }

  // 3. Determine which desk indices have laptops
  const occupiedDeskIndices = new Set<number>();
  for (const agent of deskEligible) {
    const rawPos = rawDeskMap.get(agent.id);
    if (!rawPos) continue;
    const idx = DESK_POSITIONS.indexOf(rawPos);
    if (idx >= 0) occupiedDeskIndices.add(idx);
  }

  // 3a. Populate agent levels at desks for golden pokeball
  if (useAgentOfficeStore.getState().gameModeOn) {
    agentLevelAtDesk.clear();
    for (const agent of deskEligible) {
      const rawPos = rawDeskMap.get(agent.id);
      if (!rawPos) continue;
      const idx = DESK_POSITIONS.indexOf(rawPos);
      if (idx >= 0 && agent.level !== undefined) {
        agentLevelAtDesk.set(idx, agent.level);
      }
    }
  }

  // 3b. Build avoid zones for seated agents (walkers should steer around them)
  const seatedAgentZones: AvoidZone[] = [];
  for (const agent of deskEligible) {
    const pos = deskMap.get(agent.id);
    if (!pos) continue;
    seatedAgentZones.push({ x: pos.characterX, y: pos.characterY, hw: 5, hh: 5 });
  }
  const allAvoidZones = [...deskAvoidZones, ...seatedAgentZones];

  // 4. Draw environment
  const { editMode } = useAgentOfficeStore.getState();
  const deskCenters = DESK_POSITIONS.map((d) => ({ x: d.x, y: d.y + oY }));
  drawEnvironment(ctx, deskCenters, occupiedDeskIndices, frame, timeOverride, theme, () => {
    // Draw background decoration pixels (behind agents, before tint)
    const bgPixels = loadDecoPixels(theme.id, "background");
    for (const p of bgPixels) {
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x, p.y, 1, 1);
    }
    // Pallet Town hardcoded BG decorations
    if (theme.id === "pallet-town") {
      // Dark vertical lines (fence posts / shadows)
      ctx.fillStyle = "#182f38";
      ctx.fillRect(245, 28, 1, 25);   // x=245 y=28-52
      ctx.fillRect(190, 51, 1, 10);   // x=190 y=51-60
      ctx.fillRect(201, 58, 1, 5);    // x=201 y=58-62
      // Dark horizontal accents
      ctx.fillRect(173, 61, 2, 1);
      ctx.fillRect(203, 61, 2, 1);
      ctx.fillRect(216, 61, 2, 1);
      ctx.fillRect(243, 61, 2, 1);

      // Left vertical edge line
      ctx.fillStyle = "#3d8f82";
      ctx.fillRect(170, 39, 1, 17);   // x=170 y=39-55

      // Right vertical edge lines (house border)
      ctx.fillStyle = "#3f8f81";
      ctx.fillRect(247, 44, 1, 17);   // x=247 y=44-60
      ctx.fillRect(247, 62, 1, 4);    // x=247 y=62-65
      ctx.fillRect(246, 41, 1, 21);   // x=246 y=41-61
      ctx.fillRect(246, 62, 1, 4);    // x=246 y=62-65

      // Dark accents at edges
      ctx.fillStyle = "#26615e";
      ctx.fillRect(247, 61, 1, 1);
      ctx.fillRect(245, 65, 1, 1);
      ctx.fillRect(172, 65, 1, 1);

      // Teal vertical accent
      ctx.fillStyle = "#2c625d";
      ctx.fillRect(245, 55, 1, 7);    // x=245 y=55-61
      ctx.fillRect(172, 61, 1, 4);    // x=172 y=61-64

      // Horizontal ground line
      ctx.fillStyle = "#3e8e80";
      ctx.fillRect(172, 66, 5, 1);    // 172-176
      ctx.fillRect(178, 66, 71, 1);   // 178-248
      ctx.fillRect(217, 67, 1, 1);

      // Bush/hedge patches along ground (y=61-64)
      ctx.fillStyle = "#2c625d";
      ctx.fillRect(175, 61, 15, 1);   // 175-189
      ctx.fillRect(184, 62, 3, 1);    // 184-186
      ctx.fillRect(189, 62, 1, 2);    // 189 y=62-63
      ctx.fillRect(193, 61, 1, 3);    // 193 y=61-63
      ctx.fillRect(188, 63, 1, 2);    // 188 y=63-64
      ctx.fillRect(190, 63, 3, 1);    // 190-192
      ctx.fillRect(194, 63, 1, 1);
      ctx.fillRect(195, 62, 5, 1);    // 195-199
      ctx.fillRect(199, 63, 4, 1);    // 199-202
      ctx.fillRect(202, 62, 5, 1);    // 202-206
      ctx.fillRect(205, 61, 6, 1);    // 205-210
      ctx.fillRect(212, 61, 4, 1);    // 212-215
      ctx.fillRect(218, 61, 9, 1);    // 218-226
      ctx.fillRect(227, 62, 1, 1);
      ctx.fillRect(228, 63, 4, 1);    // 228-231
      ctx.fillRect(231, 61, 12, 1);   // 231-242

      // Corner detail
      ctx.fillStyle = "#2f7c6b";
      ctx.fillRect(145, 52, 1, 2);
      ctx.fillRect(146, 53, 1, 1);
      ctx.fillStyle = "#408c79";
      ctx.fillRect(144, 53, 1, 1);
    }
    // Draw lounge decoration pixels (guitar/fireplace area)
    const loungePixels = loadDecoPixels(theme.id, "lounge");
    for (const p of loungePixels) {
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x, p.y, 1, 1);
    }
    drawMonolithSurrounds(ctx, theme);
    // Draw tower decoration pixels (only when monolith is visible)
    const { towerSize: _ts, towerVisible: _tv } = useAgentOfficeStore.getState();
    // Decoration fades in after the monolith is ~40% materialized (~0.5s delay)
    const decorAlpha = Math.max(0, (monolithTransition - 0.4) / 0.6);
    if (_tv && _ts === "monolith" && decorAlpha > 0) {
      ctx.globalAlpha = decorAlpha;
      const towerPixels = loadDecoPixels(theme.id, "tower-decor");
      for (const p of towerPixels) {
        ctx.fillStyle = p.color;
        ctx.fillRect(p.x, p.y, 1, 1);
      }
      ctx.globalAlpha = 1;
    }
  }, editMode !== "none");

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

  // 4.55. Poster decoration pixels (on top of posters, on back wall)
  const posterPixels = loadDecoPixels(theme.id, "posters");
  for (const p of posterPixels) {
    ctx.fillStyle = p.color;
    ctx.fillRect(p.x, p.y, 1, 1);
  }

  // 4.6. Monolith (in-scene pixel tower) with materialize transition
  const { towerSize, towerVisible } = useAgentOfficeStore.getState();
  const wantMonolith = towerVisible && towerSize === "monolith";
  if (wantMonolith && !monolithVisible) monolithVisible = true;
  if (!wantMonolith && monolithVisible && monolithTransition <= 0) monolithVisible = false;
  // Delay on initial page load so the full animation is visible
  if (monolithDelayFrames > 0) { monolithDelayFrames--; }
  // Advance transition
  if (wantMonolith && monolithTransition < 1 && monolithDelayFrames <= 0) {
    monolithTransition = Math.min(1, monolithTransition + 1 / MONOLITH_MATERIALIZE_FRAMES);
  } else if (!wantMonolith && monolithTransition > 0) {
    monolithTransition = Math.max(0, monolithTransition - 1 / MONOLITH_MATERIALIZE_FRAMES);
  }
  if (monolithTransition > 0) {
    drawMonolith(ctx, theme, frame, timeOverride, monolithTransition);
  }

  // 5. Lounge zones — fireplace area (left) and guitar/amp area (right)

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
    const skins = theme.skins;
    if (agent.subagentClass !== null && agent.subagentClass !== undefined) {
      const prefix = skins?.subagent ?? "mage";
      // Pikachu (and other non-colored subagents): no color suffix
      charType = (prefix === "pikachu" ? "pikachu" : `${prefix}-${agent.subagentClass}`) as CharacterType;
    } else if (agent.source === "openclaw") {
      charType = (skins?.openclaw ?? "claw") as CharacterType;
    } else {
      const agentSkin = skins?.agent ?? "clawd";
      if (agentSkin === "starter") {
        charType = assignStarter(agent.id, agents);
      } else {
        charType = agentSkin as CharacterType;
      }
    }

    let drawX: number;
    let drawY: number;
    let spriteState: string = agent.state;
    let flipX = false;

    if (agent.state === "lounging") {
      // Lounging agents wander slowly from their last desk position
      const savedDesk = lastDeskPos.get(agent.id);
      const homeX = savedDesk ? savedDesk.x : BUILDING_X + BUILDING_W / 2;
      const homeY = savedDesk ? savedDesk.y : FLOOR_Y + FLOOR_H / 2 + oY;
      if (!walkStates.has(agent.id)) {
        walkStates.set(agent.id, createWalkState(homeX, homeY));
      }
      const ws = walkStates.get(agent.id)!;
      updateWalkState(ws, false, homeX, homeY, 25, allAvoidZones, true);
      drawX = ws.currentX;
      drawY = ws.currentY;
      flipX = ws.facingRight;
      const walkSprite = getWalkSpriteState(ws);
      spriteState = walkSprite ?? "idle";
    } else if (agent.subagentClass !== null && agent.subagentClass !== undefined) {
      // Subagents roam freely around the floor center — avoid all desks
      const homeX = BUILDING_X + BUILDING_W / 2;
      const homeY = FLOOR_Y + FLOOR_H / 2 + oY;
      if (!walkStates.has(agent.id)) {
        // Offset spawn position so simultaneous subagents don't stack
        const spawnHash = hashForPhase(agent.id);
        const spawnOffsetX = ((spawnHash % 30) - 15);
        const spawnOffsetY = ((spawnHash * 7 % 20) - 10);
        walkStates.set(agent.id, createWalkState(homeX + spawnOffsetX, homeY + spawnOffsetY));
      }
      const ws = walkStates.get(agent.id)!;
      updateWalkState(ws, false, homeX, homeY, 40, allAvoidZones);
      drawX = ws.currentX;
      drawY = ws.currentY;
      flipX = ws.facingRight;
      const walkSprite = getWalkSpriteState(ws);
      if (walkSprite) spriteState = walkSprite;
    } else {
      // Active desk-bound agents sit at their desk
      const pos = deskMap.get(agent.id);
      if (!pos) continue;
      // Remember desk position for lounging wander
      lastDeskPos.set(agent.id, { x: pos.characterX, y: pos.characterY });
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

  // Cat / Pet — skip entirely if no pet
  if (theme.petType !== "none") {
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
      nextFloatCheck = 30 * 60 * (4 + Math.random() * 6);
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
      updateWalkState(catWalkState, true, CAT_HOME_X, CAT_HOME_Y, 60, allAvoidZones);
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
  } // end petType !== "none"

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

  // 7.5. Draw sub-agent connection lines behind all entities
  const agentById = new Map(agents.map(a => [a.id, a]));
  const entityById = new Map(entities.map(e => [e.agentId, e]));
  for (const entity of entities) {
    if (entity.parentId) {
      const parentEntity = entityById.get(entity.parentId);
      if (parentEntity) {
        const tc = TEAM_COLORS[entity.teamColor] ?? "#c4856c";
        ctx.strokeStyle = tc + "88";
        ctx.setLineDash([2, 2]);
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(entity.x, entity.y);
        ctx.lineTo(parentEntity.x, parentEntity.y);
        ctx.stroke();
        ctx.setLineDash([]);
      }
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

    // Trainer blink — swap to blink sprite randomly
    let effectiveSpriteState = entity.spriteState;
    if (entity.spriteKey === "trainer" && !entity.isUnreachable) {
      if (!blinkTimers.has(entity.agentId)) {
        blinkTimers.set(entity.agentId, 60 + Math.floor(Math.random() * 150));
      }
      const active = blinkActive.get(entity.agentId) ?? 0;
      if (active > 0) {
        effectiveSpriteState = "blink";
        blinkActive.set(entity.agentId, active - 1);
      } else {
        let timer = blinkTimers.get(entity.agentId)!;
        timer--;
        if (timer <= 0) {
          blinkActive.set(entity.agentId, 3 + Math.floor(Math.random() * 3));
          blinkTimers.set(entity.agentId, 60 + Math.floor(Math.random() * 180));
        } else {
          blinkTimers.set(entity.agentId, timer);
        }
      }
    }

    // Use closed-eyes sprite for sleeping CC agents (idle 15+ min)
    const sleepAgentData = agentById.get(entity.agentId);
    const sleepIdleDuration = sleepAgentData ? Date.now() - sleepAgentData.lastActivity : 0;
    if (entity.activityState === "idle" && entity.source === "cc"
        && sleepIdleDuration > 15 * 60 * 1000) {
      effectiveSpriteState = "waiting"; // closed eyes
    }

    const sprite = getSprite(
      spriteCache,
      entity.spriteKey,
      effectiveSpriteState as any
    ) ?? getSprite(spriteCache, entity.spriteKey, "idle");
    if (!sprite) continue;

    if (entity.isUnreachable) {
      ctx.globalAlpha = 0.3;
      ctx.filter = "grayscale(1)";
    }

    // Round all coords to integers to prevent subpixel smearing on pixel-art sprites
    const rx = Math.round(entity.x);
    const ry = Math.round(entity.y);
    const hw = (sprite.width / 2) | 0;
    const hh = (sprite.height / 2) | 0;

    if (entity.flipX) {
      ctx.save();
      ctx.translate(rx, ry - hh);
      ctx.scale(-1, 1);
      ctx.drawImage(sprite.canvas, -hw, 0);
      ctx.restore();
    } else {
      ctx.drawImage(sprite.canvas, rx - hw, ry - hh);
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

    // Idle CC agent "zzz" — only after 15+ minutes of no activity
    const agentData = agentById.get(entity.agentId);
    const idleDuration = agentData ? Date.now() - agentData.lastActivity : 0;
    const isSleeping = entity.activityState === "idle" && entity.source === "cc"
      && !entity.isUnreachable && entity.agentId !== "__cat__"
      && entity.agentId !== "__cat_float__" && idleDuration > 15 * 60 * 1000;
    if (isSleeping) {
      const zPhase = Math.floor((frame + hashForPhase(entity.agentId)) / 40) % 3;
      ctx.fillStyle = "#8888aa";
      ctx.font = "4px monospace";
      const zx = entity.x + 6;
      const zy = entity.y - sprite.height / 2 - 3;
      ctx.globalAlpha = 0.8;
      ctx.fillText("z", zx, zy);
      if (zPhase >= 1) ctx.fillText("z", zx + 4, zy - 4);
      if (zPhase >= 2) ctx.fillText("z", zx + 7, zy - 7);
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

  }

  // 9. Draw desk fronts (tables + laptops) on top of agents
  drawDeskFronts();

  // 9b. Debug desk numbers
  if (useAgentOfficeStore.getState().debugOn) {
    ctx.font = "bold 6px monospace";
    ctx.textAlign = "center";
    for (let i = 0; i < DESK_POSITIONS.length; i++) {
      const d = DESK_POSITIONS[i];
      ctx.fillStyle = "rgba(0,0,0,0.7)";
      ctx.fillText(String(i), d.x, d.y + oY - 6);
    }
    ctx.textAlign = "start";
  }

  // 10. Laptop glow — on top of desk fronts
  const towerInfo = getPixelTowerData();
  if (towerInfo.connected) {
    const topPixels = towerInfo.data.panels.top;
    const SLOT_PIXELS = [
      [15, 16, 20, 21], // slot 0 — BL quadrant (claw slot 0)
      [18, 19, 23, 24], // slot 1 — BR quadrant (claw slot 1)
      [0, 1, 5, 6],     // slot 2 — TL quadrant (claw slot 2)
      [3, 4, 8, 9],     // slot 3 — TR quadrant (claw slot 3)
    ];
    const mainCCs = agents.filter(
      (a) => a.source === "cc" && (a.subagentClass === null || a.subagentClass === undefined)
    );

    // Use authoritative slot mapping from claw if available
    const slotsDetail = towerInfo.data.slotsDetail;
    if (slotsDetail && slotsDetail.length > 0) {
      // Match agents to slots by session_id (project dir hash)
      stickyQuadrants.clear();
      for (let s = 0; s < slotsDetail.length && s < 4; s++) {
        const detail = slotsDetail[s];
        if (!detail.session_id) continue;
        // Find the agent whose project dir hashes to this session_id
        for (const agent of mainCCs) {
          if (stickyQuadrants.has(agent.id)) continue;
          // Extract project dir from agent file path
          const projectsIdx = agent.id.indexOf("/.claude/projects/");
          if (projectsIdx < 0) continue;
          const afterProjects = agent.id.slice(projectsIdx + 18); // after "/.claude/projects/"
          // Compare name as a simpler match (project basename)
          if (detail.name && agent.id.includes(detail.name)) {
            stickyQuadrants.set(agent.id, s);
            break;
          }
        }
      }
    }

    // Fallback: assign unmatched agents to remaining slots
    const takenSlots = new Set(stickyQuadrants.values());
    for (const id of stickyQuadrants.keys()) {
      if (!mainCCs.some((a) => a.id === id)) stickyQuadrants.delete(id);
    }
    const sortedCCs = [...mainCCs].sort((a, b) => a.id.localeCompare(b.id));
    for (const agent of sortedCCs) {
      if (stickyQuadrants.has(agent.id)) continue;
      for (let s = 0; s < 4; s++) {
        if (!takenSlots.has(s)) {
          stickyQuadrants.set(agent.id, s);
          takenSlots.add(s);
          break;
        }
      }
    }
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

      // Pokeball level-up flash — white→gold overlay
      const flashFrames = pokeballFlashes.get(agent.id) ?? 0;
      if (flashFrames > 0) {
        pokeballFlashes.set(agent.id, flashFrames - 1);
        const flashT = flashFrames / 20;
        const flashColor = flashT > 0.5 ? "#ffffff" : "#ffcc44";
        ctx.globalAlpha = flashT * 0.6;
        ctx.fillStyle = flashColor;
        ctx.fillRect(dx + 1, dy - 1, 7, 7); // Cover pokeball area
        ctx.globalAlpha = 1;
        if (flashFrames <= 1) pokeballFlashes.delete(agent.id);
      }

      const isTool = agent.state === "reading" || agent.state === "typing" || agent.state === "waiting";
      if (isTool) {
        const HIRST = [
          "#5ea87a", "#d4a03c", "#4a9bc7", "#7b68ae",
          "#cc7833", "#4daa8d", "#6b9e8a", "#8baa3c",
          "#d46a4e", "#5c8dbf", "#5b9a7c", "#78b5a0",
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

    // Claw agent pokeball glow — yellow when thinking, same as CC agents
    const clawAgent = agents.find((a) => a.source === "openclaw");
    if (clawAgent && clawAgent.state === "thinking") {
      const clawPos = deskMap.get(clawAgent.id);
      if (clawPos) {
        const dx = clawPos.x;
        const dy = clawPos.y;
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

  // Game mode: EXP bar below pokeball for desk-bound agents
  if (useAgentOfficeStore.getState().gameModeOn) {
    for (const agent of agents) {
      if (agent.level === undefined || agent.exp === undefined) continue;
      if (agent.state === "lounging" || agent.state === "departing") continue;
      const pos = deskMap.get(agent.id);
      if (!pos) continue;

      const totalExp = agent.exp + (agent.expToNext ?? 100);
      if (totalExp <= 0) continue;

      const barX = pos.x + 1;
      const barY = pos.y + 6;
      const barW = 7;
      const fill = (agent.exp ?? 0) / (agent.expToNext ?? 100);
      const teamHex = TEAM_COLORS[agent.teamColor] ?? "#88cc88";

      // Background (unfilled) — 20% opacity
      ctx.globalAlpha = 0.2;
      ctx.fillStyle = teamHex;
      ctx.fillRect(barX, barY, barW, 1);

      // Filled portion
      ctx.globalAlpha = 0.8;
      ctx.fillRect(barX, barY, Math.max(1, Math.floor(barW * fill)), 1);
      ctx.globalAlpha = 1;

      // Streak flame
      if (agent.streak) {
        const flameX = barX + Math.floor(barW / 2);
        const flameY = barY - 1;
        const flicker = Math.floor(frame / 8) % 2;
        ctx.fillStyle = "#ff8844";
        ctx.fillRect(flameX, flameY, 1, 1);
        if (flicker === 0) {
          ctx.fillRect(flameX - 1, flameY, 1, 1);
        } else {
          ctx.fillRect(flameX + 1, flameY, 1, 1);
        }
        ctx.fillStyle = "#ffcc44";
        ctx.fillRect(flameX, flameY - 1, 1, 1);
      }
    }
  }

  // Detect level-ups
  if (useAgentOfficeStore.getState().gameModeOn) {
    for (const agent of agents) {
      if (agent.level === undefined) continue;
      const prev = previousLevels.get(agent.id) ?? 1;
      if (agent.level > prev) {
        pokeballFlashes.set(agent.id, 20);
        const wsPos = getAgentPosition(agent.id);
        const deskPos = deskMap.get(agent.id);
        const pos = wsPos ?? deskPos;
        if (pos) {
          const px = "characterX" in pos ? (pos as { characterX: number }).characterX : pos.x;
          const py = "characterY" in pos ? (pos as { characterY: number }).characterY : pos.y;
          triggerLevelUp(px, py, TEAM_COLORS[agent.teamColor] ?? "#88cc88");
        }
      }
      previousLevels.set(agent.id, agent.level);
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

  // Level-up celebrations
  for (let i = activeLevelUps.length - 1; i >= 0; i--) {
    const lu = activeLevelUps[i];
    lu.frame++;
    if (lu.frame > 60) { activeLevelUps.splice(i, 1); continue; }

    const t = lu.frame / 60;

    // Rising "LEVEL UP!" text
    ctx.globalAlpha = Math.max(0, 1 - t);
    ctx.fillStyle = "#000000";
    ctx.font = "bold 5px monospace";
    ctx.textAlign = "center";
    const textY = lu.y - 10 - lu.frame * 0.33;
    ctx.fillText("LEVEL UP!", lu.x + 1, textY + 1); // shadow
    ctx.fillStyle = "#ffcc44";
    ctx.fillText("LEVEL UP!", lu.x, textY);
    ctx.textAlign = "start";

    // Sparkle particles
    for (const p of lu.particles) {
      const spread = lu.frame * p.speed;
      const px = lu.x + Math.cos(p.angle) * spread;
      const py = lu.y + Math.sin(p.angle) * spread - t * 8;
      ctx.fillStyle = p.color;
      const size = Math.max(1, 3 - Math.floor(t * 3));
      ctx.globalAlpha = Math.max(0, 1 - t * 1.3);
      ctx.fillRect(Math.floor(px), Math.floor(py), size, size);
    }
    ctx.globalAlpha = 1;
  }

  // Screen flash
  if (screenFlashAlpha > 0) {
    ctx.globalAlpha = screenFlashAlpha;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    ctx.globalAlpha = 1;
    screenFlashAlpha = Math.max(0, screenFlashAlpha - 0.012);
  }

  // Clean up agents that no longer exist — poof any that vanished without departing
  const activeIds = new Set(agents.map((a) => a.id));
  for (const id of knownAgentIds) {
    if (!activeIds.has(id) && !poofedIds.has(id)) {
      // Agent vanished without "departing" — spawn poof at last known position
      const sp = smoothPos.get(id);
      const ws = walkStates.get(id);
      if (sp || ws) {
        const px = sp ? sp.x : ws!.currentX;
        const py = sp ? sp.y : ws!.currentY;
        activePoofs.push({ x: px, y: py, frame: 0, color: POOF_COLORS[Math.floor(Math.random() * POOF_COLORS.length)] });
      }
    }
    if (!activeIds.has(id)) knownAgentIds.delete(id);
  }
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
  // Clean up game mode state for departed agents
  for (const id of previousLevels.keys()) {
    if (!activeIds.has(id)) previousLevels.delete(id);
  }
  for (const id of pokeballFlashes.keys()) {
    if (!activeIds.has(id)) pokeballFlashes.delete(id);
  }
  // agentLevelAtDesk is cleared and rebuilt each frame, no per-agent cleanup needed

}
