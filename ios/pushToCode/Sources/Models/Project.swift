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

struct GitHubRepo: Identifiable, Codable {
    let name: String
    let fullName: String
    let cloneUrl: String
    let isPrivate: Bool
    let description: String?

    var id: String { fullName }

    enum CodingKeys: String, CodingKey {
        case name
        case fullName = "full_name"
        case cloneUrl = "clone_url"
        case isPrivate = "private"
        case description
    }
}

struct GitHubReposResponse: Codable {
    let repos: [GitHubRepo]
    let total: Int
}
