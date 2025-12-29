import Foundation
import Combine
import UIKit

@MainActor
final class TerminalViewModel: ObservableObject {
    @Published var session: Session
    @Published var inputText: String = ""
    @Published var isConnected = false
    @Published var errorMessage: String?
    @Published var authUrl: URL?
    @Published var showAuthAlert = false
    @Published var showAuthCodeInput = false
    @Published var authCode: String = ""
    @Published var isSubmittingAuthCode = false
    @Published var ptyOutput: String = ""
    @Published var parsedOutput: AttributedString = AttributedString()
    @Published var isStartingSession = false

    private let webSocketService = WebSocketService.shared
    private let settingsManager = SettingsManager.shared
    private let parser = ANSIParser()
    private var cancellables = Set<AnyCancellable>()
    private var idleTimer: Timer?
    private let idleTimeoutSeconds: TimeInterval = 2.0

    init(session: Session) {
        self.session = session
        setupBindings()

        // If WebSocket is already connected, initialize session immediately
        // This handles new tabs created while connection is active
        if webSocketService.isConnected {
            initializeSession()
            if session.projectPath != nil {
                startInteractiveSession()
            }
        }
    }

    private func setupBindings() {
        // Observe WebSocket connection state
        webSocketService.$isConnected
            .receive(on: DispatchQueue.main)
            .sink { [weak self] connected in
                guard let self = self else { return }
                let wasDisconnected = !self.isConnected
                self.isConnected = connected

                // Auto-initialize session when connection is established
                if connected && wasDisconnected {
                    self.initializeSession()

                    // If a project is already selected, also start the interactive session
                    // This handles reconnection scenarios where the project was set before disconnect
                    if self.session.projectPath != nil {
                        self.startInteractiveSession()
                    }
                }
            }
            .store(in: &cancellables)

        // Observe incoming messages
        webSocketService.messagePublisher
            .receive(on: DispatchQueue.main)
            .sink { [weak self] message in
                self?.handleMessage(message)
            }
            .store(in: &cancellables)
    }

    // MARK: - Connection

    func connect() {
        guard let serverURL = settingsManager.serverURL,
              let apiKey = settingsManager.apiKey else {
            errorMessage = "Server not configured. Please go to Settings."
            return
        }

        // Convert HTTP URL to WebSocket URL
        let wsURL = serverURL
            .replacingOccurrences(of: "https://", with: "wss://")
            .replacingOccurrences(of: "http://", with: "ws://")

        session.status = .connecting
        webSocketService.connect(to: wsURL, apiKey: apiKey)
    }

    func disconnect() {
        idleTimer?.invalidate()
        idleTimer = nil
        webSocketService.disconnect()
        session.status = .disconnected
        ptyOutput = ""
        parsedOutput = AttributedString()
    }

    func initializeSession() {
        guard isConnected else {
            connect()
            // Will initialize after connection
            return
        }

        webSocketService.initSession(
            sessionId: session.id,
            projectId: session.projectId ?? session.projectPath ?? ""
        )
    }

    // MARK: - Commands

    func sendPrompt(_ prompt: String) {
        guard !prompt.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else { return }

        // Clear input first
        let promptText = prompt
        inputText = ""

        // Always send to PTY (interactive mode is the only mode)
        sendPtyInput(promptText)
    }

    func stop() {
        webSocketService.stop(sessionId: session.id)
        session.status = .stopped
    }

    // MARK: - Message Handling

    private func handleMessage(_ message: ServerMessage) {
        // Global messages that don't require session matching (connection-level)
        // - ping/pong: heartbeat for connection
        // - auth*: authentication affects entire connection, not just one session
        let globalMessageTypes: Set<ServerMessageType> = [
            .ping, .pong,
            .authRequired, .authSuccess, .authFailed, .authCodeSubmitted
        ]

        // For session-scoped messages, require exact sessionId match
        // Empty string or nil sessionId means "not for this session" unless it's a global message
        if !globalMessageTypes.contains(message.type) {
            guard let messageSessionId = message.sessionId,
                  !messageSessionId.isEmpty,
                  messageSessionId == session.id else { return }
        }

        switch message.type {
        case .sessionReady:
            session.status = .idle
            errorMessage = nil

        case .status:
            if let status = message.status {
                session.status = status
            }

        case .output:
            handleOutput(message)

        case .error:
            errorMessage = message.message ?? "Unknown error"
            session.status = .idle
            // Reset auth state if this was an auth error
            if message.code == "AUTH_FAILED" || message.code == "CODE_SUBMIT_FAILED" {
                isSubmittingAuthCode = false
            }

        case .ping:
            // Server ping - respond with pong to keep connection alive
            webSocketService.send(PongMessage())

        case .pong:
            // Heartbeat response, no action needed
            break

        case .authRequired:
            handleAuthRequired(message)

        case .authCodeSubmitted:
            // Code received, waiting for verification
            isSubmittingAuthCode = true

        case .authSuccess:
            handleAuthSuccess()

        case .authFailed:
            handleAuthFailed(message)

        case .ptyOutput:
            handlePtyOutput(message)

        case .loginInteractive:
            handleLoginInteractive(message)

        case .interactiveStarted:
            handleInteractiveStarted(message)
        }
    }

    private func handleAuthFailed(_ message: ServerMessage) {
        isSubmittingAuthCode = false
        let reason = message.message ?? "Authentication failed"
        errorMessage = reason

        // Keep the code input open so user can retry
        let errorMsg = Message(
            role: .assistant,
            content: "Authentication failed: \(reason). Please try again.",
            outputType: .text,
            isFinal: true
        )
        session.addMessage(errorMsg)
    }

    private func handleAuthSuccess() {
        isSubmittingAuthCode = false
        showAuthCodeInput = false
        authCode = ""
        authUrl = nil
        ptyOutput = ""
        parsedOutput = AttributedString()

        let successMessage = Message(
            role: .assistant,
            content: "Successfully authenticated with Claude! You can now send prompts.",
            outputType: .text,
            isFinal: true
        )
        session.addMessage(successMessage)
    }

    private func handleAuthRequired(_ message: ServerMessage) {
        guard let urlString = message.authUrl, let url = URL(string: urlString) else {
            errorMessage = message.message ?? "Authentication required but no URL provided"
            return
        }

        authUrl = url
        showAuthAlert = true
        session.status = .idle

        // Add a message to the chat indicating auth is needed
        let authMessage = Message(
            role: .assistant,
            content: "Claude requires authentication. Tap the link to log in, then try again.",
            outputType: .text,
            isFinal: true
        )
        session.addMessage(authMessage)
    }

    func openAuthUrl() {
        guard let url = authUrl else { return }
        UIApplication.shared.open(url)
        // Show code input after opening browser
        showAuthCodeInput = true
    }

    func submitAuthCode() {
        let code = authCode.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !code.isEmpty else { return }

        isSubmittingAuthCode = true
        webSocketService.submitAuthCode(code)
    }

    func cancelAuthCodeInput() {
        showAuthCodeInput = false
        authCode = ""
        isSubmittingAuthCode = false
    }

    private func handlePtyOutput(_ message: ServerMessage) {
        guard let content = message.content, !content.isEmpty else { return }

        // Cancel any pending idle timer - we're receiving output
        idleTimer?.invalidate()
        idleTimer = nil

        // We're receiving output, so we're actively running
        if session.status != .running {
            session.status = .running
        }

        // Just accumulate raw PTY output - SwiftTerm handles all rendering
        ptyOutput += content

        // Start idle detection timer
        // If no more output for N seconds, consider Claude idle (waiting for input)
        idleTimer = Timer.scheduledTimer(withTimeInterval: idleTimeoutSeconds, repeats: false) { [weak self] _ in
            Task { @MainActor in
                self?.session.status = .idle
            }
        }
    }

    /// Send raw input directly to PTY (used by SwiftTerm)
    func sendRawInput(_ input: String) {
        guard !input.isEmpty else { return }
        webSocketService.sendPtyInput(input, sessionId: session.id)
    }

    private func handleLoginInteractive(_ message: ServerMessage) {
        let interactiveMessage = Message(
            role: .assistant,
            content: message.message ?? "Type /login to authenticate with Claude.",
            outputType: .text,
            isFinal: true
        )
        session.addMessage(interactiveMessage)
    }

    private func handleInteractiveStarted(_ message: ServerMessage) {
        isStartingSession = false
        session.status = .running
    }

    func sendPtyInput(_ input: String) {
        guard !input.isEmpty else { return }

        // Trim whitespace - leading spaces break slash command recognition
        let trimmedInput = input.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmedInput.isEmpty else { return }

        // Add user message to chat
        let userMessage = Message(role: .user, content: trimmedInput)
        session.addMessage(userMessage)

        // Send input with Enter - backend handles command logic
        webSocketService.sendPtyInput(trimmedInput + "\r", sessionId: session.id)
    }

    func triggerLogin() {
        webSocketService.sendLogin()
        session.status = .running
    }

    private func handleOutput(_ message: ServerMessage) {
        guard let content = message.content, !content.isEmpty else { return }

        let outputType = message.outputType ?? .text
        let isFinal = message.isFinal ?? false

        // Check if we should append to the last message or create new one
        if let lastMessage = session.messages.last,
           lastMessage.role == .assistant,
           !lastMessage.isFinal,
           lastMessage.outputType == outputType {
            // Append to existing message
            session.appendToLastMessage(content)
            if isFinal {
                if var last = session.messages.last {
                    last.isFinal = true
                    session.messages[session.messages.count - 1] = last
                }
            }
        } else {
            // Create new message
            let newMessage = Message(
                role: .assistant,
                content: content,
                outputType: outputType,
                isFinal: isFinal
            )
            session.addMessage(newMessage)
        }
    }

    // MARK: - Project

    func setProject(_ project: Project) {
        session.projectId = project.id
        session.projectPath = project.path

        // Start interactive session with new project
        if isConnected {
            startInteractiveSession()
        }
    }

    func startInteractiveSession() {
        guard let projectPath = session.projectPath else { return }

        // Cancel any pending idle timer from previous session
        idleTimer?.invalidate()
        idleTimer = nil

        // Clear terminal output for fresh session
        ptyOutput = ""
        parsedOutput = AttributedString()
        parser.reset()

        isStartingSession = true
        session.status = .running

        webSocketService.startInteractiveSession(
            sessionId: session.id,
            projectPath: projectPath
        )
    }

    func clearMessages() {
        session.messages = []
    }
}
