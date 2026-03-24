import {
  BUILDING_X,
  BUILDING_W,
  FLOOR_Y,
  FLOOR_H,
} from "./environment";
import { CANVAS_HEIGHT } from "../canvas-transform";
import type { SlotDetail } from "../../hooks/use-pixel-tower";

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

// Claw slot → physical desk (skip desk 2 = trainer)
export const SLOT_TO_DESK = [0, 1, 3, 4] as const;

// Physical desk → claw slot (inverse, only for desks with quadrants)
export const DESK_TO_SLOT: Partial<Record<number, number>> = { 0: 0, 1: 1, 3: 2, 4: 3 };

// Desk 2 is ALWAYS the trainer. This is structural, not a reservation.
export const TRAINER_DESK = 2;

// CC agents fill these desks in order when no claw slot is available
const CC_FILL_ORDER = [0, 1, 3, 4, 5];

export interface AgentAssignment {
  desk: DeskPosition;    // physical desk position
  deskIndex: number;     // physical desk index (0-5)
  clawSlot?: number;     // claw quadrant (0-3), undefined for overflow agents
}

export interface AssignmentResult {
  assignments: Map<string, AgentAssignment>;  // agentId → assignment
  getDesk(agentId: string): DeskPosition | undefined;
  getSlot(agentId: string): number | undefined;
  getDeskIndex(agentId: string): number | undefined;
}

// Single sticky map — replaces both stickyDesks and stickyQuadrants
const stickyAssignments = new Map<string, number>(); // agentId → deskIndex

// Cache the last result so multiple consumers can read it without recomputing
let cachedResult: AssignmentResult | null = null;

let prevSeatSummary = "";
let seatChangeCallback: ((text: string) => void) | null = null;
export function onSeatChange(cb: ((text: string) => void) | null) { seatChangeCallback = cb; }

export function computeAssignments(
  agentIds: string[],          // desk-eligible agent IDs (no subagents, no lounging/departing)
  allCCMainIds: string[],      // ALL CC main agent IDs (including lounging/departing) — for sticky preservation
  slotsDetail?: SlotDetail[],  // raw claw data — NOT a pre-processed map
): AssignmentResult {
  const retainIds = new Set(allCCMainIds); // broad set: keep sticky assignments for lounging agents
  retainIds.add("openclaw-main");

  // 1. Clean up only truly departed agents (not lounging — they keep their desk)
  for (const id of stickyAssignments.keys()) {
    if (!retainIds.has(id)) stickyAssignments.delete(id);
  }

  // 2. Build taken set from surviving assignments
  const taken = new Set<number>();
  for (const deskIdx of stickyAssignments.values()) taken.add(deskIdx);

  // 3. Trainer desk is ALWAYS taken — also evict any CC agent stuck there
  taken.add(TRAINER_DESK);
  for (const [id, deskIdx] of stickyAssignments) {
    if (id !== "openclaw-main" && deskIdx === TRAINER_DESK) {
      stickyAssignments.delete(id);
    }
  }

  // 4. Match agents to desks from claw slotsDetail (authoritative)
  //    Two-phase approach to handle swaps:
  //    Phase A: determine desired moves (agentId → targetDesk)
  //    Phase B: execute moves, freeing old desks first for agents that are moving
  if (slotsDetail && slotsDetail.length > 0) {
    // Phase A: match claw slots to agents, build desired moves
    const desiredMoves = new Map<string, number>(); // agentId → targetDesk
    const matchedAgentIds = new Set<string>();
    for (let s = 0; s < slotsDetail.length && s < SLOT_TO_DESK.length; s++) {
      const detail = slotsDetail[s];
      if (!detail.session_id && !detail.name) continue;

      for (const id of agentIds) {
        if (matchedAgentIds.has(id)) continue;
        if (id === "openclaw-main") continue;
        const matchById = detail.session_id && id.includes(detail.session_id);
        const matchByName = !matchById && detail.name && id.includes(detail.name);
        if (!matchById && !matchByName) continue;

        matchedAgentIds.add(id);
        const targetDesk = SLOT_TO_DESK[s];
        const currentDesk = stickyAssignments.get(id);
        if (currentDesk !== targetDesk) {
          desiredMoves.set(id, targetDesk);
        }
        break;
      }
    }

    // Phase B: free old desks for ALL moving agents first, then assign new desks
    for (const [id] of desiredMoves) {
      const oldDesk = stickyAssignments.get(id);
      if (oldDesk !== undefined) {
        taken.delete(oldDesk);
        stickyAssignments.delete(id);
      }
    }
    for (const [id, targetDesk] of desiredMoves) {
      if (!taken.has(targetDesk)) {
        stickyAssignments.set(id, targetDesk);
        taken.add(targetDesk);
      }
    }
  }

  // 5. Fallback: assign unmatched CC agents to first available desk (skip desk 2)
  for (const id of agentIds) {
    if (id === "openclaw-main") continue;
    if (stickyAssignments.has(id)) continue;

    for (const deskIdx of CC_FILL_ORDER) {
      if (!taken.has(deskIdx)) {
        stickyAssignments.set(id, deskIdx);
        taken.add(deskIdx);
        break;
      }
    }
  }

  // 6. Openclaw-main always gets desk 2
  if (retainIds.has("openclaw-main")) {
    stickyAssignments.set("openclaw-main", TRAINER_DESK);
  }

  // 7. Build result — includes desk-eligible CC agents AND openclaw-main
  const assignments = new Map<string, AgentAssignment>();
  // Include openclaw-main explicitly (it's not in agentIds since source !== "cc")
  const resultIds = [...agentIds];
  if (retainIds.has("openclaw-main")) resultIds.push("openclaw-main");
  for (const id of resultIds) {
    const deskIdx = stickyAssignments.get(id);
    if (deskIdx !== undefined && deskIdx < DESK_POSITIONS.length) {
      assignments.set(id, {
        desk: DESK_POSITIONS[deskIdx],
        deskIndex: deskIdx,
        clawSlot: DESK_TO_SLOT[deskIdx],
      });
    } else {
      // Count how many agents are already in overflow to avoid stacking
      let overflowCount = 0;
      for (const a of assignments.values()) if (a.deskIndex === -1) overflowCount++;
      assignments.set(id, {
        desk: getOverflowPosition(overflowCount),
        deskIndex: -1,
        clawSlot: undefined,
      });
    }
  }

  cachedResult = {
    assignments,
    getDesk: (id) => assignments.get(id)?.desk,
    getSlot: (id) => assignments.get(id)?.clawSlot,
    getDeskIndex: (id) => assignments.get(id)?.deskIndex,
  };

  // Debug: notify seat changes
  const seatSummary = [...assignments.entries()]
    .filter(([, a]) => a.deskIndex >= 0) // only assigned agents (exclude overflow at -1)
    .map(([id, a]) => `${id}→desk${a.deskIndex}`)
    .join(" ");
  if (seatSummary !== prevSeatSummary) {
    prevSeatSummary = seatSummary;
    if (seatChangeCallback && seatSummary) seatChangeCallback(`assign ${seatSummary}`);
  }

  return cachedResult;
}

export function getCachedAssignments(): AssignmentResult | null {
  return cachedResult;
}
