#!/bin/bash
# Hook: Detect agent trigger phrases in user prompts
# Agents only trigger when explicitly mentioned with @agent syntax

set -e

# Read input from stdin (hook context)
input=$(cat)

# Extract the user prompt
prompt=$(echo "$input" | jq -r '.prompt // empty')

if [ -z "$prompt" ]; then
  exit 0
fi

# Create signals directory
signals_dir="/tmp/claude-agent-signals"
mkdir -p "$signals_dir"

# Strategic advisor trigger - @strat for Socratic dialogue
if echo "$prompt" | grep -iE "@strat" > /dev/null; then
  echo "$(date)" > "$signals_dir/strat-trigger"
  echo "✓ Strategic advisor trigger detected (@strat)" >&2
fi

# Patrol trigger - @patrol for codebase auditing
if echo "$prompt" | grep -iE "@patrol" > /dev/null; then
  echo "$(date)" > "$signals_dir/patrol-trigger"
  # Extract mode: quick, or specific area
  if echo "$prompt" | grep -iE "@patrol\s+quick" > /dev/null; then
    echo "quick" > "$signals_dir/patrol-mode"
  elif echo "$prompt" | grep -iE "@patrol\s+(frontend|api|tests|models|config|deps)" > /dev/null; then
    area=$(echo "$prompt" | grep -oiE "@patrol\s+(frontend|api|tests|models|config|deps)" | awk '{print $2}' | tr '[:upper:]' '[:lower:]')
    echo "$area" > "$signals_dir/patrol-mode"
  else
    echo "full" > "$signals_dir/patrol-mode"
  fi
  echo "✓ Patrol trigger detected (@patrol)" >&2
fi

# Pipeline trigger - only when @pipe is explicitly mentioned
if echo "$prompt" | grep -iE "@pipe" > /dev/null; then
  echo "$(date)" > "$signals_dir/pipeline-trigger"
  echo "✓ Pipeline trigger detected (@pipe)" >&2
fi

# Push-readiness triggers - @pushy or natural phrases
if echo "$prompt" | grep -iE "(@pushy|ready to push|can i push|ready for review)" > /dev/null; then
  echo "$(date)" > "$signals_dir/push-readiness-trigger"
  echo "✓ Push-readiness trigger detected" >&2
fi

# Speed-read triggers - @speedy or natural phrases
if echo "$prompt" | grep -iE "(@speedy|speed read|read.*fast|bionic)" > /dev/null; then
  echo "$(date)" > "$signals_dir/speed-trigger"
  echo "✓ Speed-read trigger detected" >&2
fi

exit 0
