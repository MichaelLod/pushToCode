import Foundation
import Combine
import UIKit

enum WebSocketError: Error, LocalizedError {
    case notConnected
    case invalidURL
    case connectionFailed(String)
    case encodingError
    case serverError(code: String, message: String)

    var errorDescription: String? {
        switch self {
        case .notConnected:
            return "Not connected to server"
        case .invalidURL:
            return "Invalid server URL"
        case .connectionFailed(let reason):
            return "Connection failed: \(reason)"
        case .encodingError:
            return "Failed to encode message"
        case .serverError(let code, let message):
            return "Server error (\(code)): \(message)"
        }
    }
}

protocol WebSocketServiceDelegate: AnyObject {
    func webSocketDidConnect()
    func webSocketDidDisconnect(error: Error?)
    func webSocketDidReceiveMessage(_ message: ServerMessage)
    func webSocketDidReceiveError(_ error: WebSocketError)
}

final class WebSocketService: NSObject, ObservableObject {
    static let shared = WebSocketService()

    weak var delegate: WebSocketServiceDelegate?

    @Published private(set) var isConnected = false
    @Published private(set) var isReconnecting = false

    private var webSocket: URLSessionWebSocketTask?
    private var urlSession: URLSession!
    private var serverURL: URL?
    private var apiKey: String?

    private var reconnectAttempts = 0
    private let maxReconnectAttempts = 5
    private var reconnectTimer: Timer?
    private var pingTimer: Timer?
    private let pingInterval: TimeInterval = 30

    private let messageSubject = PassthroughSubject<ServerMessage, Never>()
    var messagePublisher: AnyPublisher<ServerMessage, Never> {
        messageSubject.eraseToAnyPublisher()
    }

    override init() {
        super.init()
        let config = URLSessionConfiguration.default
        config.waitsForConnectivity = true
        urlSession = URLSession(configuration: config, delegate: self, delegateQueue: .main)

        setupAppLifecycleObservers()
    }

    // MARK: - Connection Management

    func connect(to urlString: String, apiKey: String) {
        guard let url = URL(string: urlString) else {
            delegate?.webSocketDidReceiveError(.invalidURL)
            return
        }

        disconnect()

        self.serverURL = url
        self.apiKey = apiKey
        self.reconnectAttempts = 0

        establishConnection()
    }

    private func establishConnection() {
        guard let url = serverURL, let apiKey = apiKey else { return }

        var request = URLRequest(url: url)
        request.setValue(apiKey, forHTTPHeaderField: "x-api-key")

        webSocket = urlSession.webSocketTask(with: request)
        webSocket?.resume()

        receiveMessage()
        startPingTimer()
    }

    func disconnect() {
        stopPingTimer()
        stopReconnectTimer()
        webSocket?.cancel(with: .goingAway, reason: nil)
        webSocket = nil
        isConnected = false
        isReconnecting = false
    }

    // MARK: - Message Sending

    func send(_ message: Codable) {
        guard isConnected else {
            delegate?.webSocketDidReceiveError(.notConnected)
            return
        }

        do {
            let data = try JSONEncoder().encode(message)
            guard let jsonString = String(data: data, encoding: .utf8) else {
                throw WebSocketError.encodingError
            }

            webSocket?.send(.string(jsonString)) { [weak self] error in
                if let error = error {
                    self?.delegate?.webSocketDidReceiveError(.connectionFailed(error.localizedDescription))
                }
            }
        } catch {
            delegate?.webSocketDidReceiveError(.encodingError)
        }
    }

    func initSession(sessionId: String, projectId: String) {
        let message = InitSessionMessage(sessionId: sessionId, projectId: projectId)
        send(message)
    }

    func execute(sessionId: String, prompt: String, projectPath: String) {
        let message = ExecuteMessage(sessionId: sessionId, prompt: prompt, projectPath: projectPath)
        send(message)
    }

    func stop(sessionId: String) {
        let message = StopMessage(sessionId: sessionId)
        send(message)
    }

    func submitAuthCode(_ code: String) {
        let message = SubmitAuthCodeMessage(code: code)
        send(message)
    }

    func sendPtyInput(_ input: String) {
        let message = PtyInputMessage(input: input)
        send(message)
    }

    func sendLogin() {
        let message = LoginMessage()
        send(message)
    }

    // MARK: - Message Receiving

    private func receiveMessage() {
        webSocket?.receive { [weak self] result in
            guard let self = self else { return }

            switch result {
            case .success(let message):
                self.handleMessage(message)
                self.receiveMessage()

            case .failure(let error):
                self.handleDisconnection(error: error)
            }
        }
    }

    private func handleMessage(_ message: URLSessionWebSocketTask.Message) {
        switch message {
        case .string(let text):
            parseMessage(text)

        case .data(let data):
            if let text = String(data: data, encoding: .utf8) {
                parseMessage(text)
            }

        @unknown default:
            break
        }
    }

    private func parseMessage(_ text: String) {
        guard let data = text.data(using: .utf8) else { return }

        do {
            let message = try JSONDecoder().decode(ServerMessage.self, from: data)
            messageSubject.send(message)
            delegate?.webSocketDidReceiveMessage(message)

            if message.type == .error, let code = message.code, let msg = message.message {
                delegate?.webSocketDidReceiveError(.serverError(code: code, message: msg))
            }
        } catch {
            print("Failed to decode message: \(text), error: \(error)")
        }
    }

    // MARK: - Reconnection

    private func handleDisconnection(error: Error?) {
        isConnected = false
        stopPingTimer()
        delegate?.webSocketDidDisconnect(error: error)

        attemptReconnect()
    }

    private func attemptReconnect() {
        guard reconnectAttempts < maxReconnectAttempts else {
            isReconnecting = false
            return
        }

        isReconnecting = true
        reconnectAttempts += 1

        let delay = min(pow(2.0, Double(reconnectAttempts)), 30.0)

        reconnectTimer = Timer.scheduledTimer(withTimeInterval: delay, repeats: false) { [weak self] _ in
            self?.establishConnection()
        }
    }

    private func stopReconnectTimer() {
        reconnectTimer?.invalidate()
        reconnectTimer = nil
    }

    // MARK: - Ping/Pong

    private func startPingTimer() {
        pingTimer = Timer.scheduledTimer(withTimeInterval: pingInterval, repeats: true) { [weak self] _ in
            self?.sendPing()
        }
    }

    private func stopPingTimer() {
        pingTimer?.invalidate()
        pingTimer = nil
    }

    private func sendPing() {
        webSocket?.sendPing { [weak self] error in
            if let error = error {
                self?.handleDisconnection(error: error)
            }
        }
    }

    // MARK: - App Lifecycle

    private func setupAppLifecycleObservers() {
        NotificationCenter.default.addObserver(
            self,
            selector: #selector(appDidBecomeActive),
            name: UIApplication.didBecomeActiveNotification,
            object: nil
        )

        NotificationCenter.default.addObserver(
            self,
            selector: #selector(appDidEnterBackground),
            name: UIApplication.didEnterBackgroundNotification,
            object: nil
        )
    }

    @objc private func appDidBecomeActive() {
        if !isConnected && serverURL != nil && apiKey != nil {
            reconnectAttempts = 0
            establishConnection()
        }
    }

    @objc private func appDidEnterBackground() {
        // Keep connection alive in background for a short time
        // The system will eventually terminate if in background too long
    }
}

// MARK: - URLSessionWebSocketDelegate

extension WebSocketService: URLSessionWebSocketDelegate {
    func urlSession(
        _ session: URLSession,
        webSocketTask: URLSessionWebSocketTask,
        didOpenWithProtocol protocol: String?
    ) {
        isConnected = true
        isReconnecting = false
        reconnectAttempts = 0
        delegate?.webSocketDidConnect()
    }

    func urlSession(
        _ session: URLSession,
        webSocketTask: URLSessionWebSocketTask,
        didCloseWith closeCode: URLSessionWebSocketTask.CloseCode,
        reason: Data?
    ) {
        handleDisconnection(error: nil)
    }
}
