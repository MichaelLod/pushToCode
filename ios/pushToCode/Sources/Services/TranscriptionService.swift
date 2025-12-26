import Foundation

struct TranscriptionResponse: Codable {
    let text: String
    let duration: Double?
    let language: String?
}

enum TranscriptionError: Error, LocalizedError {
    case invalidURL
    case networkError(String)
    case serverError(Int, String)
    case noAudioData

    var errorDescription: String? {
        switch self {
        case .invalidURL:
            return "Invalid server URL"
        case .networkError(let reason):
            return "Network error: \(reason)"
        case .serverError(let code, let message):
            return "Server error (\(code)): \(message)"
        case .noAudioData:
            return "No audio data to transcribe"
        }
    }
}

final class TranscriptionService: ObservableObject {
    static let shared = TranscriptionService()

    @Published private(set) var isTranscribing = false

    private let settingsManager = SettingsManager.shared

    func transcribe(audioData: Data, filename: String = "recording.m4a") async throws -> String {
        guard let baseURL = settingsManager.serverURL else {
            throw TranscriptionError.invalidURL
        }

        guard let apiKey = settingsManager.apiKey else {
            throw TranscriptionError.networkError("API key not configured")
        }

        guard !audioData.isEmpty else {
            throw TranscriptionError.noAudioData
        }

        let url = URL(string: "\(baseURL)/api/transcribe")!

        await MainActor.run {
            isTranscribing = true
        }

        defer {
            Task { @MainActor in
                isTranscribing = false
            }
        }

        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue(apiKey, forHTTPHeaderField: "x-api-key")

        let boundary = UUID().uuidString
        request.setValue("multipart/form-data; boundary=\(boundary)", forHTTPHeaderField: "Content-Type")

        var body = Data()

        // Add audio file
        body.append("--\(boundary)\r\n".data(using: .utf8)!)
        body.append("Content-Disposition: form-data; name=\"audio\"; filename=\"\(filename)\"\r\n".data(using: .utf8)!)
        body.append("Content-Type: audio/m4a\r\n\r\n".data(using: .utf8)!)
        body.append(audioData)
        body.append("\r\n".data(using: .utf8)!)

        // End boundary
        body.append("--\(boundary)--\r\n".data(using: .utf8)!)

        request.httpBody = body

        do {
            let (data, response) = try await URLSession.shared.data(for: request)

            guard let httpResponse = response as? HTTPURLResponse else {
                throw TranscriptionError.networkError("Invalid response")
            }

            if httpResponse.statusCode != 200 {
                let message = String(data: data, encoding: .utf8) ?? "Unknown error"
                throw TranscriptionError.serverError(httpResponse.statusCode, message)
            }

            let transcription = try JSONDecoder().decode(TranscriptionResponse.self, from: data)
            return transcription.text

        } catch let error as TranscriptionError {
            throw error
        } catch {
            throw TranscriptionError.networkError(error.localizedDescription)
        }
    }
}
