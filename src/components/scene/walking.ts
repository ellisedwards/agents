export interface WalkState {
  currentX: number;
  currentY: number;
  targetX: number;
  targetY: number;
  idleFramesRemaining: number;
  isMoving: boolean;
  isSleeping: boolean;
  sleepFramesRemaining: number;
  walkFrame: number;
  frameCounter: number;
  facingRight: boolean;
  idleCyclesSinceNap: number;
}

export interface AvoidZone {
  x: number;
  y: number;
  hw: number; // half-width
  hh: number; // half-height
}

const SUBAGENT_SPEED = 0.5;
const CAT_SPEED = 0.3;
const IDLE_MIN_FRAMES = 60;
const IDLE_MAX_FRAMES = 150;
const CAT_IDLE_MIN = 90;
const CAT_IDLE_MAX = 240;
// ~15 min nap at 60fps = 54000 frames, vary between 12-18 min
const CAT_SLEEP_MIN = 43200;
const CAT_SLEEP_MAX = 64800;
// Cat naps after 8-15 idle cycles (walk/pause rounds)
const CAT_NAP_AFTER_MIN = 8;
const CAT_NAP_AFTER_MAX = 15;

export function createWalkState(x: number, y: number): WalkState {
  return {
    currentX: x,
    currentY: y,
    targetX: x,
    targetY: y,
    idleFramesRemaining: Math.floor(
      Math.random() * (IDLE_MAX_FRAMES - IDLE_MIN_FRAMES) + IDLE_MIN_FRAMES
    ),
    isMoving: false,
    isSleeping: false,
    sleepFramesRemaining: 0,
    walkFrame: 0,
    frameCounter: 0,
    facingRight: true,
    idleCyclesSinceNap: 0,
  };
}

function hitsZone(x: number, y: number, zones: AvoidZone[]): boolean {
  for (const z of zones) {
    if (
      x > z.x - z.hw &&
      x < z.x + z.hw &&
      y > z.y - z.hh &&
      y < z.y + z.hh
    )
      return true;
  }
  return false;
}

function pickTarget(
  state: WalkState,
  homeX: number,
  homeY: number,
  wanderRadius: number,
  avoidZones: AvoidZone[]
): void {
  // Try a few times to find a target that doesn't land on a desk
  for (let attempt = 0; attempt < 8; attempt++) {
    const tx = homeX + (Math.random() - 0.5) * wanderRadius * 2;
    const ty = homeY + (Math.random() - 0.5) * wanderRadius * 2;
    if (!hitsZone(tx, ty, avoidZones)) {
      state.targetX = tx;
      state.targetY = ty;
      state.isMoving = true;
      state.frameCounter = 0;
      return;
    }
  }
  // Fallback: just go home
  state.targetX = homeX;
  state.targetY = homeY;
  state.isMoving = true;
  state.frameCounter = 0;
}

export function updateWalkState(
  state: WalkState,
  isCat: boolean,
  homeX: number,
  homeY: number,
  wanderRadius: number,
  avoidZones: AvoidZone[] = []
): void {
  // Sleeping — count down until wake
  if (state.isSleeping) {
    state.sleepFramesRemaining--;
    if (state.sleepFramesRemaining <= 0) {
      state.isSleeping = false;
      state.idleCyclesSinceNap = 0;
      state.idleFramesRemaining = Math.floor(
        Math.random() * (CAT_IDLE_MAX - CAT_IDLE_MIN) + CAT_IDLE_MIN
      );
    }
    return;
  }

  if (state.isMoving) {
    const speed = isCat ? CAT_SPEED : SUBAGENT_SPEED;
    const dx = state.targetX - state.currentX;
    const dy = state.targetY - state.currentY;
    const dist = Math.sqrt(dx * dx + dy * dy);

    // Track facing direction based on movement
    if (Math.abs(dx) > 0.1) {
      state.facingRight = dx > 0;
    }

    if (dist < speed) {
      state.currentX = state.targetX;
      state.currentY = state.targetY;
      state.isMoving = false;
      const minIdle = isCat ? CAT_IDLE_MIN : IDLE_MIN_FRAMES;
      const maxIdle = isCat ? CAT_IDLE_MAX : IDLE_MAX_FRAMES;
      state.idleFramesRemaining = Math.floor(
        Math.random() * (maxIdle - minIdle) + minIdle
      );

      // Cat: count idle cycles and maybe nap
      if (isCat) {
        state.idleCyclesSinceNap++;
        const napThreshold = Math.floor(
          Math.random() * (CAT_NAP_AFTER_MAX - CAT_NAP_AFTER_MIN) + CAT_NAP_AFTER_MIN
        );
        if (state.idleCyclesSinceNap >= napThreshold) {
          state.isSleeping = true;
          state.sleepFramesRemaining = Math.floor(
            Math.random() * (CAT_SLEEP_MAX - CAT_SLEEP_MIN) + CAT_SLEEP_MIN
          );
          return;
        }
      }
    } else {
      state.currentX += (dx / dist) * speed;
      state.currentY += (dy / dist) * speed;
    }

    state.frameCounter++;
    if (state.frameCounter % 8 === 0) {
      state.walkFrame = state.walkFrame === 0 ? 1 : 0;
    }
  } else {
    state.idleFramesRemaining--;
    if (state.idleFramesRemaining <= 0) {
      pickTarget(state, homeX, homeY, wanderRadius, avoidZones);
    }
  }
}

export function getWalkSpriteState(
  state: WalkState
): "walk1" | "walk2" | "sleep" | null {
  if (state.isSleeping) return "sleep";
  if (!state.isMoving) return null;
  return state.walkFrame === 0 ? "walk1" : "walk2";
}
