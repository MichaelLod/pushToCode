#!/bin/sh
set -e

CLAUDE_DIR="/root/.claude"
SETTINGS_REPO="https://github.com/MichaelLod/claude-settings.git"

echo "=== Claude Code Backend Startup ==="

# Clone or update Claude settings
if [ -d "$CLAUDE_DIR/settings-repo" ]; then
  echo "Updating Claude settings..."
  cd "$CLAUDE_DIR/settings-repo" && git pull --quiet
else
  echo "Cloning Claude settings from $SETTINGS_REPO..."
  git clone --quiet "$SETTINGS_REPO" "$CLAUDE_DIR/settings-repo"
fi

# Copy settings (not symlink, for Docker compatibility)
echo "Installing Claude settings..."
cp -f "$CLAUDE_DIR/settings-repo/CLAUDE.md" "$CLAUDE_DIR/CLAUDE.md" 2>/dev/null || true
cp -f "$CLAUDE_DIR/settings-repo/settings.json" "$CLAUDE_DIR/settings.json" 2>/dev/null || true
cp -rf "$CLAUDE_DIR/settings-repo/agents" "$CLAUDE_DIR/" 2>/dev/null || true
cp -rf "$CLAUDE_DIR/settings-repo/hooks" "$CLAUDE_DIR/" 2>/dev/null || true

# Make hooks executable
chmod +x "$CLAUDE_DIR/hooks"/*.sh 2>/dev/null || true

echo "Claude settings installed."

# Check if OAuth token is set
if [ -n "$CLAUDE_CODE_OAUTH_TOKEN" ]; then
  echo "OAuth token configured."
else
  echo "WARNING: CLAUDE_CODE_OAUTH_TOKEN not set. Claude authentication may fail."
fi

echo "Starting application..."
exec node dist/main
