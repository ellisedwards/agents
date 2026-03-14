# Lunar Base Theme Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a "Lunar Base" theme — Apollo-realism style moon surface with Earth rise, reactor core, boulders, and the 2001 monolith.

**Architecture:** New theme file + type/store registration + 4 new rendering variants in environment.ts (boulders, reactor, metal-panel poster mount, Earth in sky) + optional obelisk footprints in renderer.ts.

**Tech Stack:** TypeScript, Canvas 2D API, Zustand store

**Spec:** `docs/superpowers/specs/2026-03-13-lunar-base-theme-design.md`

---

## Task 1: Theme file and registration

Create the theme config and wire it into the app.

**Files:**
- Create: `src/components/scene/themes/lunar-base.ts`
- Modify: `src/components/scene/themes/index.ts`
- Modify: `src/components/scene/themes/types.ts`
- Modify: `src/components/store.ts`

- [ ] **Step 1: Add new type values**

In `src/components/scene/themes/types.ts`, add `"boulders"` to the vegetation type union (line 52):
```typescript
type: "trees" | "palms" | "cacti" | "mixed-desert" | "boulders";
```

Add `"reactor"` to fire vessel style union (line 87):
```typescript
style: "fireplace" | "brazier" | "fire-pit" | "reactor";
```

Add `"metal-panel"` to poster mount style union (line 104):
```typescript
style: "wall" | "stone-tablet" | "wooden-sign" | "driftwood" | "metal-panel";
```

- [ ] **Step 2: Create lunar-base.ts**

Create `src/components/scene/themes/lunar-base.ts` with the full theme config. All color values come from the spec. Key points:
- `id: "lunar-base"`, `name: "Lunar Base"`
- Sky colors are near-black (moon has no atmosphere)
- `drawStarsAtNight: true`, `starCount: 24`
- `backgroundFeatures: []` (flat horizon)
- `ground.tileSize: 1` (per-pixel noise)
- `building.style: "none"` (open surface)
- `fireVessel.style: "reactor"`
- `posterMount.style: "metal-panel"`
- `glassPanel: null`, `hasGuitar: false`, `clock: null`, `plant: null`
- `desk.hideChairs: true`

```typescript
import type { SceneTheme } from "./types";

export const lunarBaseTheme: SceneTheme = {
  id: "lunar-base",
  name: "Lunar Base",

  timeTints: {
    day: { color: "", opacity: 0, skyColors: ["#080810", "#0a0a14", "#0c0c18"] },
    dawn: { color: "#2244aa", opacity: 0.08, skyColors: ["#0a1020", "#101828", "#182030"] },
    night: { color: "#000008", opacity: 0.3, skyColors: ["#040408", "#06060c", "#080810"] },
  },

  drawStarsAtNight: true,
  starCount: 24,

  backgroundFeatures: [],

  ground: {
    baseColor1: "#606068",
    baseColor2: "#585860",
    tileSize: 1,
    decorColor: "#505058",
    decorCount: 40,
    decorHeight: 1,
  },

  vegetation: {
    type: "boulders",
    colors: {
      trunk: "#505058",
      trunkLight: "#606068",
      leaf1: "#404048",
      leaf2: "#484850",
      leaf3: "#585860",
      leaf4: "#606068",
    },
    density: 0.6,
  },

  building: {
    wallColor: "#505058",
    wallDark: "#404048",
    wallAccent: "#585860",
    floorColor1: "#606068",
    floorColor2: "#585860",
    floorEdge1: "#505058",
    floorEdge2: "#484850",
    style: "none",
  },

  fireVessel: {
    stoneColor: "#404048",
    stoneBrick: "#484850",
    stoneLight: "#505058",
    stoneDark: "#303038",
    interiorColor: "#22aacc",
    interiorDeep: "#1188aa",
    mantleColor: "#383840",
    mantleLight: "#484850",
    style: "reactor",
  },

  glassPanel: null,

  posterMount: {
    style: "metal-panel",
    color: "#505058",
    colorLight: "#606068",
    colorDark: "#383840",
  },

  hasGuitar: false,
  clock: null,
  plant: null,

  desk: {
    topColor: "#505058",
    legColor: "#383840",
    chairBack: "#404048",
    chairSeat: "#383840",
    chairLight: "#484850",
    hideChairs: true,
  },
};
```

- [ ] **Step 3: Register in index.ts**

In `src/components/scene/themes/index.ts`, add import and include in `ALL_THEMES`:
```typescript
import { lunarBaseTheme } from "./lunar-base";
// Add to ALL_THEMES array and exports
```

- [ ] **Step 4: Register in store.ts**

In `src/components/store.ts`:
- Add `"lunar-base"` to the `ThemeId` type union (line 13)
- Add `"lunar-base"` to the `VALID_THEMES` array (line 42)

- [ ] **Step 5: Build and verify**

Run `npm run build`. It should compile but the new renderer variants (boulders, reactor, metal-panel, Earth) won't render yet — the theme will load but fall through to default drawing paths.

- [ ] **Step 6: Commit**

```bash
git add src/components/scene/themes/lunar-base.ts src/components/scene/themes/index.ts src/components/scene/themes/types.ts src/components/store.ts
git commit -m "feat: add Lunar Base theme config and registration"
```

---

## Task 2: Boulders vegetation type

**Files:**
- Modify: `src/components/scene/environment.ts`

- [ ] **Step 1: Add drawBoulder function**

Add a `drawBoulder` function near the existing `drawCactus` function (~line 399). Follow the same signature pattern: `(ctx, x, gy, variant, theme)`.

Three variants using `variant % 3`:
- **v=0**: Large angular boulder — 6px wide, 5px tall. Body uses `trunk`, top edge uses `trunkLight`, shadow base uses `leaf1`.
- **v=1**: Medium rounded rock — 4px wide, 3px tall. Body `trunk`, highlight `trunkLight`.
- **v=2**: Small pebble cluster — two 2x2 squares offset. Uses `leaf2` and `trunk`.

```typescript
function drawBoulder(ctx: CanvasRenderingContext2D, x: number, gy: number, variant: number, theme: SceneTheme) {
  const c = theme.vegetation.colors;
  const v = variant % 3;
  if (v === 0) {
    // Large angular boulder
    rect(ctx, x - 3, gy - 5, 6, 5, c.trunk);
    rect(ctx, x - 2, gy - 5, 5, 1, c.trunkLight);
    rect(ctx, x - 3, gy - 1, 6, 1, c.leaf1);
    rect(ctx, x - 2, gy - 4, 4, 3, c.trunk);
  } else if (v === 1) {
    // Medium rounded rock
    rect(ctx, x - 2, gy - 3, 4, 3, c.trunk);
    rect(ctx, x - 1, gy - 3, 3, 1, c.trunkLight);
  } else {
    // Small pebble cluster
    rect(ctx, x - 1, gy - 2, 2, 2, c.trunk);
    rect(ctx, x + 2, gy - 1, 2, 1, c.leaf2);
  }
}
```

- [ ] **Step 2: Wire into vegetation dispatch**

In the vegetation drawing section (~line 435-454), add a case for `"boulders"`:
```typescript
if (variant % 2 === 0) drawBoulder(ctx, x, gy, variant, theme);
// variant % 2 === 1: skip (empty space — boulders are sparse)
```

- [ ] **Step 3: Build and verify visually**

Run `npm run build`, restart server, switch to Lunar Base. Boulders should appear around the edges.

- [ ] **Step 4: Commit**

```bash
git add src/components/scene/environment.ts
git commit -m "feat: add boulders vegetation type for lunar theme"
```

---

## Task 3: Reactor fire vessel

**Files:**
- Modify: `src/components/scene/environment.ts`

- [ ] **Step 1: Add reactor case to fire vessel renderer**

In the `drawFireVessel` function (~line 516-572), add an `else if (fv.style === "reactor")` branch before the final `else`.

The reactor is a metallic rectangular housing with a cyan energy cell:
- Outer housing: `fv.stoneDark` base, `fv.stoneColor` body, `fv.stoneLight` top highlight
- Inner cell area: `fv.interiorColor` (`#22aacc`) with pulse using the frame counter
- Top vent strip: `fv.mantleColor`
- Wider than fireplace (~14px wide, 10px tall)

Use the existing `frame` parameter for the cyan glow pulse (same sin wave pattern as fire flicker).

- [ ] **Step 2: Build and verify**

Switch to Lunar Base, check the upper-left area where fire normally goes. Should see a grey metallic box with pulsing cyan glow.

- [ ] **Step 3: Commit**

```bash
git add src/components/scene/environment.ts
git commit -m "feat: add reactor fire vessel style for lunar theme"
```

---

## Task 4: Metal panel poster mount

**Files:**
- Modify: `src/components/scene/renderer.ts`

- [ ] **Step 1: Add metal-panel case to renderStatusPoster**

In `renderStatusPoster` (~line 90-160), add an `else if (mount.style === "metal-panel")` branch:
- Thin vertical post: `mount.colorDark`, 2px wide, extends below the panel
- Metal plate: `mount.color` body, `mount.colorLight` top edge highlight
- Small bolt dots at corners: `mount.colorDark`

- [ ] **Step 2: Build and verify**

Status poster should appear on a metal post/plate in the lunar theme.

- [ ] **Step 3: Commit**

```bash
git add src/components/scene/renderer.ts
git commit -m "feat: add metal-panel poster mount style"
```

---

## Task 5: Earth in sky

**Files:**
- Modify: `src/components/scene/environment.ts`

- [ ] **Step 1: Add Earth rendering to drawSky**

At the end of `drawSky` (~line 53-65), after drawing the sky gradient and before stars, add a conditional Earth render for the lunar theme:

```typescript
// Earth rise — only for lunar-base theme
if (theme.id === "lunar-base") {
  const ex = W - 60;  // upper-right area
  const ey = 8;
  // Glow
  ctx.fillStyle = "#4488cc";
  ctx.globalAlpha = 0.15;
  ctx.fillRect(ex - 2, ey - 2, 10, 10);
  ctx.globalAlpha = 1;
  // Earth body
  ctx.fillStyle = "#226644";
  ctx.fillRect(ex, ey, 6, 6);
  ctx.fillStyle = "#4488cc";
  ctx.fillRect(ex, ey, 6, 3);  // ocean top half
  ctx.fillStyle = "#338855";
  ctx.fillRect(ex + 1, ey + 2, 2, 2);  // land mass
  ctx.fillRect(ex + 4, ey + 3, 1, 2);
  // White polar cap
  ctx.fillStyle = "#ccddee";
  ctx.fillRect(ex + 1, ey, 4, 1);
}
```

Pixel art Earth: ~6x6px, blue-green with a hint of white at top. Positioned upper-right sky area.

- [ ] **Step 2: Always draw stars for lunar theme**

In the star drawing section of `drawSky`, ensure stars render in ALL time periods for lunar-base (not just night). The moon has no atmosphere — stars are always visible.

Check if `drawStarsAtNight` controls this. If stars only draw at night, add a condition: also draw stars when `theme.id === "lunar-base"` regardless of time.

- [ ] **Step 3: Build and verify**

Earth should be visible in upper sky area. Stars should show in all time modes.

- [ ] **Step 4: Commit**

```bash
git add src/components/scene/environment.ts
git commit -m "feat: add Earth rise and always-visible stars for lunar theme"
```

---

## Task 6: Obelisk footprints (optional)

**Files:**
- Modify: `src/components/scene/renderer.ts`

- [ ] **Step 1: Add footprints around obelisk base**

In `drawObelisk` in `renderer.ts`, after the theme-specific decoration blocks (tropical island stones, golden ruins blocks), add a lunar-base block:

```typescript
if (theme.id === "lunar-base") {
  const baseY = oy + slabH;
  const baseCX = cx;
  // Footprint trail approaching from the right
  ctx.fillStyle = "#505058";
  const prints = [
    { dx: 18, dy: 6 }, { dx: 16, dy: 5 },
    { dx: 13, dy: 4 }, { dx: 11, dy: 3 },
    { dx: 8, dy: 3 }, { dx: 6, dy: 2 },
  ];
  for (const p of prints) {
    ctx.fillRect(baseCX + p.dx, baseY + p.dy, 2, 1);
    ctx.fillRect(baseCX + p.dx + 1, baseY + p.dy + 1, 2, 1);
  }
}
```

Small pairs of darker pixels in a trail from the right side toward the base.

- [ ] **Step 2: Build and verify**

Subtle footprints in the dust approaching the monolith.

- [ ] **Step 3: Commit**

```bash
git add src/components/scene/renderer.ts
git commit -m "feat: add footprints around lunar obelisk"
```

---

## Task 7: Final build, test all time modes, push

- [ ] **Step 1: Full rebuild and restart**

```bash
npm run build
# restart server
```

- [ ] **Step 2: Visual verification**

Switch to Lunar Base theme and verify:
- Grey regolith ground with per-pixel noise
- Black sky with Earth visible
- Stars in all time modes (day/dawn/night)
- Boulders around the edges (no trees/plants)
- Reactor core with cyan glow (upper-left)
- Metal panel poster mount with status dots
- Desks with no chairs
- Obelisk as monolith with footprints
- Dawn: subtle blue tint
- Night: darker overlay, stars still visible

- [ ] **Step 3: Push**

```bash
git push
```
