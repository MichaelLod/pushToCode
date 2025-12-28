# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy source code
COPY . .

# Build the application
RUN npm run build

# Production stage
FROM node:20-alpine AS production

WORKDIR /app

# Install git and bash (required for git clone and hooks)
RUN apk add --no-cache git bash

# Install Claude Code CLI globally
RUN npm install -g @anthropic-ai/claude-code

# Create non-root user (Claude CLI blocks --dangerously-skip-permissions as root)
RUN addgroup -g 1001 claude && adduser -D -u 1001 -G claude claude

# Create repos directory for volume mount
RUN mkdir -p /repos && chown claude:claude /repos

# Create .claude directory for credential persistence
# Mount this as a volume to persist auth: -v claude-auth:/home/claude/.claude
RUN mkdir -p /home/claude/.claude && chown -R claude:claude /home/claude

# Set default repos path (can be overridden with -e REPOS_PATH=...)
ENV REPOS_PATH=/repos

# Set Claude home for credential storage
ENV CLAUDE_CONFIG_DIR=/home/claude/.claude

# Authentication: Set CLAUDE_CODE_OAUTH_TOKEN environment variable
# Get your token by running locally:
#   security find-generic-password -s "Claude Code-credentials" -w | jq -r '.claudeAiOauth.accessToken'
# Then pass to Docker: -e CLAUDE_CODE_OAUTH_TOKEN=sk-ant-oat01-...

# Set Node.js memory limit to 16GB
ENV NODE_OPTIONS="--max-old-space-size=16384"

# Copy package files
COPY package*.json ./

# Install only production dependencies
RUN npm ci --only=production

# Copy built application from builder stage
COPY --from=builder /app/dist ./dist

# Copy entrypoint script
COPY docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh

# Set ownership for app directory
RUN chown -R claude:claude /app

# Switch to non-root user (required for --dangerously-skip-permissions)
USER claude

# Expose the application port
EXPOSE 3000

# Start with entrypoint (clones settings, then starts app)
ENTRYPOINT ["/docker-entrypoint.sh"]
