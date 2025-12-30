# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Install build tools for node-pty native compilation
RUN apk add --no-cache python3 make g++

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

# Install git, bash, jq (for stressor daemon), and build tools for node-pty
RUN apk add --no-cache git bash jq python3 make g++

# Install Claude Code CLI globally
RUN npm install -g @anthropic-ai/claude-code

# Create non-root user (Claude CLI blocks --dangerously-skip-permissions as root)
RUN addgroup -g 1001 claude && adduser -D -u 1001 -G claude claude

# Set git author globally for the claude user (required for commits)
RUN git config --global user.email "michael.lodzik@gmail.com" && \
    git config --global user.name "MichaelLod"

# Create repos directory for volume mount (also stores Claude config and stressor config)
RUN mkdir -p /repos/.claude /repos/.stressor && chown -R claude:claude /repos

# Set default repos path (can be overridden with -e REPOS_PATH=...)
ENV REPOS_PATH=/repos

# Set Claude config dir inside repos for persistence (same volume)
ENV CLAUDE_CONFIG_DIR=/repos/.claude

# Authentication: Claude will prompt for OAuth login on first use
# The auth URL will be sent to the iOS app for browser-based login
# Credentials persist in /repos/.claude (same volume as repos)

# Set Node.js memory limit to 16GB
ENV NODE_OPTIONS="--max-old-space-size=16384"

# Copy package files
COPY package*.json ./

# Install only production dependencies
RUN npm ci --only=production

# Copy built application from builder stage
COPY --from=builder /app/dist ./dist

# Copy stressor daemon script
COPY stressor-daemon.sh /app/stressor-daemon.sh
RUN chmod +x /app/stressor-daemon.sh

# Copy entrypoint script
COPY docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh

# Set ownership for app directory
RUN chown -R claude:claude /app

# Install gosu for dropping privileges after fixing permissions
RUN apk add --no-cache gosu

# Expose the application port
EXPOSE 3000

# Start with entrypoint (fixes permissions, then drops to claude user)
ENTRYPOINT ["/docker-entrypoint.sh"]
