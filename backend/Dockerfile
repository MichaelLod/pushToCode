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

# Install git (required for git clone operations)
RUN apk add --no-cache git

# Install Claude Code CLI globally
RUN npm install -g @anthropic-ai/claude-code

# Create repos directory for volume mount
RUN mkdir -p /repos

# Set default repos path (can be overridden with -e REPOS_PATH=...)
ENV REPOS_PATH=/repos

# Set Node.js memory limit to 16GB
ENV NODE_OPTIONS="--max-old-space-size=16384"

# Copy package files
COPY package*.json ./

# Install only production dependencies
RUN npm ci --only=production

# Copy built application from builder stage
COPY --from=builder /app/dist ./dist

# Expose the application port
EXPOSE 3000

# Start the application
CMD ["node", "dist/main"]
