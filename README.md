# pushToCode

A voice-first iOS coding app that lets you interact with Claude CLI using voice commands. s

## Project Structure

```
pushToCode/
├── backend/          # NestJS server
│   ├── src/
│   │   ├── auth/           # API key authentication
│   │   ├── claude/         # WebSocket gateway & Claude CLI service
│   │   ├── transcription/  # Whisper API integration
│   │   ├── repos/          # Git repository management
│   │   └── common/         # Shared interfaces
│   └── .env.example
│
└── ios/              # SwiftUI app
    ├── pushToCode/
    │   ├── Sources/
    │   │   ├── Models/        # Data models
    │   │   ├── Services/      # Network & audio services
    │   │   ├── ViewModels/    # MVVM view models
    │   │   └── Views/         # SwiftUI views
    │   └── Resources/         # Assets
    └── project.yml            # XcodeGen project spec
```

## Backend Setup

### Prerequisites

- Node.js 18+
- Claude CLI installed and configured
- OpenAI API key (for Whisper transcription)

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

### WebSocket Protocol

Connect to `ws://localhost:3000` with API key in headers.

**Client to Server:**
```json
{ "type": "init_session", "sessionId": "...", "projectId": "..." }
{ "type": "execute", "sessionId": "...", "prompt": "...", "projectPath": "..." }
{ "type": "stop", "sessionId": "..." }
```

**Server to Client:**
```json
{ "type": "session_ready", "sessionId": "..." }
{ "type": "status", "sessionId": "...", "status": "idle|running|stopped" }
{ "type": "output", "sessionId": "...", "content": "...", "outputType": "text|code_block|thinking|file_change", "isFinal": false }
{ "type": "error", "sessionId": "...", "code": "...", "message": "..." }
```

## iOS Setup

### Prerequisites

- Xcode 15+
- XcodeGen (`brew install xcodegen`)
- iOS 16.0+ device or simulator

### Installation

```bash
cd ios
xcodegen generate
open pushToCode.xcodeproj
```

### Features

- **Voice Recording**: Tap to record voice commands
- **Transcription**: Audio is transcribed using Whisper API
- **Claude Integration**: Stream Claude CLI responses in real-time
- **Multiple Sessions**: Work on multiple projects in tabs
- **Repository Management**: Clone and manage Git repositories
- **Haptic Feedback**: Tactile feedback on recording start/stop

### Configuration

On first launch, enter:
1. **Server URL**: Your backend server URL (e.g., `http://localhost:3000`)
2. **API Key**: The API key from your backend `.env`

## Architecture

### Backend

- **NestJS** framework with WebSocket support
- **Claude CLI** spawned as child process for each execution
- **Whisper API** for speech-to-text transcription
- **Git** for repository management

### iOS

- **SwiftUI** for declarative UI
- **MVVM** architecture pattern
- **Combine** for reactive data flow
- **URLSession** WebSocket for server communication
- **AVFoundation** for audio recording
- **Keychain** for secure credential storage

## Security

- API key authentication on all endpoints
- Credentials stored in iOS Keychain
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

### iOS Development

1. Generate Xcode project: `xcodegen generate`
2. Open in Xcode
3. Select target device
4. Build and run (Cmd+R)

## License

MIT
