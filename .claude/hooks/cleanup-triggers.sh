#!/bin/bash
# Hook: Cleanup trigger signals after Claude has processed them
# This hook runs on SessionEnd to clean up signal files

set -e

signals_dir="/tmp/claude-agent-signals"

if [ -d "$signals_dir" ]; then
  rm -rf "$signals_dir"
  echo "Cleaned up agent signal files" >&2
fi

exit 0
