#!/bin/sh

CLAUDE_DIR="/root/.claude"

# Build settings repo URL with token if available
if [ -n "$GITHUB_TOKEN" ]; then
  SETTINGS_REPO="https://${GITHUB_TOKEN}@github.com/MichaelLod/claude-settings.git"
else
  SETTINGS_REPO="${CLAUDE_SETTINGS_REPO:-https://github.com/MichaelLod/claude-settings.git}"
fi

echo "=== Claude Code Backend Startup ==="
echo "GITHUB_TOKEN present: $([ -n "$GITHUB_TOKEN" ] && echo 'yes' || echo 'no')"
echo "CLAUDE_CODE_OAUTH_TOKEN present: $([ -n "$CLAUDE_CODE_OAUTH_TOKEN" ] && echo 'yes' || echo 'no')"

# Clone or update Claude settings (optional - don't fail if private repo)
if [ -d "$CLAUDE_DIR/settings-repo" ]; then
  echo "Updating Claude settings..."
  cd "$CLAUDE_DIR/settings-repo" && git pull 2>&1 || echo "Could not update settings"
  cd /app
else
  echo "Cloning Claude settings..."
  if git clone "$SETTINGS_REPO" "$CLAUDE_DIR/settings-repo" 2>&1; then
    echo "Settings cloned successfully."
  else
    echo "Could not clone settings repo. Error above."
  fi
fi

# Show what's in .claude dir
echo "Contents of $CLAUDE_DIR:"
ls -la "$CLAUDE_DIR" 2>/dev/null || echo "Directory not accessible"

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

# Check if OAuth token is set and also set alternative env vars
if [ -n "$CLAUDE_CODE_OAUTH_TOKEN" ]; then
  echo "OAuth token configured."
  # Also set ANTHROPIC_AUTH_TOKEN in case Claude CLI uses that
  export ANTHROPIC_AUTH_TOKEN="$CLAUDE_CODE_OAUTH_TOKEN"
  echo "Also set ANTHROPIC_AUTH_TOKEN from CLAUDE_CODE_OAUTH_TOKEN"
else
  echo "WARNING: CLAUDE_CODE_OAUTH_TOKEN not set. Claude authentication may fail."
fi

echo "Starting application..."
exec node dist/main
