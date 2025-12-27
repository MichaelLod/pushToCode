#!/bin/sh

CLAUDE_DIR="/root/.claude"

# Build settings repo URL with token if available
if [ -n "$GITHUB_TOKEN" ]; then
  SETTINGS_REPO="https://${GITHUB_TOKEN}@github.com/MichaelLod/claude-settings.git"
else
  SETTINGS_REPO="${CLAUDE_SETTINGS_REPO:-https://github.com/MichaelLod/claude-settings.git}"
fi

echo "=== Claude Code Backend Startup ==="

# Clone or update Claude settings (optional - don't fail if private repo)
if [ -d "$CLAUDE_DIR/settings-repo" ]; then
  echo "Updating Claude settings..."
  cd "$CLAUDE_DIR/settings-repo" && git pull --quiet 2>/dev/null || echo "Could not update settings (may be offline)"
  cd /app
else
  echo "Cloning Claude settings..."
  if git clone --quiet "$SETTINGS_REPO" "$CLAUDE_DIR/settings-repo" 2>/dev/null; then
    echo "Settings cloned successfully."
  else
    echo "Could not clone settings repo (private or unavailable). Continuing without custom settings."
  fi
fi

# Copy settings if repo exists
if [ -d "$CLAUDE_DIR/settings-repo" ]; then
  echo "Installing Claude settings..."
  cp -f "$CLAUDE_DIR/settings-repo/CLAUDE.md" "$CLAUDE_DIR/CLAUDE.md" 2>/dev/null || true
  cp -f "$CLAUDE_DIR/settings-repo/settings.json" "$CLAUDE_DIR/settings.json" 2>/dev/null || true
  cp -rf "$CLAUDE_DIR/settings-repo/agents" "$CLAUDE_DIR/" 2>/dev/null || true
  cp -rf "$CLAUDE_DIR/settings-repo/hooks" "$CLAUDE_DIR/" 2>/dev/null || true
  chmod +x "$CLAUDE_DIR/hooks"/*.sh 2>/dev/null || true
  echo "Claude settings installed."
else
  echo "No custom settings available."
fi

# Check if OAuth token is set
if [ -n "$CLAUDE_CODE_OAUTH_TOKEN" ]; then
  echo "OAuth token configured."
else
  echo "WARNING: CLAUDE_CODE_OAUTH_TOKEN not set. Claude authentication may fail."
fi

echo "Starting application..."
exec node dist/main
