# pushToCode

A voice-first coding app that lets you interact with Claude CLI using voice commands. Features a web-based terminal interface with real-time streaming and optional autonomous code monitoring.

## Project Structure

```
pushToCode/
├── backend/          # NestJS server
│   ├── src/
│   │   ├── auth/           # API key authentication
│   │   ├── claude/         # WebSocket gateway & Claude CLI service
│   │   ├── transcription/  # Whisper API integration
│   │   ├── repos/          # Git repository management
│   │   ├── stressor/       # Autonomous monitoring daemon
│   │   └── common/         # Shared interfaces
│   └── .env.example
│
└── web/              # Next.js frontend
    └── src/
        ├── app/            # Next.js app router
        ├── components/     # React components
        ├── hooks/          # Custom React hooks
        ├── lib/            # API client & utilities
        └── types/          # TypeScript types
```

## Backend Setup

### Prerequisites

- Node.js 18+
- Claude CLI installed and configured
- OpenAI API key (for Whisper transcription)
- GitHub token (optional, for repository browsing)

### Installation

```bash
cd backend
npm install
```

### Configuration

Create a `.env` file based on `.env.example`:

```env
PORT=3000
API_KEY=your-secure-api-key-here
OPENAI_API_KEY=sk-your-openai-api-key
REPOS_PATH=./repos
GITHUB_TOKEN=ghp_your-github-token  # Optional
```

### Running

```bash
# Development
npm run start:dev

# Production
npm run build
npm run start:prod
```

### API Endpoints

- `GET /api/health` - Health check
- `POST /api/transcribe` - Transcribe audio file to text
- `GET /api/repos` - List cloned repositories
- `POST /api/repos` - Clone a new repository
- `DELETE /api/repos/:id` - Delete a repository
- `POST /api/repos/:id/pull` - Pull latest changes
- `GET /api/repos/available` - List GitHub repos (requires GITHUB_TOKEN)

**Stressor Endpoints:**
- `GET /api/stressor/status` - Get daemon status
- `GET /api/stressor/config` - Get daemon configuration
- `PUT /api/stressor/config` - Update configuration
- `POST /api/stressor/start` - Start the daemon
- `POST /api/stressor/stop` - Stop the daemon
- `POST /api/stressor/projects` - Add project to monitor
- `DELETE /api/stressor/projects/:path` - Remove project
- `GET /api/stressor/logs` - View daemon logs

### WebSocket Protocol

Connect to `ws://localhost:3000` with API key in headers or query param.

**Client to Server:**
```json
{ "type": "init_session", "sessionId": "...", "projectId": "..." }
{ "type": "start_interactive", "sessionId": "...", "projectPath": "..." }
{ "type": "pty_input", "sessionId": "...", "data": "..." }
{ "type": "stop", "sessionId": "..." }
```

**Server to Client:**
```json
{ "type": "session_ready", "sessionId": "..." }
{ "type": "interactive_started", "sessionId": "..." }
{ "type": "pty_output", "sessionId": "...", "content": "..." }
{ "type": "terminal_buffer", "sessionId": "...", "buffer": {...} }
{ "type": "status", "sessionId": "...", "status": "idle|running|stopped" }
{ "type": "error", "sessionId": "...", "code": "...", "message": "..." }
```

## Web Frontend Setup

### Prerequisites

- Node.js 18+
- Backend server running

### Installation

```bash
cd web
npm install
```

### Configuration

Create a `.env.local` file:

```env
NEXT_PUBLIC_API_URL=http://localhost:3000
NEXT_PUBLIC_VERSION=1.0.0
```

### Running

```bash
# Development
npm run dev

# Production
npm run build
npm run start
```

### Features

- **Terminal Sessions**: Full xterm.js terminal with Claude CLI
- **Voice Recording**: Tap to record voice commands
- **Transcription**: Audio is transcribed using Whisper API
- **Real-time Streaming**: WebSocket-based PTY output streaming
- **Multiple Sessions**: Work on multiple projects in tabs
- **Repository Management**: Clone and manage Git repositories
- **Stressor Control**: Configure autonomous code monitoring
- **PWA Support**: Install as a standalone app

### Configuration

On first launch, configure in Settings:
1. **Server URL**: Your backend server URL (e.g., `ws://localhost:3000`)
2. **API Key**: The API key from your backend `.env`

## Stressor Daemon

The stressor daemon is an autonomous agent that periodically runs `@stressor` analysis on configured projects.

### How It Works

1. Enable the daemon in Settings > Stressor Daemon
2. Select which repositories to monitor
3. Configure scan interval (default: 4-8 hours random)
4. The daemon runs `claude -p "@stressor"` on a random project at each interval

### Use Cases

- Autonomous code quality monitoring
- Periodic security scans
- Competitive intelligence analysis
- Automated improvement suggestions

### Configuration

| Setting | Default | Description |
|---------|---------|-------------|
| `enabled` | false | Enable/disable the daemon |
| `projects` | [] | List of project paths to monitor |
| `intervalMinHours` | 4 | Minimum hours between scans |
| `intervalMaxHours` | 8 | Maximum hours between scans |

## Architecture

### Backend

- **NestJS** framework with WebSocket support
- **node-pty** for terminal emulation
- **Claude CLI** spawned as PTY process for interactive sessions
- **Whisper API** for speech-to-text transcription
- **Git** for repository management

### Web Frontend

- **Next.js 14** with App Router
- **React** with TypeScript
- **xterm.js** for terminal rendering
- **WebSocket** for real-time communication
- **Tailwind CSS** for styling

## Security

- API key authentication on all endpoints
- Credentials stored in browser localStorage (web)
- WebSocket connections validated on connect
- No sensitive data in logs

## Development

### Backend Development

```bash
cd backend
npm run start:dev  # Watch mode with hot reload
npm run lint       # Run linter
npm run test       # Run tests
```

### Web Development

```bash
cd web
npm run dev        # Development server with hot reload
npm run lint       # Run linter
npm run build      # Production build
```

## License

MIT
