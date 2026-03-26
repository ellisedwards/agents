# Future: SSE Push Architecture (Approach C)

**Status:** Planned (not yet started)
**Depends on:** Approach B (claw cache) — must be complete first

## Overview

Replace all frontend polling with Server-Sent Events (SSE). The server-side
cache from Approach B becomes the data source — instead of the frontend polling
the cache at 100ms, the server pushes updates whenever the cache refreshes.

## Design

### New SSE endpoint: `/api/pixels-stream`

- Pushes pixel data whenever `clawCache.tower1` updates (~1Hz from claw poll)
- In AWAY mode, pushes tower engine output at same rate
- Frontend `use-pixel-tower.ts` replaces fetch loop with EventSource
- Canvas renderer reads from the SSE-updated global, same as today

### New SSE endpoint: `/api/tower2-stream`

- Pushes tower2 pixel data on cache refresh
- Replaces `use-tower2.ts` fetch loop

### Existing SSE: `/api/agents`

- Already SSE — no changes needed

### Frontend changes

- `use-pixel-tower.ts`: Replace `fetch` loop with `EventSource("/api/pixels-stream")`
  - Keep `_latestData` global for canvas renderer
  - Keep `REACT_UPDATE_INTERVAL` throttle for React state updates
  - Reconnect on SSE close with backoff

- `use-tower2.ts`: Same pattern — EventSource replaces fetch loop

- `use-claw-health.ts`: Can stay polling at 5s — low frequency, not worth SSE

### Push throttle

Server should debounce pushes to max ~10Hz to avoid overwhelming slow clients.
Since the cache refreshes at 1Hz, this is naturally bounded. If we later increase
cache refresh rate, add explicit throttle.

### Error handling

- SSE disconnect: client reconnects with 1s delay (EventSource default)
- Server restart: client reconnects automatically
- No data loss concern — pixels are stateless (latest wins)

## Benefits over Approach B

- Zero frontend polling for high-frequency data
- Instant propagation (push vs poll latency)
- Lower CPU on client (no fetch/parse loop)
- Foundation for future real-time features

## Migration

Can be done incrementally — add SSE endpoints, then switch frontend hooks
one at a time. Approach B's cache and polling continue to work as fallback.
