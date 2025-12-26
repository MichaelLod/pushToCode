import SwiftUI

@main
struct pushToCodeApp: App {
    @StateObject private var settingsManager = SettingsManager.shared

    var body: some Scene {
        WindowGroup {
            if settingsManager.isConfigured {
                SessionTabView()
            } else {
                OnboardingView()
            }
        }
    }
}

// MARK: - Onboarding View

struct OnboardingView: View {
    @ObservedObject var settingsManager = SettingsManager.shared
    @State private var serverURL = ""
    @State private var apiKey = ""
    @State private var isTesting = false
    @State private var errorMessage: String?

    var body: some View {
        NavigationStack {
            VStack(spacing: 32) {
                Spacer()

                // Logo
                VStack(spacing: 16) {
                    Image(systemName: "terminal.fill")
                        .font(.system(size: 64))
                        .foregroundColor(.blue)

                    Text("pushToCode")
                        .font(.largeTitle)
                        .fontWeight(.bold)

                    Text("Voice-first coding with Claude")
                        .font(.subheadline)
                        .foregroundColor(.secondary)
                }

                Spacer()

                // Configuration Form
                VStack(spacing: 16) {
                    VStack(alignment: .leading, spacing: 4) {
                        Text("Server URL")
                            .font(.caption)
                            .foregroundColor(.secondary)

                        TextField("https://your-server.com", text: $serverURL)
                            .textFieldStyle(.roundedBorder)
                            .textContentType(.URL)
                            .autocapitalization(.none)
                            .autocorrectionDisabled()
                    }

                    VStack(alignment: .leading, spacing: 4) {
                        Text("API Key")
                            .font(.caption)
                            .foregroundColor(.secondary)

                        SecureField("Enter your API key", text: $apiKey)
                            .textFieldStyle(.roundedBorder)
                    }

                    if let error = errorMessage {
                        Text(error)
                            .font(.caption)
                            .foregroundColor(.red)
                    }

                    Button {
                        connect()
                    } label: {
                        HStack {
                            if isTesting {
                                ProgressView()
                                    .progressViewStyle(CircularProgressViewStyle(tint: .white))
                            }
                            Text(isTesting ? "Connecting..." : "Connect")
                        }
                        .frame(maxWidth: .infinity)
                        .padding()
                        .background(canConnect ? Color.blue : Color.gray)
                        .foregroundColor(.white)
                        .cornerRadius(12)
                    }
                    .disabled(!canConnect || isTesting)
                }
                .padding(.horizontal, 32)

                Spacer()
            }
            .padding()
        }
    }

    private var canConnect: Bool {
        !serverURL.isEmpty && !apiKey.isEmpty
    }

    private func connect() {
        isTesting = true
        errorMessage = nil

        Task {
            do {
                let url = URL(string: "\(serverURL)/api/health")!
                var request = URLRequest(url: url)
                request.setValue(apiKey, forHTTPHeaderField: "x-api-key")
                request.timeoutInterval = 10

                let (_, response) = try await URLSession.shared.data(for: request)

                guard let httpResponse = response as? HTTPURLResponse,
                      httpResponse.statusCode == 200 else {
                    throw NSError(domain: "", code: 0, userInfo: [NSLocalizedDescriptionKey: "Server returned an error"])
                }

                await MainActor.run {
                    settingsManager.serverURL = serverURL
                    settingsManager.apiKey = apiKey
                }
            } catch {
                await MainActor.run {
                    errorMessage = "Connection failed: \(error.localizedDescription)"
                }
            }

            await MainActor.run {
                isTesting = false
            }
        }
    }
}

#Preview {
    OnboardingView()
}
