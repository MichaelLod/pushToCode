import Foundation

enum ReposError: Error, LocalizedError {
    case invalidURL
    case networkError(String)
    case serverError(Int, String)
    case notConfigured

    var errorDescription: String? {
        switch self {
        case .invalidURL:
            return "Invalid server URL"
        case .networkError(let reason):
            return "Network error: \(reason)"
        case .serverError(let code, let message):
            return "Server error (\(code)): \(message)"
        case .notConfigured:
            return "Server not configured"
        }
    }
}

final class ReposService: ObservableObject {
    static let shared = ReposService()

    @Published private(set) var projects: [Project] = []
    @Published private(set) var isLoading = false

    private let settingsManager = SettingsManager.shared

    // MARK: - API Calls

    func fetchProjects() async throws {
        guard settingsManager.isConfigured else {
            throw ReposError.notConfigured
        }

        await MainActor.run { isLoading = true }
        defer { Task { @MainActor in isLoading = false } }

        let response: ProjectListResponse = try await makeRequest(
            endpoint: "/api/repos",
            method: "GET"
        )

        await MainActor.run {
            self.projects = response.repos
        }
    }

    func cloneRepo(url: String, name: String? = nil, branch: String? = nil) async throws -> Project {
        guard settingsManager.isConfigured else {
            throw ReposError.notConfigured
        }

        let request = CloneRepoRequest(url: url, name: name, branch: branch)
        let project: Project = try await makeRequest(
            endpoint: "/api/repos",
            method: "POST",
            body: request
        )

        await MainActor.run {
            self.projects.append(project)
        }

        return project
    }

    func deleteProject(_ project: Project) async throws {
        guard settingsManager.isConfigured else {
            throw ReposError.notConfigured
        }

        let _: EmptyResponse = try await makeRequest(
            endpoint: "/api/repos/\(project.id)",
            method: "DELETE"
        )

        await MainActor.run {
            self.projects.removeAll { $0.id == project.id }
        }
    }

    func pullProject(_ project: Project) async throws {
        guard settingsManager.isConfigured else {
            throw ReposError.notConfigured
        }

        let _: EmptyResponse = try await makeRequest(
            endpoint: "/api/repos/\(project.id)/pull",
            method: "POST"
        )
    }

    // MARK: - Network

    private func makeRequest<T: Decodable>(
        endpoint: String,
        method: String,
        body: Encodable? = nil
    ) async throws -> T {
        guard let baseURL = settingsManager.serverURL,
              let url = URL(string: "\(baseURL)\(endpoint)") else {
            throw ReposError.invalidURL
        }

        guard let apiKey = settingsManager.apiKey else {
            throw ReposError.notConfigured
        }

        var request = URLRequest(url: url)
        request.httpMethod = method
        request.setValue(apiKey, forHTTPHeaderField: "x-api-key")
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")

        if let body = body {
            request.httpBody = try JSONEncoder().encode(body)
        }

        do {
            let (data, response) = try await URLSession.shared.data(for: request)

            guard let httpResponse = response as? HTTPURLResponse else {
                throw ReposError.networkError("Invalid response")
            }

            // Handle 204 No Content
            if httpResponse.statusCode == 204 {
                if T.self == EmptyResponse.self {
                    return EmptyResponse() as! T
                }
            }

            guard (200...299).contains(httpResponse.statusCode) else {
                let message = String(data: data, encoding: .utf8) ?? "Unknown error"
                throw ReposError.serverError(httpResponse.statusCode, message)
            }

            // Handle empty response
            if data.isEmpty {
                if T.self == EmptyResponse.self {
                    return EmptyResponse() as! T
                }
            }

            return try JSONDecoder().decode(T.self, from: data)

        } catch let error as ReposError {
            throw error
        } catch {
            throw ReposError.networkError(error.localizedDescription)
        }
    }
}

// MARK: - Helper Types

struct EmptyResponse: Decodable {
    init() {}
}
