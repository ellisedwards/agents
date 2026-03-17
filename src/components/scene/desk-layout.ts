import {
  BUILDING_X,
  BUILDING_W,
  FLOOR_Y,
  FLOOR_H,
} from "./environment";
import { CANVAS_HEIGHT } from "../canvas-transform";

export interface DeskPosition {
  x: number;
  y: number;
  characterX: number;
  characterY: number;
}

// 2x3 grid of desks inside the building floor area, centered vertically
const dLeft = BUILDING_X + 18;
const dRight = BUILDING_X + BUILDING_W - 22;
const dW = dRight - dLeft;
const dSpX = Math.floor(dW / 3);
const DESK_TOP_OFFSET = 43; // push desks down to center 2 rows in the floor
const dSpY = Math.floor((FLOOR_H - DESK_TOP_OFFSET - 4) / 2);

// Front row (bottom) = desks 0,1,2 — Back row (top) = desks 3,4,5
const DESK_POSITIONS: DeskPosition[] = [];
for (let row = 1; row >= 0; row--) {
  for (let col = 0; col < 3; col++) {
    const x = dLeft + Math.floor(dSpX / 2) + col * dSpX;
    const y = FLOOR_Y + DESK_TOP_OFFSET + row * dSpY;
    DESK_POSITIONS.push({
      x,
      y,
      characterX: x - 7,
      characterY: y - 3,
    });
  }
}

export { DESK_POSITIONS };

export function getOverflowPosition(index: number): DeskPosition {
  const x = 30 + (index % 6) * 32;
  const y = CANVAS_HEIGHT - 30;
  return { x, y, characterX: x - 7, characterY: y - 4 };
}

// Slot N = Desk N. Claw is the source of truth.
// stickyDesks only remembers the LAST assignment so agents don't jump
// when slotMap is temporarily unavailable (claw disconnect).
const stickyDesks = new Map<string, number>();

const OPENCLAW_DESK = 2;

export function assignDesks(
  agentIds: string[],
  slotMap?: Map<string, number> // agentId → claw slot number (authoritative)
): Map<string, DeskPosition> {
  const assignments = new Map<string, DeskPosition>();
  const activeIds = new Set(agentIds);

  // Clean up departed agents
  for (const id of stickyDesks.keys()) {
    if (!activeIds.has(id)) stickyDesks.delete(id);
  }

  // First pass: assign from slot map (authoritative — always wins)
  const taken = new Set<number>();

  // Reserve openclaw desk
  if (activeIds.has("openclaw-main")) {
    stickyDesks.set("openclaw-main", OPENCLAW_DESK);
    taken.add(OPENCLAW_DESK);
  }

  // Slot-based assignment: slot N = desk N, but skip OpenClaw's reserved desk
  for (const id of agentIds) {
    if (id === "openclaw-main") continue;
    const slot = slotMap?.get(id);
    if (slot !== undefined && slot >= 0 && slot < DESK_POSITIONS.length) {
      // If this slot collides with OpenClaw's desk, skip — will get fallback
      if (taken.has(slot)) continue;
      stickyDesks.set(id, slot);
      taken.add(slot);
    }
  }

  // Second pass: fallback for agents without claw slots
  for (const id of agentIds) {
    if (stickyDesks.has(id)) continue; // already assigned above

    // Fill first available desk
    let deskIdx = -1;
    const fillOrder = [0, 1, 2, 3, 4, 5];
    for (const i of fillOrder) {
      if (!taken.has(i)) { deskIdx = i; break; }
    }

    if (deskIdx >= 0 && deskIdx < DESK_POSITIONS.length) {
      taken.add(deskIdx);
      stickyDesks.set(id, deskIdx);
    }
  }

  // Build final assignments
  for (const id of agentIds) {
    const deskIdx = stickyDesks.get(id);
    if (deskIdx !== undefined && deskIdx < DESK_POSITIONS.length) {
      assignments.set(id, DESK_POSITIONS[deskIdx]);
    } else {
      const overflowIdx = Math.max(0, agentIds.indexOf(id) - DESK_POSITIONS.length);
      assignments.set(id, getOverflowPosition(overflowIdx));
    }
  }

  return assignments;
}
