#!/bin/bash
APP_DIR="/Users/ellisedwards/Code/workspace/agent-office"
PORT=4747
PID_FILE="/tmp/.agent-office.pid"

# Kill existing instance if running
if [ -f "$PID_FILE" ]; then
  kill "$(cat "$PID_FILE")" 2>/dev/null
  rm -f "$PID_FILE"
fi

cd "$APP_DIR"
node dist/server.js &
echo $! > "$PID_FILE"

# Wait for server to be ready
for i in $(seq 1 20); do
  curl -s "http://localhost:$PORT" > /dev/null 2>&1 && break
  sleep 0.25
done

open -a "Google Chrome" "http://localhost:$PORT"

# Keep app alive, clean up on quit
trap 'kill "$(cat "$PID_FILE")" 2>/dev/null; rm -f "$PID_FILE"' EXIT
wait
