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

const DESK_POSITIONS: DeskPosition[] = [];
for (let row = 0; row < 2; row++) {
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

function hashId(id: string): number {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = (hash * 31 + id.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

// Persistent desk assignments so agents don't jump around when others come/go
const stickyDesks = new Map<string, number>();

export function assignDesks(
  agentIds: string[]
): Map<string, DeskPosition> {
  const assignments = new Map<string, DeskPosition>();
  const activeIds = new Set(agentIds);

  // Clean up agents that are gone
  for (const id of stickyDesks.keys()) {
    if (!activeIds.has(id)) stickyDesks.delete(id);
  }

  // Collect currently taken desk indices from sticky assignments
  const taken = new Set<number>();
  for (const [id, deskIdx] of stickyDesks) {
    if (activeIds.has(id)) taken.add(deskIdx);
  }

  // Reserve bottom-right desk (index 5) for openclaw
  const OPENCLAW_DESK = 5;
  if (activeIds.has("openclaw-main") && !stickyDesks.has("openclaw-main")) {
    stickyDesks.set("openclaw-main", OPENCLAW_DESK);
    taken.add(OPENCLAW_DESK);
  }

  for (const id of agentIds) {
    // Reuse existing sticky assignment if still valid
    if (stickyDesks.has(id)) {
      assignments.set(id, DESK_POSITIONS[stickyDesks.get(id)!]);
      continue;
    }

    // New agent — fill desks front row first (indices 3,4,5 then 0,1,2)
    let deskIdx = -1;
    const fillOrder = [3, 4, 5, 0, 1, 2];
    for (const i of fillOrder) {
      if (!taken.has(i)) { deskIdx = i; break; }
    }
    if (deskIdx === -1) deskIdx = DESK_POSITIONS.length; // overflow

    if (deskIdx < DESK_POSITIONS.length && !taken.has(deskIdx)) {
      taken.add(deskIdx);
      stickyDesks.set(id, deskIdx);
      assignments.set(id, DESK_POSITIONS[deskIdx]);
    } else {
      const overflowIdx = agentIds.indexOf(id) - DESK_POSITIONS.length;
      assignments.set(id, getOverflowPosition(overflowIdx));
    }
  }

  return assignments;
}
