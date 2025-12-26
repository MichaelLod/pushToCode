import Foundation

struct Project: Identifiable, Codable, Hashable {
    let id: String
    let name: String
    let path: String
    let url: String
    let createdAt: Date
    let branch: String?

    init(
        id: String = UUID().uuidString,
        name: String,
        path: String,
        url: String,
        createdAt: Date = Date(),
        branch: String? = nil
    ) {
        self.id = id
        self.name = name
        self.path = path
        self.url = url
        self.createdAt = createdAt
        self.branch = branch
    }
}

struct ProjectListResponse: Codable {
    let repos: [Project]
    let total: Int
}

struct CloneRepoRequest: Codable {
    let url: String
    let name: String?
    let branch: String?
}
