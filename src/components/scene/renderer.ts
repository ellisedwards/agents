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
import type { MonitorStatus } from "../store";

// Walk states persist across frames
const walkStates = new Map<string, WalkState>();
let catWalkState: WalkState | null = null;

/** Wake the cat if it's sleeping. Returns true if cat was woken. */
export function pokeCat(): boolean {
  if (catWalkState?.isSleeping) {
    catWalkState.isSleeping = false;
    catWalkState.sleepFramesRemaining = 0;
    catWalkState.idleCyclesSinceNap = 0;
    catWalkState.idleFramesRemaining = 30; // wake up quickly
    return true;
  }
  return false;
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

// Status poster — on the first glass panel right of the fireplace
const STATUS_UP = "#22c55e";
const STATUS_DOWN = "#ef4444";
const BAR_COLOR = "#2a2a2a";
const POSTER_BG = "#555068";
const POSTER_BORDER = "#444058";

function renderStatusPoster(
  ctx: CanvasRenderingContext2D,
  monitors: MonitorStatus[]
) {
  const contentW = 3 * 3 + 1 + 2; // 3 bars + gap + dot = 12
  const contentH = 3 * 4 - 2; // 3 rows * 4px spacing - last gap = 10
  const pad = 2;
  // Align with first glass panel: glassStart = fpx + 28 = BUILDING_X + 5 + 28 = BUILDING_X + 33
  // glassY = BUILDING_Y + 3
  const px = BUILDING_X + 33 + 5;
  const py = BUILDING_Y + 3 + 5;

  // Poster backdrop
  ctx.fillStyle = POSTER_BORDER;
  ctx.fillRect(px - pad - 1, py - pad - 1, contentW + pad * 2 + 2, contentH + pad * 2 + 2);
  ctx.fillStyle = POSTER_BG;
  ctx.fillRect(px - pad, py - pad, contentW + pad * 2, contentH + pad * 2);

  const barCounts = [3, 2, 1];
  const rowH = 4;
  const dotCol = px + 3 * 3 + 1; // aligned dot column after max bars

  for (let i = 0; i < 3 && i < monitors.length; i++) {
    const mon = monitors[i];
    const ry = py + i * rowH;

    // Bars
    ctx.fillStyle = BAR_COLOR;
    for (let b = 0; b < barCounts[i]; b++) {
      ctx.fillRect(px + b * 3, ry, 2, 2);
    }

    // Health dot — aligned column
    ctx.fillStyle = mon.up ? STATUS_UP : STATUS_DOWN;
    ctx.fillRect(dotCol, ry, 2, 2);
  }
}

import type { TimeOfDay } from "./environment";

export function renderScene(
  ctx: CanvasRenderingContext2D,
  agents: AgentState[],
  spriteCache: ReturnType<typeof buildSpriteCache>,
  frame: number,
  monitors?: MonitorStatus[],
  timeOverride?: TimeOfDay
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

  // 3. Determine which desk indices are occupied
  const occupiedDeskIndices = new Set<number>();
  for (const agent of deskEligible) {
    const pos = deskMap.get(agent.id);
    if (!pos) continue;
    const idx = DESK_POSITIONS.indexOf(pos);
    if (idx >= 0) occupiedDeskIndices.add(idx);
  }

  // 4. Draw environment
  const deskCenters = DESK_POSITIONS.map((d) => ({ x: d.x, y: d.y }));
  drawEnvironment(ctx, deskCenters, occupiedDeskIndices, frame, timeOverride);

  // 4.5. Status poster (back wall, near fireplace)
  if (monitors && monitors.length > 0) {
    renderStatusPoster(ctx, monitors);
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
      // Subagents walk near their desk
      const pos = deskMap.get(agent.id);
      const homeX = pos ? pos.characterX : BUILDING_X + BUILDING_W / 2;
      const homeY = pos ? pos.characterY : FLOOR_Y + FLOOR_H / 2;
      if (!walkStates.has(agent.id)) {
        walkStates.set(agent.id, createWalkState(homeX, homeY));
      }
      const ws = walkStates.get(agent.id)!;
      updateWalkState(ws, false, homeX, homeY, 20, deskAvoidZones);
      drawX = ws.currentX;
      drawY = ws.currentY;
      flipX = ws.facingRight;
      const walkSprite = getWalkSpriteState(ws);
      if (walkSprite) spriteState = walkSprite;
    } else if (agent.state === "idle" && agent.source === "cc") {
      // Idle CC agents wander near their desk
      const pos = deskMap.get(agent.id);
      if (!pos) continue;
      if (!walkStates.has(agent.id)) {
        walkStates.set(agent.id, createWalkState(pos.characterX, pos.characterY));
      }
      const ws = walkStates.get(agent.id)!;
      updateWalkState(ws, false, pos.characterX, pos.characterY, 15, deskAvoidZones);
      drawX = ws.currentX;
      drawY = ws.currentY;
      flipX = ws.facingRight;
      const walkSprite = getWalkSpriteState(ws);
      if (walkSprite) spriteState = walkSprite;
      else spriteState = "idle";
    } else {
      // Active desk-bound agents sit at their desk
      const pos = deskMap.get(agent.id);
      if (!pos) continue;
      drawX = pos.characterX;
      drawY = pos.characterY;
      // Clear walk state so they return to desk position
      walkStates.delete(agent.id);
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
  updateWalkState(catWalkState, true, CAT_HOME_X, CAT_HOME_Y, 60, deskAvoidZones);
  const catWalkSprite = getWalkSpriteState(catWalkState);
  entities.push({
    x: catWalkState.currentX,
    y: catWalkState.currentY,
    spriteKey: "cat",
    spriteState: catWalkSprite ?? "idle",
    agentId: "__cat__",
    isUnreachable: false,
    parentId: null,
    flipX: catWalkState.facingRight,
    teamColor: 0,
    isMainCC: false,
    activityState: "idle",
    source: "cat",
  });

  // Sort all entities by Y for z-ordering
  entities.sort((a, b) => a.y - b.y);

  // 7. Draw all entities
  for (const entity of entities) {
    const sprite = getSprite(
      spriteCache,
      entity.spriteKey,
      entity.spriteState as any
    );
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
}
