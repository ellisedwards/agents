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

// 3x3 grid of desks inside the building floor area, pushed toward the front
const dLeft = BUILDING_X + 18;
const dRight = BUILDING_X + BUILDING_W - 22;
const dW = dRight - dLeft;
const dSpX = Math.floor(dW / 3);
const DESK_TOP_OFFSET = 16; // push desks down from FLOOR_Y
const dSpY = Math.floor((FLOOR_H - DESK_TOP_OFFSET - 4) / 3);

const DESK_POSITIONS: DeskPosition[] = [];
for (let row = 0; row < 3; row++) {
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
  const x = 30 + (index % 9) * 32;
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

  for (const id of agentIds) {
    // Reuse existing sticky assignment if still valid
    if (stickyDesks.has(id)) {
      assignments.set(id, DESK_POSITIONS[stickyDesks.get(id)!]);
      continue;
    }

    // New agent — find a desk starting from its hash preference
    let deskIdx = hashId(id) % DESK_POSITIONS.length;
    let attempts = 0;
    while (taken.has(deskIdx) && attempts < DESK_POSITIONS.length) {
      deskIdx = (deskIdx + 1) % DESK_POSITIONS.length;
      attempts++;
    }

    if (!taken.has(deskIdx)) {
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
