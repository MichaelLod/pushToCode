import Foundation

enum SessionStatus: String, Codable {
    case idle
    case running
    case stopped
    case connecting
    case disconnected
}

struct Session: Identifiable, Codable {
    let id: String
    var projectId: String?
    var projectPath: String?
    var status: SessionStatus
    var messages: [Message]
    var createdAt: Date
    var lastActiveAt: Date

    init(
        id: String = UUID().uuidString,
        projectId: String? = nil,
        projectPath: String? = nil,
        status: SessionStatus = .idle,
        messages: [Message] = [],
        createdAt: Date = Date(),
        lastActiveAt: Date = Date()
    ) {
        self.id = id
        self.projectId = projectId
        self.projectPath = projectPath
        self.status = status
        self.messages = messages
        self.createdAt = createdAt
        self.lastActiveAt = lastActiveAt
    }

    mutating func addMessage(_ message: Message) {
        messages.append(message)
        lastActiveAt = Date()
    }

    mutating func appendToLastMessage(_ content: String) {
        guard !messages.isEmpty else { return }
        messages[messages.count - 1].content += content
        lastActiveAt = Date()
    }
}
