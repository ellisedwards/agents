# Agent Office Improvements — Design Spec

Future features for agent office.

Current themes: Forest, Golden Ruins, Tropical Island, Lunar Base.

Recent work (2026-03-13):
- Obelisk monolith mode: invisible when idle, lights up on activity, static white overlay, 25% brightness boost
- Per-pixel sand noise for island and desert grounds (no grid tiles)
- Elliptical island shape with asymmetric corners and beachy front shoreline
- Theme-specific obelisk surrounds: worship stones (island), Egyptian ruins (desert)
- Lunar Base theme: black sky, Earth rise, grey regolith, boulders, reactor core, metal-panel poster mount
- Teleport beam effect for agent wander→desk transitions
- Fixed agent disappearing during walks (missing walk sprites — fallback to idle)
- Smooth position lerp and SSE grace period to prevent agent flicker
- Cat poke to wake from sleep
- Removed chairs from island/desert/lunar, clock from forest

Five independent features: C (glass panels), D (smooth time transitions), E (reconnection), F (custom themes), A (agent materialization).

**Status:** A (agent materialization) is partially implemented — teleport beam effect exists for wander→desk transitions. The full arrival materialization (shimmer column for new agents) is not yet built.

## C. Glass Panels Reflect Current Theme Outside

**Current state:** Each theme hardcodes what shows through the glass panels (trees, desert, dunes, sky) via `throughGlass` and three static colors. The through-glass rendering is a separate code path per type.

**Design:** Remove the `throughGlass` enum and the per-type rendering branches. Instead, after drawing the glass panel frame and tint, clip to the panel rect and call a small version of the outdoor scene — sky gradient + background features (mountains/pyramids) + a strip of ground. This means the panels always show what's actually outside, and new themes automatically work without specifying through-glass content.

**Implementation:**
- Add `drawOutdoorMiniature(ctx, x, y, w, h, theme, tod)` that draws a scaled slice of sky + background features + ground into a given rect
- Replace the `if (throughGlass === "trees") ...` branches in `drawBuilding` with a single call to this function, clipped to the panel
- Remove `throughGlass`, `throughColor1/2/3` from `SceneTheme` (breaking change to theme type, but all themes are ours)
- Apply the existing glass tint/reflection overlay on top

**Tradeoff:** Slightly more draw calls per frame (3 panels x miniature scene), but these are tiny rects — negligible at 320x200.

## D. Smooth Day/Night Color Lerping

**Current state:** `getTimeOfDay()` returns a discrete enum. Sky colors and tint snap instantly when the hour boundary crosses. Mode selector also snaps.

**Design:** Introduce a continuous time value and lerp between adjacent time-of-day palettes during transition windows.

**Implementation:**
- Add `getTimeProgress(): { from: TimeOfDay; to: TimeOfDay; t: number }` that returns the current blend state
  - During 6-8am: lerp night→day (t = 0→1 over 2 hours)
  - During 18-20pm: lerp day→night (t = 0→1 over 2 hours)
  - Outside transitions: `t = 1`, `from === to`
- Add `lerpColor(a: string, b: string, t: number): string` utility (hex interpolation)
- In `drawSky`, compute blended sky colors: `lerpColor(fromSky[i], toSky[i], t)`
- In the tint overlay, blend tint color and opacity the same way
- Manual mode selector (Day/Dawn/Night) still snaps — lerping only applies in Auto mode
- Star count fades: multiply star alpha by `(1 - t)` when transitioning away from night

**Tradeoff:** Adds ~3 color lerp calls per frame. The `lerpColor` function parses hex once and caches RGB — no per-frame allocation concerns at 30fps.

## E. Robust OpenClaw Reconnection with Backoff

**Current state:**
- Client SSE: relies on browser EventSource auto-reconnect (no backoff, no heartbeat)
- Server → OpenClaw polling: 2s interval, 1.5s timeout, silent failure marks agent unreachable. No backoff.
- Proxy endpoints (`/api/pixels`, `/api/uptime-kuma`): 2s timeout, returns 502 on failure. No retry.
- **Partial fix in place:** Client-side `setAgents` now merges with a 5s grace period to prevent transient poll gaps from removing agents.

**Design:** Two layers of resilience.

### Server-side: OpenClaw circuit breaker
- Track consecutive failures in `openclaw-watcher.ts`
- After 3 consecutive failures: enter "degraded" state, increase poll interval to 10s
- After 10 consecutive failures: enter "circuit-open" state, poll every 30s
- On any success: reset to normal (2s interval)
- Emit connection health as part of the SSE stream so the client can display it
- Add a new SSE event type `openclaw-status` alongside the existing agent updates

### Client-side: SSE reconnection with backoff
- Replace raw `EventSource` with a wrapper that:
  - Starts with 1s reconnect delay
  - Doubles on each failure, capped at 30s
  - Resets to 1s on successful `onopen`
- Add server heartbeat: server sends a `heartbeat` SSE event every 15s
- Client tracks last heartbeat. If >45s with no events, force reconnect
- Display reconnection state in status bar: "Reconnecting (attempt 3)..." instead of just "Reconnecting..."

### Server-side: proxy resilience
- `/api/pixels` and `/api/uptime-kuma` already fail gracefully (502). No change needed — the client polling handles retries naturally.

**Tradeoff:** More complexity in the SSE hook and openclaw watcher. Worth it — the current silent failures make the app feel broken when openclaw is temporarily down.

## F. User-Created Themes via JSON Drop-in

**Current state:** Themes are TypeScript objects compiled into the bundle. Adding a theme requires code changes and a rebuild.

**Design:** Support loading custom themes from a `themes/` directory in the project root at server startup.

**Implementation:**
- At startup, server scans `themes/*.json` for files matching the `SceneTheme` schema
- Server serves custom themes at `GET /api/themes` as a JSON array
- Client fetches `/api/themes` once on load and merges with built-in `ALL_THEMES`
- Schema validation: validate required fields on load, skip malformed files with a console warning
- Provide a `theme-template.json` in the repo as a starting point (copy of forest theme as JSON)
- The theme selector dropdown shows both built-in and custom themes, with custom themes grouped below a separator

**What we don't need:**
- Hot-reloading themes while running (restart is fine)
- A theme editor UI (JSON is enough for power users)
- Theme sharing/importing from URLs

**Schema:** The existing `SceneTheme` TypeScript interface is the schema. We'll generate a JSON Schema from it (or just validate structurally at load time — check that all required keys exist and values are strings/numbers/arrays of the right shape).

**Tradeoff:** Adds a server endpoint and client fetch. Keeps the theme system open without building a full editor.

## A. Agent Materialization (Arrival Animation)

**Current state:** Agents appear instantly at their desk position when they first show up in the SSE stream. Departure has a poof animation. A teleport beam effect exists for wander→desk transitions (beam-up particles at source, beam-down at desk with fade-in).

**Remaining work:** The full arrival materialization for brand-new agents (shimmer column for first appearance) is not yet built.

**Design:** Star Trek transporter-style materialization — agent fades in with a shimmering column effect.

**Implementation:**
- Track new agent arrivals in `renderer.ts` by comparing current agent IDs to previous frame's IDs
- When a new ID appears, create a `MaterializeState` for that agent:
  ```
  { agentId: string, frame: number, totalFrames: 40 }
  ```
- Render the materializing agent in 3 phases over ~1.3s (40 frames at 30fps):
  - **Phase 1 (frames 0-12):** Shimmering column — vertical lines of sparkles at the agent's position, alternating bright/dim pixels. No agent sprite yet.
  - **Phase 2 (frames 12-30):** Agent sprite fades in with scanline effect — draw the sprite but only render every-other row, expanding to full rows. Sparkles continue but fade.
  - **Phase 3 (frames 30-40):** Full sprite, sparkle residue fades out.
- Color the sparkles using the agent's team color for visual identification before they fully appear
- Store materializing states in a `Map<string, MaterializeState>` alongside the existing `walkStates` map
- During materialization, the agent doesn't walk or bob — held at desk position

**Tradeoff:** Adds a Map and per-frame checks for materializing agents. The sparkle rendering is cheap (~20 pixel draws per materializing agent). Only runs for the ~1.3s duration, then cleaned up.

---

## Implementation Order

1. **E (reconnection)** — fixes real bugs, standalone (partial: grace period done)
2. **D (lerping)** — small, self-contained, immediate visual improvement
3. **C (glass panels)** — removes code, simplifies theme type
4. **F (custom themes)** — depends on C being done (simplified theme type)
5. **A (materialization)** — partially done (teleport beam), arrival shimmer remaining

Each feature is independent except F benefits from C simplifying the theme schema first.
