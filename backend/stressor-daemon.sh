#!/bin/bash
#
# Stressor Daemon
# Autonomous competitive intelligence agent that monitors projects
# and creates PRs for improvements.
#
# Usage: ./stressor-daemon.sh [config-file]
#
# Config file format (JSON):
# {
#   "enabled": true,
#   "projects": ["/path/to/project1", "/path/to/project2"],
#   "intervalMinHours": 4,
#   "intervalMaxHours": 8
# }

set -e

CONFIG_FILE="${1:-/repos/.stressor/config.json}"
PID_FILE="/repos/.stressor/daemon.pid"
LOG_FILE="/repos/.stressor/daemon.log"

# Ensure directories exist
mkdir -p "$(dirname "$CONFIG_FILE")"
mkdir -p "$(dirname "$PID_FILE")"
mkdir -p "$(dirname "$LOG_FILE")"

log() {
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

# Check if another instance is running
if [ -f "$PID_FILE" ]; then
  OLD_PID=$(cat "$PID_FILE")
  if kill -0 "$OLD_PID" 2>/dev/null; then
    log "ERROR: Daemon already running with PID $OLD_PID"
    exit 1
  fi
fi

# Write our PID
echo $$ > "$PID_FILE"

# Cleanup on exit
cleanup() {
  log "Daemon shutting down..."
  rm -f "$PID_FILE"
  exit 0
}
trap cleanup SIGTERM SIGINT

log "Stressor daemon starting (PID: $$)"

# Main loop
while true; do
  # Check if config exists
  if [ ! -f "$CONFIG_FILE" ]; then
    log "No config file at $CONFIG_FILE, sleeping 1 hour..."
    sleep 3600
    continue
  fi

  # Read config
  ENABLED=$(jq -r '.enabled // true' "$CONFIG_FILE")

  if [ "$ENABLED" != "true" ]; then
    log "Stressor disabled, sleeping 1 hour..."
    sleep 3600
    continue
  fi

  # Get projects array
  PROJECTS=$(jq -r '.projects // [] | .[]' "$CONFIG_FILE")
  PROJECT_COUNT=$(echo "$PROJECTS" | grep -c . || echo 0)

  if [ "$PROJECT_COUNT" -eq 0 ]; then
    log "No projects configured, sleeping 1 hour..."
    sleep 3600
    continue
  fi

  # Pick random project
  RANDOM_INDEX=$((RANDOM % PROJECT_COUNT))
  PROJECT=$(echo "$PROJECTS" | sed -n "$((RANDOM_INDEX + 1))p")

  log "Selected project: $PROJECT"

  # Check if project directory exists
  if [ ! -d "$PROJECT" ]; then
    log "WARNING: Project directory not found: $PROJECT"
  else
    # Run stressor
    log "Running @stressor scan..."
    cd "$PROJECT"

    # Run claude with stressor prompt
    if claude -p "@stressor" --yes 2>&1 | tee -a "$LOG_FILE"; then
      log "Stressor scan completed successfully"
    else
      log "WARNING: Stressor scan failed (exit code: $?)"
    fi
  fi

  # Calculate sleep interval (random between min and max hours)
  MIN_HOURS=$(jq -r '.intervalMinHours // 4' "$CONFIG_FILE")
  MAX_HOURS=$(jq -r '.intervalMaxHours // 8' "$CONFIG_FILE")
  RANGE=$((MAX_HOURS - MIN_HOURS))
  SLEEP_HOURS=$((MIN_HOURS + RANDOM % (RANGE + 1)))
  SLEEP_SECONDS=$((SLEEP_HOURS * 3600))

  log "Next scan in ${SLEEP_HOURS} hours..."
  sleep "$SLEEP_SECONDS"
done
