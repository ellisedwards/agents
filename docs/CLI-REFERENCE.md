# CLI Reference

## npm scripts

| Command | What it does |
|---|---|
| `npm run dev` | Dev mode — Vite hot-reload + tsx server watch. **Best for development.** |
| `npm run build` | Production build (Vite client + esbuild server -> `dist/`) |
| `npm run start` | Build + start server |
| `npm run restart` | Kill port 4747, rebuild, start fresh |
| `npm run install-app` | Copy `.app` bundle to `/Applications/` |

## API endpoints (localhost:4747)

### Agents

| Endpoint | Description |
|---|---|
| `GET /api/agents` | SSE stream of real-time agent state |
| `POST /api/agents/clear` | Remove all idle/stale agents |
| `POST /api/kill-agent` `{agentId}` | Remove a specific agent |
| `POST /api/rename-agent` `{agentId, name}` | Rename an agent |

### Game mode

| Endpoint | Description |
|---|---|
| `GET /api/game-mode` | Check if game mode is enabled |
| `POST /api/game-mode` `{enabled: bool}` | Toggle game mode |
| `POST /api/lucky-multiplier` `{agentId, multiplier, uses}` | Set lucky EXP multiplier |
| `POST /api/game-kill` | Kill game — wipe all EXP, levels, names, achievements |

### Claw / hardware

| Endpoint | Description |
|---|---|
| `POST /api/sparkle` `{slot: 0-3}` | Trigger level-up sparkle on LED |
| `POST /api/light-test` `{slot, action}` | Test claw lights. Actions: `sparkle`, `thinking`, `thinking-stop`, `active`, `active-stop`, `off` |
| `GET /api/brightness` | Get current LED brightness |
| `GET /api/brightness/:level` | Set brightness (0-100) |
| `GET /api/claw-health` | Claw connection diagnostics |
| `GET /api/pixels` | Get pixel tower matrix data |
| `POST /api/tower-reset` | Reset pixel tower |

### Other

| Endpoint | Description |
|---|---|
| `GET /api/build-id` | Current build hash (used by `.app` fast path) |
| `GET /api/relay` | Fetch relay messages |
| `GET /api/uptime-kuma` | Uptime Kuma monitoring status |
| `POST /api/ai/pixel-clean` | AI pixel cleanup (large payload) |
| `POST /api/save-sprite` | Save sprite data from editor |

## Quick curl examples

```bash
# Check what's running
curl -s localhost:4747/api/claw-health | python3 -m json.tool

# Clear phantom agents
curl -X POST localhost:4747/api/agents/clear

# Kill specific agent
curl -X POST localhost:4747/api/kill-agent \
  -H 'Content-Type: application/json' \
  -d '{"agentId":"..."}'

# Test claw sparkle on slot 0
curl -X POST localhost:4747/api/light-test \
  -H 'Content-Type: application/json' \
  -d '{"slot":0,"action":"sparkle"}'

# Set brightness
curl localhost:4747/api/brightness/50

# Toggle game mode
curl -X POST localhost:4747/api/game-mode \
  -H 'Content-Type: application/json' \
  -d '{"enabled":true}'

# Set lucky multiplier manually
curl -X POST localhost:4747/api/lucky-multiplier \
  -H 'Content-Type: application/json' \
  -d '{"agentId":"...","multiplier":10,"uses":10}'
```
