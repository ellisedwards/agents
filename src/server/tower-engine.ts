// Tower 1 Local Animation Engine
// Replicates the physical tower's behavior 1:1 for AWAY mode.
// Hook events drive the state machine. Outputs 75 hex colors at 30fps.

const FPS = 30;
const FRAME_MS = 1000 / FPS;
const TTL_MS = 300_000; // 5min auto-deactivate — safety net for crashed sessions only (Stop hook handles normal cleanup)

// --- Layout ---
// 75 pixels: 3 stacked 5x5 panels. Panel 0=bottom, 1=middle, 2=top.
const SLOT_PIXELS: number[][] = [
  [20, 21, 15, 16], // Slot 0: top-left of panel 2
  [23, 24, 18, 19], // Slot 1: top-right of panel 2
  [0, 1, 5, 6],     // Slot 2: bottom-left of panel 2
  [3, 4, 8, 9],     // Slot 3: bottom-right of panel 2
];
const CLAW_PIXEL = 12; // center of panel 2

// --- HSV to RGB ---
function hsvToRgb(h: number, s: number, v: number): [number, number, number] {
  const i = Math.floor(h * 6);
  const f = h * 6 - i;
  const p = v * (1 - s);
  const q = v * (1 - f * s);
  const t = v * (1 - (1 - f) * s);
  const mod = i % 6;
  const r = [v, q, p, p, t, v][mod];
  const g = [t, v, v, q, p, p][mod];
  const b = [p, p, t, v, v, q][mod];
  return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];
}

function rgbToHex(r: number, g: number, b: number): string {
  return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
}

// --- Hirst Color Generation (from spec Part 2) ---
function randomHirstColor(): [number, number, number] {
  const roll = Math.random();
  const h = Math.random();
  let s: number, v: number;
  if (roll < 0.2) {
    s = 1.0; v = 1.0;
  } else if (roll < 0.45) {
    s = Math.random() * 0.5 + 0.3;
    v = (Math.random() * 0.4 + 0.15) * 0.25;
  } else {
    s = Math.random() * 0.5 + 0.3;
    v = Math.random() * 0.4 + 0.15;
  }
  return hsvToRgb(h, s, v);
}

// --- Hirst Dot State ---
interface HirstDot {
  r: number; g: number; b: number;
  countdown: number;
  intervalMin: number;
  intervalMax: number;
}

function initHirstDot(): HirstDot {
  const [r, g, b] = randomHirstColor();
  const base = Math.floor(0.5 * FPS); // 15
  return {
    r, g, b,
    countdown: Math.floor(Math.random() * base * 2) + 1,
    intervalMin: Math.floor(base * 0.5), // 7
    intervalMax: Math.floor(base * 1.5), // 22
  };
}

function tickHirstDot(dot: HirstDot): void {
  dot.countdown--;
  if (dot.countdown <= 0) {
    const [r, g, b] = randomHirstColor();
    dot.r = r; dot.g = g; dot.b = b;
    dot.countdown = dot.intervalMin + Math.floor(Math.random() * (dot.intervalMax - dot.intervalMin));
  }
}

// --- Shimmer State (active slot pixels on panel 2) ---
interface ShimmerPixel {
  brightness: number;
  target: number;
  countdown: number;
}

const SHIMMER_BASE = 0.20;

function initShimmer(): ShimmerPixel {
  return { brightness: SHIMMER_BASE, target: SHIMMER_BASE, countdown: Math.floor(Math.random() * 10) + 4 };
}

function tickShimmer(px: ShimmerPixel): void {
  px.brightness += (px.target - px.brightness) * 0.22;
  px.countdown--;
  if (px.countdown <= 0) {
    if (Math.random() < 0.35) {
      px.target = Math.random() * 0.45 + SHIMMER_BASE + 0.12;
    } else {
      px.target = Math.random() * 0.12 + SHIMMER_BASE;
    }
    px.countdown = Math.floor(Math.random() * 10) + 4;
  }
}

function shimmerToHex(val: number): string {
  const r = Math.round(Math.min(255, val * 255));
  const g = Math.round(Math.min(255, val * 0.95 * 255));
  const b = Math.round(Math.min(255, val * 0.88 * 255));
  return rgbToHex(r, g, b);
}

// --- Slot State ---
type SlotState = "off" | "waiting" | "active";

// --- Hirst State Machine ---
type HirstPhase = "off" | "in" | "running" | "out";

// --- Tower Engine ---
export class TowerEngine {
  // Slot states
  private slotStates: SlotState[] = ["off", "off", "off", "off"];
  private slotLastActivity: number[] = [0, 0, 0, 0];

  // Hirst dots (panels 0+1, 50 pixels)
  private hirstDots: HirstDot[] = [];

  // Hirst state machine
  private hirstPhase: HirstPhase = "off";
  private hirstTransitionStart = 0;
  private hirstColumnOffsets = [0, 0, 0, 0, 0];

  // Panel 2 shimmer (25 pixels)
  private shimmerPixels: ShimmerPixel[] = [];

  // Output buffer
  private pixels: string[] = Array(75).fill("#000000");

  // Frame counter
  private frameTime = 0;
  private interval: ReturnType<typeof setInterval> | null = null;

  constructor() {
    // Init 50 hirst dots
    for (let i = 0; i < 50; i++) {
      this.hirstDots.push(initHirstDot());
    }
    // Init 25 shimmer pixels for panel 2
    for (let i = 0; i < 25; i++) {
      this.shimmerPixels.push(initShimmer());
    }
  }

  start(): void {
    if (this.interval) return;
    this.interval = setInterval(() => this.tick(), FRAME_MS);
  }

  stop(): void {
    if (this.interval) { clearInterval(this.interval); this.interval = null; }
  }

  // --- Hook handlers ---
  onPromptStart(slot: number): void {
    if (slot < 0 || slot > 3) return;
    // One-way: only set "waiting" from "off". Don't downgrade "active"→"waiting" between turns.
    if (this.slotStates[slot] === "off") {
      this.slotStates[slot] = "waiting";
    }
    this.slotLastActivity[slot] = Date.now(); // always refresh TTL
  }

  onThinkingStart(slot: number): void {
    if (slot < 0 || slot > 3) return;
    const wasAnyActive = this.slotStates.some(s => s === "active");
    this.slotStates[slot] = "active";
    this.slotLastActivity[slot] = Date.now();
    // Trigger hirst-in if first active slot
    if (!wasAnyActive && this.hirstPhase === "off") {
      this.hirstPhase = "in";
      this.hirstTransitionStart = Date.now();
      this.hirstColumnOffsets = [0, 0, 0, 0, 0];
    }
  }

  onThinkingEnd(slot: number): void {
    if (slot < 0 || slot > 3) return;
    this.slotStates[slot] = "off";
    this.slotLastActivity[slot] = Date.now();
    // Trigger hirst-out if no more active slots
    const anyActive = this.slotStates.some(s => s === "active");
    if (!anyActive && (this.hirstPhase === "running" || this.hirstPhase === "in")) {
      this.hirstPhase = "out";
      this.hirstTransitionStart = Date.now();
    }
  }

  onPromptEnd(slot: number): void {
    if (slot < 0 || slot > 3) return;
    this.slotStates[slot] = "off";
    this.slotLastActivity[slot] = Date.now();
  }

  /** Get current 75-pixel output as { bottom: string[25], middle: string[25], top: string[25] } */
  getPixels(): { bottom: string[]; middle: string[]; top: string[] } {
    return {
      bottom: this.pixels.slice(0, 25),
      middle: this.pixels.slice(25, 50),
      top: this.pixels.slice(50, 75),
    };
  }

  /** Get current slot states for ESP32 sync */
  getSlotStates(): SlotState[] {
    return [...this.slotStates];
  }

  /** Check if any slot is active (for determining whether to use engine output) */
  isActive(): boolean {
    return this.slotStates.some(s => s !== "off") || this.hirstPhase !== "off";
  }

  // --- Main tick (30fps) ---
  private tick(): void {
    const now = Date.now();
    this.frameTime = now;

    // TTL check — auto-deactivate stale slots
    for (let i = 0; i < 4; i++) {
      if (this.slotStates[i] !== "off" && now - this.slotLastActivity[i] > TTL_MS) {
        this.onThinkingEnd(i);
      }
    }

    // Update hirst state machine
    this.updateHirstPhase(now);

    // Render panels 0+1 (hirst dots)
    this.renderHirst(now);

    // Render panel 2 (slot quadrants)
    this.renderPanel2(now);
  }

  private updateHirstPhase(now: number): void {
    if (this.hirstPhase === "in") {
      const elapsed = now - this.hirstTransitionStart;
      if (elapsed >= 600) {
        this.hirstPhase = "running";
      }
    } else if (this.hirstPhase === "out") {
      const elapsed = now - this.hirstTransitionStart;
      if (elapsed >= 450) {
        this.hirstPhase = "off";
      }
    }
  }

  private renderHirst(now: number): void {
    // Tick all dots
    for (const dot of this.hirstDots) {
      tickHirstDot(dot);
    }

    if (this.hirstPhase === "off") {
      // All black
      for (let i = 0; i < 50; i++) {
        this.pixels[i] = "#000000";
      }
      return;
    }

    if (this.hirstPhase === "running") {
      // Full hirst — all dots visible
      for (let i = 0; i < 50; i++) {
        const dot = this.hirstDots[i];
        this.pixels[i] = rgbToHex(dot.r, dot.g, dot.b);
      }
      return;
    }

    if (this.hirstPhase === "in") {
      // Jagged fire-rise from bottom (600ms)
      const elapsed = now - this.hirstTransitionStart;
      const progress = Math.min(1, elapsed / 600);
      const baseRow = progress * 11;

      // Drift column offsets
      for (let c = 0; c < 5; c++) {
        this.hirstColumnOffsets[c] += (Math.random() - 0.5) * 0.8;
        this.hirstColumnOffsets[c] = Math.max(0, Math.min(2.5, this.hirstColumnOffsets[c]));
      }

      for (let i = 0; i < 50; i++) {
        const panel = Math.floor(i / 25);
        const localIdx = i % 25;
        const localRow = Math.floor(localIdx / 5);
        const col = localIdx % 5;
        const globalRow = panel * 5 + localRow;
        const threshold = baseRow - this.hirstColumnOffsets[col];

        if (globalRow < threshold - 1) {
          const dot = this.hirstDots[i];
          this.pixels[i] = rgbToHex(dot.r, dot.g, dot.b);
        } else if (globalRow < threshold) {
          // Flickery edge — 60% chance
          if (Math.random() < 0.6) {
            const dot = this.hirstDots[i];
            this.pixels[i] = rgbToHex(dot.r, dot.g, dot.b);
          } else {
            this.pixels[i] = "#000000";
          }
        } else {
          this.pixels[i] = "#000000";
        }
      }
      return;
    }

    if (this.hirstPhase === "out") {
      // Wipe going up (450ms)
      const elapsed = now - this.hirstTransitionStart;
      const progress = Math.min(1, elapsed / 450);
      const wipeRow = Math.floor(progress * 10);

      for (let i = 0; i < 50; i++) {
        const panel = Math.floor(i / 25);
        const localIdx = i % 25;
        const localRow = Math.floor(localIdx / 5);
        const globalRow = panel * 5 + localRow;

        if (globalRow >= wipeRow) {
          const dot = this.hirstDots[i];
          this.pixels[i] = rgbToHex(dot.r, dot.g, dot.b);
        } else {
          this.pixels[i] = "#000000";
        }
      }
      return;
    }
  }

  private renderPanel2(now: number): void {
    // Start with all black
    for (let i = 50; i < 75; i++) {
      this.pixels[i] = "#000000";
    }

    // Render each slot's quadrant
    for (let slot = 0; slot < 4; slot++) {
      const state = this.slotStates[slot];
      if (state === "off") continue;

      const pixelIndices = SLOT_PIXELS[slot];

      if (state === "waiting") {
        // Amber pulse
        const pulse = 0.25 + 0.12 * Math.sin(now / 1000 * 2);
        const r = Math.round(Math.min(255, pulse * 255));
        const g = Math.round(Math.min(255, pulse * 0.7 * 255));
        const b = Math.round(Math.min(255, pulse * 0.3 * 255));
        const hex = rgbToHex(r, g, b);
        for (const idx of pixelIndices) {
          this.pixels[50 + idx] = hex;
        }
      } else if (state === "active") {
        // Warm white shimmer
        for (const idx of pixelIndices) {
          const shimmer = this.shimmerPixels[idx];
          tickShimmer(shimmer);
          this.pixels[50 + idx] = shimmerToHex(shimmer.brightness);
        }
      }
    }

    // Claw pixel (center) — disabled per spec, leave black
  }
}
