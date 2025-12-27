import Foundation

// MARK: - Client to Server Messages

enum ClientMessageType: String, Codable {
    case initSession = "init_session"
    case execute
    case stop
    case ping
}

struct InitSessionMessage: Codable {
    var type: String = "init_session"
    let sessionId: String
    let projectId: String
}

struct ExecuteMessage: Codable {
    var type: String = "execute"
    let sessionId: String
    let prompt: String
    let projectPath: String
}

struct StopMessage: Codable {
    var type: String = "stop"
    let sessionId: String
}

struct PongMessage: Codable {
    var type: String = "pong"
}

// MARK: - Server to Client Messages

enum ServerMessageType: String, Codable {
    case sessionReady = "session_ready"
    case status
    case output
    case error
    case ping
    case pong
    case authRequired = "auth_required"
}

struct ServerMessage: Codable {
    let type: ServerMessageType
    let sessionId: String?
    let status: SessionStatus?
    let content: String?
    let outputType: OutputType?
    let isFinal: Bool?
    let code: String?
    let message: String?
    let timestamp: Int?
    let authUrl: String?

    enum CodingKeys: String, CodingKey {
        case type, sessionId, status, content, outputType, isFinal, code, message, timestamp, authUrl
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        type = try container.decode(ServerMessageType.self, forKey: .type)
        sessionId = try container.decodeIfPresent(String.self, forKey: .sessionId)
        status = try container.decodeIfPresent(SessionStatus.self, forKey: .status)
        content = try container.decodeIfPresent(String.self, forKey: .content)
        outputType = try container.decodeIfPresent(OutputType.self, forKey: .outputType)
        isFinal = try container.decodeIfPresent(Bool.self, forKey: .isFinal)
        code = try container.decodeIfPresent(String.self, forKey: .code)
        message = try container.decodeIfPresent(String.self, forKey: .message)
        timestamp = try container.decodeIfPresent(Int.self, forKey: .timestamp)
        authUrl = try container.decodeIfPresent(String.self, forKey: .authUrl)
    }
}
