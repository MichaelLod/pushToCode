import SwiftUI

struct SettingsView: View {
    @ObservedObject var settingsManager = SettingsManager.shared
    @ObservedObject var webSocketService = WebSocketService.shared

    @State private var serverURL: String = ""
    @State private var apiKey: String = ""
    @State private var showingAPIKey = false
    @State private var testResult: TestResult?
    @State private var isTesting = false

    enum TestResult {
        case success
        case failure(String)
    }

    var body: some View {
        Form {
            Section {
                VStack(alignment: .leading, spacing: 8) {
                    Text("Server URL")
                        .font(.caption)
                        .foregroundColor(.secondary)

                    TextField("https://your-server.com", text: $serverURL)
                        .textContentType(.URL)
                        .autocapitalization(.none)
                        .autocorrectionDisabled()
                        .keyboardType(.URL)
                }

                VStack(alignment: .leading, spacing: 8) {
                    Text("API Key")
                        .font(.caption)
                        .foregroundColor(.secondary)

                    HStack {
                        if showingAPIKey {
                            TextField("Enter API Key", text: $apiKey)
                                .autocapitalization(.none)
                                .autocorrectionDisabled()
                        } else {
                            SecureField("Enter API Key", text: $apiKey)
                        }

                        Button {
                            showingAPIKey.toggle()
                        } label: {
                            Image(systemName: showingAPIKey ? "eye.slash" : "eye")
                                .foregroundColor(.secondary)
                        }
                    }
                }
            } header: {
                Text("Server Configuration")
            } footer: {
                Text("Enter your pushToCode server URL and API key")
            }

            Section {
                Button {
                    saveSettings()
                } label: {
                    HStack {
                        Text("Save Settings")
                        Spacer()
                        if hasChanges {
                            Image(systemName: "circle.fill")
                                .font(.system(size: 8))
                                .foregroundColor(.orange)
                        }
                    }
                }
                .disabled(!hasChanges)

                Button {
                    testConnection()
                } label: {
                    HStack {
                        Text("Test Connection")
                        Spacer()
                        if isTesting {
                            ProgressView()
                        } else if let result = testResult {
                            switch result {
                            case .success:
                                Image(systemName: "checkmark.circle.fill")
                                    .foregroundColor(.green)
                            case .failure:
                                Image(systemName: "xmark.circle.fill")
                                    .foregroundColor(.red)
                            }
                        }
                    }
                }
                .disabled(!settingsManager.isConfigured || isTesting)
            }

            if case .failure(let message) = testResult {
                Section {
                    Text(message)
                        .foregroundColor(.red)
                        .font(.callout)
                }
            }

            Section {
                connectionStatus
            } header: {
                Text("Connection Status")
            }

            Section {
                NavigationLink {
                    RepoManagerView()
                } label: {
                    Label("Manage Repositories", systemImage: "folder")
                }
            }

            Section {
                Button(role: .destructive) {
                    clearSettings()
                } label: {
                    Text("Clear All Settings")
                }
            }

            Section {
                VStack(alignment: .leading, spacing: 4) {
                    Text("pushToCode")
                        .font(.headline)
                    Text("Version 1.0.0")
                        .font(.caption)
                        .foregroundColor(.secondary)
                }
            } header: {
                Text("About")
            }
        }
        .navigationTitle("Settings")
        .onAppear {
            serverURL = settingsManager.serverURL ?? ""
            apiKey = settingsManager.apiKey ?? ""
        }
    }

    private var connectionStatus: some View {
        HStack {
            Circle()
                .fill(webSocketService.isConnected ? Color.green : Color.red)
                .frame(width: 10, height: 10)

            if webSocketService.isConnected {
                Text("Connected")
            } else if webSocketService.isReconnecting {
                Text("Reconnecting...")
                    .foregroundColor(.orange)
            } else {
                Text("Disconnected")
                    .foregroundColor(.secondary)
            }
        }
    }

    private var hasChanges: Bool {
        serverURL != (settingsManager.serverURL ?? "") ||
        apiKey != (settingsManager.apiKey ?? "")
    }

    private func saveSettings() {
        settingsManager.serverURL = serverURL.isEmpty ? nil : serverURL
        settingsManager.apiKey = apiKey.isEmpty ? nil : apiKey
        testResult = nil
    }

    private func testConnection() {
        isTesting = true
        testResult = nil

        Task {
            do {
                guard let baseURL = settingsManager.serverURL else {
                    throw NSError(domain: "", code: 0, userInfo: [NSLocalizedDescriptionKey: "Server URL not set"])
                }

                guard let apiKey = settingsManager.apiKey else {
                    throw NSError(domain: "", code: 0, userInfo: [NSLocalizedDescriptionKey: "API key not set"])
                }

                let url = URL(string: "\(baseURL)/api/health")!
                var request = URLRequest(url: url)
                request.setValue(apiKey, forHTTPHeaderField: "x-api-key")
                request.timeoutInterval = 10

                let (_, response) = try await URLSession.shared.data(for: request)

                guard let httpResponse = response as? HTTPURLResponse else {
                    throw NSError(domain: "", code: 0, userInfo: [NSLocalizedDescriptionKey: "Invalid response"])
                }

                if httpResponse.statusCode == 200 {
                    await MainActor.run {
                        testResult = .success
                    }
                } else {
                    throw NSError(domain: "", code: httpResponse.statusCode, userInfo: [NSLocalizedDescriptionKey: "Server returned status \(httpResponse.statusCode)"])
                }
            } catch {
                await MainActor.run {
                    testResult = .failure(error.localizedDescription)
                }
            }

            await MainActor.run {
                isTesting = false
            }
        }
    }

    private func clearSettings() {
        settingsManager.clearAll()
        serverURL = ""
        apiKey = ""
        testResult = nil
    }
}

#Preview {
    NavigationStack {
        SettingsView()
    }
}
