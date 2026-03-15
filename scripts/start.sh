#!/bin/bash
APP_DIR="/Users/ellisedwards/Code/workspace/agentoffice"
PORT=4747
LOG="/tmp/agent-office.log"
PIDFILE="/tmp/agent-office.pid"
LOCKFILE="/tmp/agent-office.lock"

# Ensure node/npm are on PATH — cover homebrew, nvm, and common locations
export PATH="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:$PATH"
# Source nvm if present (common node installer)
[ -s "$HOME/.nvm/nvm.sh" ] && source "$HOME/.nvm/nvm.sh" 2>/dev/null
# Fallback: source zshrc with timeout to catch anything else, but don't hang
if command -v node >/dev/null 2>&1; then
  : # node found, skip zshrc
else
  timeout 5 bash -c 'source "$HOME/.zshrc" 2>/dev/null' || true
fi

# Prevent concurrent launches (macOS-compatible using mkdir as atomic lock)
# Clean up any non-directory lockfile left by previous script versions
[ -f "$LOCKFILE" ] && rm -f "$LOCKFILE"
if ! mkdir "$LOCKFILE" 2>/dev/null; then
  # Check if lock is stale (older than 2 minutes)
  if find "$LOCKFILE" -maxdepth 0 -mmin +2 2>/dev/null | grep -q .; then
    rm -rf "$LOCKFILE"
    mkdir "$LOCKFILE" 2>/dev/null || true
  else
    osascript -e 'display alert "Agent Office" message "Another launch is already in progress."'
    exit 1
  fi
fi
trap 'rm -rf "$LOCKFILE"' EXIT

# Kill previous server — saved PID first
if [ -f "$PIDFILE" ]; then
  kill -9 "$(cat "$PIDFILE")" 2>/dev/null || true
  rm -f "$PIDFILE"
fi
# Kill ANY node process on our port — catches manual starts, orphans
for PID in $(lsof -ti tcp:$PORT 2>/dev/null); do
  if ps -p "$PID" -o comm= 2>/dev/null | grep -q node; then
    kill -9 "$PID" 2>/dev/null || true
  fi
done
# Wait for port to actually free up
for i in $(seq 1 10); do
  lsof -ti tcp:$PORT 2>/dev/null | while read PID; do
    ps -p "$PID" -o comm= 2>/dev/null | grep -q node && exit 1
  done && break
  sleep 0.5
done

cd "$APP_DIR"
echo "=== Build started $(date) ===" > "$LOG"

# Build MUST succeed or we abort
if ! npm run build >> "$LOG" 2>&1; then
  echo "=== BUILD FAILED ===" >> "$LOG"
  osascript -e 'display alert "Agent Office" message "Build failed. Check /tmp/agent-office.log"'
  exit 1
fi

echo "=== Server starting ===" >> "$LOG"
nohup node dist/server.js >> "$LOG" 2>&1 &
SERVER_PID=$!
echo "$SERVER_PID" > "$PIDFILE"

# Wait for server to be ready (up to 5 seconds)
READY=0
for i in $(seq 1 20); do
  if ! kill -0 $SERVER_PID 2>/dev/null; then
    echo "=== SERVER CRASHED ===" >> "$LOG"
    osascript -e 'display alert "Agent Office" message "Server crashed on startup. Check /tmp/agent-office.log"'
    rm -f "$PIDFILE"
    exit 1
  fi
  if curl -s "http://localhost:$PORT/api/build-id" > /dev/null 2>&1; then
    READY=1
    break
  fi
  sleep 0.25
done

if [ $READY -eq 0 ]; then
  osascript -e 'display alert "Agent Office" message "Server did not start in time. Check /tmp/agent-office.log"'
  kill -9 $SERVER_PID 2>/dev/null || true
  rm -f "$PIDFILE"
  exit 1
fi

open -a "Google Chrome" "http://localhost:$PORT?t=$(date +%s)"
