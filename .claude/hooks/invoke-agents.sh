#!/bin/bash
# Utility: Check for trigger signals and report which agents should be invoked

set -e

signals_dir="/tmp/claude-agent-signals"

# Array to store triggered agents
triggered_agents=()

# Check for strategic advisor trigger (Socratic dialogue)
if [ -f "$signals_dir/strat-trigger" ]; then
  triggered_agents+=("strat")
fi

# Check for patrol trigger (codebase auditing)
if [ -f "$signals_dir/patrol-trigger" ]; then
  mode="full"
  if [ -f "$signals_dir/patrol-mode" ]; then
    mode=$(cat "$signals_dir/patrol-mode")
  fi
  triggered_agents+=("patrol:$mode")
fi

# Check for pipeline trigger (full dev workflow)
if [ -f "$signals_dir/pipeline-trigger" ]; then
  triggered_agents+=("pipe")
fi

# Check for push-readiness trigger
if [ -f "$signals_dir/push-readiness-trigger" ]; then
  triggered_agents+=("pushy")
fi

# Check for speed-read trigger
if [ -f "$signals_dir/speed-trigger" ]; then
  triggered_agents+=("speedy")
fi

# Output triggered agents as JSON for easy parsing
if [ ${#triggered_agents[@]} -gt 0 ]; then
  printf '%s\n' "${triggered_agents[@]}" | jq -R . | jq -s .
else
  echo "[]"
fi
