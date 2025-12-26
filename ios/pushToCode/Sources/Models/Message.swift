import Foundation

enum MessageRole: String, Codable {
    case user
    case assistant
    case system
}

enum OutputType: String, Codable {
    case text
    case codeBlock = "code_block"
    case thinking
    case fileChange = "file_change"
}

struct Message: Identifiable, Codable {
    let id: String
    let role: MessageRole
    var content: String
    let outputType: OutputType
    let timestamp: Date
    var isFinal: Bool

    init(
        id: String = UUID().uuidString,
        role: MessageRole,
        content: String,
        outputType: OutputType = .text,
        timestamp: Date = Date(),
        isFinal: Bool = true
    ) {
        self.id = id
        self.role = role
        self.content = content
        self.outputType = outputType
        self.timestamp = timestamp
        self.isFinal = isFinal
    }
}

// MARK: - FileChange

struct FileChange: Codable {
    let tool: String
    let file: String?
}
