# Tower 1 Local Animation Engine — Spec from Claw

Build a standalone JS/TS module in Agent Office that replicates Tower 1 behavior 1:1. No tower server calls when mobile. Hook events from cc-http-server polling drive the local state machine instead of reading /pixels.

Reference implementation: `~/clawd/scripts/claw-tower2-server.py` (1612 lines)

---

## Part 1: Layout & Pixel Map

75-pixel grid: 3 stacked 5x5 panels. Panel 0=bottom, 1=middle, 2=top.
Index 0 = bottom-left of panel 0. Index 74 = top-right of panel 2.

Agent slot pixels (panel 2, indices relative to panel):
- Slot 0 (top-left):     [20, 21, 15, 16]  // rows 3-4, cols 0-1
- Slot 1 (top-right):    [23, 24, 18, 19]  // rows 3-4, cols 3-4
- Slot 2 (bottom-left):  [0, 1, 5, 6]      // rows 0-1, cols 0-1
- Slot 3 (bottom-right): [3, 4, 8, 9]      // rows 0-1, cols 3-4

Claw status pixel: 12 (center of panel 2 5x5 grid)
Claw center row: [10, 11, 12, 13, 14]

Slot states: off → waiting (amber pulse) → active (warm white shimmer)
Hirst dots: panels 0+1 (indices 0-49)

---

## Part 2: Hirst Color Generation

```typescript
function randomHirstColor() {
  const roll = Math.random();
  const h = Math.random();
  let s, v;
  if (roll < 0.2) {
    // 20% chance: full saturation, full brightness
    s = 1.0; v = 1.0;
  } else if (roll < 0.45) {
    // 25% chance: muted dim
    s = Math.random() * 0.5 + 0.3;
    v = (Math.random() * 0.4 + 0.15) * 0.25;
  } else {
    // 55% chance: muted normal
    s = Math.random() * 0.5 + 0.3;
    v = Math.random() * 0.4 + 0.15;
  }
  return hsvToRgb(h, s, v);
}
```

Hirst dot state (panels 0+1, 50 pixels):
Each pixel has: `{ color, countdown, intervalRange }`
- Base interval = 0.5 * FPS (so 15 frames at 30fps)
- intervalRange = [base*0.5, base*1.5] = [7, 22]
- Init countdown = random 1 to base*2

On each frame: countdown--. When 0: new random color, new random countdown from intervalRange.

---

## Part 3: Hirst Transitions

**HIRST-IN (600ms):** Jagged fire-rise from bottom.
- 5 column offsets, each drifts randomly: `offset += (random-0.5)*0.8`, clamped [0, 2.5]
- progress = elapsed_ms / 600, base_row = progress * 11
- For each pixel: globalRow = panel*5 + localRow
  - threshold = base_row - colOffset[col]
  - if globalRow < threshold-1: full hirst color (twinkling)
  - if globalRow < threshold: 60% chance show color (flickery edge)
  - else: black

**HIRST-OUT (450ms):** Wipe going up.
- progress = elapsed_ms / 450, wipeRow = floor(progress * 10)
- For each pixel:
  - if globalRow >= wipeRow: still twinkling
  - else: black

State machine: off → in → running → out → off
- Trigger in: any slot becomes active
- Trigger out: no slots active

---

## Part 4: Panel 2 (Quadrants + Claw Pixel)

**SHIMMER (active slots):** Per-pixel state `{ brightness, target, countdown }`
- BASE = 0.20 (never below this)
- Each frame: `brightness += (target - brightness) * 0.22`
- When countdown hits 0:
  - 35% chance: target = random*0.45 + BASE+0.12 (bright pop)
  - 65% chance: target = random*0.12 + BASE (hover near base)
  - new countdown = random 4-14 frames
- Color: warm white — r=val, g=val*0.95, b=val*0.88

**WAITING (amber pulse):**
- pulse = 0.25 + 0.12 * sin(time * 2)
- r=val, g=val*0.7, b=val*0.3

**CLAW PIXEL (center, index 12 of panel 2):**
- thinking: purple (160, 0, 255) with breathing pulse
- typing: amber (255, 170, 51)
- done: gold flash (255, 170, 51)
- Breathing: 0.75 + 0.25 * sin(phase), phase += 0.12/frame
- Fade in: brightness += 0.08/frame (cap 1.0)
- Fade out: brightness -= 0.08/frame (cap 0.0)
- NOTE: currently disabled in production (_claw_disabled=True)

---

## Part 5: Scene Overrides + Sparkle + Hooks

**CHECKMARK SCENE:** Draw green check icon on panel 1 (middle). Hold 2s, then fade out over 0.5s. Brightness = max(0, 1-(elapsed-2)*2).

**SLOT SPARKLE:** When a slot completes, chaotic burst. Each pixel gets random color from a palette every frame for 1.5s.

**HOOK → STATE MAPPING:**
- prompt-start → slot=waiting
- thinking-start → slot=active (triggers hirst-in if first active)
- thinking-end → slot=off (triggers hirst-out if last active)
- slot-heartbeat → refresh TTL timer
- task-done → green checkmark flash
- claw-status → update center pixel

**RENDER LOOP:** 30fps. Single requestAnimationFrame loop.
1. Update hirst state machine (in/running/out/off)
2. Render panels 0+1 based on hirst state
3. Render panel 2 (shimmer/waiting/claw pixel)
4. Output 75 colors

**TTL:** 45s. If slot has no heartbeat in 45s, auto-deactivate.

---

## Integration

Build as a standalone module. Hook events come from existing cc-http-server polling — use the hook data to drive the local state machine instead of reading /pixels. When claw/tower is reachable, use real tower data. When unreachable, this engine provides identical animations locally.

Output: 75 hex color strings (same format as /pixels panels), updated at 30fps. Serve via the existing /api/pixels and /api/esp32-status endpoints.
