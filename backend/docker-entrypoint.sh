#!/bin/sh

# Claude config stored in /repos/.claude for persistence (same volume as repos)
CLAUDE_DIR="${CLAUDE_CONFIG_DIR:-/repos/.claude}"

# Fix permissions on mounted volume (runs as root initially)
echo "Fixing volume permissions..."
chown -R claude:claude /repos
mkdir -p "$CLAUDE_DIR"
chown -R claude:claude "$CLAUDE_DIR"

# Symlink home .claude to repos .claude (Claude CLI uses $HOME/.claude for hooks)
mkdir -p /home/claude
rm -rf /home/claude/.claude
ln -sf "$CLAUDE_DIR" /home/claude/.claude
chown -h claude:claude /home/claude/.claude

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

# Ensure .claude.json has hasCompletedOnboarding=true to skip onboarding prompts
# See: https://github.com/anthropics/claude-code/issues/4714
CLAUDE_JSON="$CLAUDE_DIR/.claude.json"
if [ -f "$CLAUDE_JSON" ]; then
  # File exists - check if hasCompletedOnboarding is set
  if grep -q '"hasCompletedOnboarding"' "$CLAUDE_JSON"; then
    echo "Onboarding flag already present in .claude.json"
  else
    # Add hasCompletedOnboarding to existing file
    echo "Adding hasCompletedOnboarding to existing .claude.json"
    # Use jq if available, otherwise sed
    if command -v jq >/dev/null 2>&1; then
      jq '. + {"hasCompletedOnboarding": true}' "$CLAUDE_JSON" > "$CLAUDE_JSON.tmp" && mv "$CLAUDE_JSON.tmp" "$CLAUDE_JSON"
    else
      # Simple sed approach - add before closing brace
      sed -i 's/}$/,"hasCompletedOnboarding":true}/' "$CLAUDE_JSON"
    fi
  fi
else
  # Create new file with onboarding flag
  echo "Creating .claude.json with hasCompletedOnboarding=true"
  echo '{"hasCompletedOnboarding":true}' > "$CLAUDE_JSON"
fi
chown claude:claude "$CLAUDE_JSON"
echo "Contents of .claude.json:"
cat "$CLAUDE_JSON" | head -c 500

# Check authentication config
if [ -n "$ANTHROPIC_API_KEY" ]; then
  echo "API key configured."
elif [ -n "$CLAUDE_CODE_OAUTH_TOKEN" ]; then
  echo "OAuth token configured via environment variable."
elif [ -f "$CLAUDE_DIR/.credentials.json" ]; then
  echo "OAuth credentials found (persisted from previous login)."
else
  echo "No auth configured. Claude will prompt for OAuth login on first use."
fi

echo "Starting application as claude user..."
exec gosu claude node dist/main
