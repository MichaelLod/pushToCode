#!/bin/sh

# Claude config stored in /repos/.claude for persistence (same volume as repos)
CLAUDE_DIR="${CLAUDE_CONFIG_DIR:-/repos/.claude}"

# Ensure Claude config directory exists (volume may be empty on first run)
mkdir -p "$CLAUDE_DIR"

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
  echo "Source repo contents:"
  ls -la "$CLAUDE_DIR/settings-repo/"

  cp -f "$CLAUDE_DIR/settings-repo/CLAUDE.md" "$CLAUDE_DIR/CLAUDE.md" 2>/dev/null || echo "  - CLAUDE.md: failed"
  cp -f "$CLAUDE_DIR/settings-repo/settings.json" "$CLAUDE_DIR/settings.json" 2>/dev/null || echo "  - settings.json: failed"
  cp -rf "$CLAUDE_DIR/settings-repo/agents" "$CLAUDE_DIR/" 2>/dev/null || echo "  - agents/: failed"
  cp -rf "$CLAUDE_DIR/settings-repo/hooks" "$CLAUDE_DIR/" 2>/dev/null || echo "  - hooks/: failed"
  chmod +x "$CLAUDE_DIR/hooks"/*.sh 2>/dev/null || echo "  - chmod hooks: failed"

  echo "Installed files in $CLAUDE_DIR:"
  ls -la "$CLAUDE_DIR/"
  echo "Hooks directory:"
  ls -la "$CLAUDE_DIR/hooks/" 2>/dev/null || echo "  (no hooks directory)"
  echo "Claude settings installed."
else
  echo "No custom settings available."
fi

# Check authentication config
if [ -n "$ANTHROPIC_API_KEY" ]; then
  echo "API key configured."
elif [ -f "$CLAUDE_DIR/.credentials.json" ]; then
  echo "OAuth credentials found (persisted from previous login)."
else
  echo "No auth configured. Claude will prompt for OAuth login on first use."
fi

echo "Starting application..."
exec node dist/main
