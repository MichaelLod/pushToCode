import SwiftUI

struct TerminalView: View {
    @ObservedObject var viewModel: TerminalViewModel
    @State private var scrollProxy: ScrollViewProxy?
    @State private var showProjectPicker = false
    @State private var showVoiceRecorder = false
    @StateObject private var voiceRecorderViewModel = VoiceRecorderViewModel()

    var body: some View {
        VStack(spacing: 0) {
            // Connection Status Bar (slim, at top)
            ConnectionStatusView(
                state: connectionState,
                onTap: handleStatusTap,
                onRetry: { viewModel.connect() }
            )

            Divider()

            // Content Area: Messages, Loading, or Empty State
            if viewModel.isStartingSession && viewModel.session.messages.isEmpty {
                startingSessionView
            } else if viewModel.session.messages.isEmpty {
                emptyStateView
            } else {
                messagesListView
            }

            Divider()

            // Input Area (always at bottom)
            inputArea
        }
        .background(Color(.systemBackground))
        .onAppear {
            viewModel.connect()
        }
        .alert("Error", isPresented: .constant(viewModel.errorMessage != nil)) {
            Button("OK") {
                viewModel.errorMessage = nil
            }
        } message: {
            Text(viewModel.errorMessage ?? "")
        }
        .sheet(isPresented: $showProjectPicker) {
            ProjectSelectionView(
                selectedProjectPath: viewModel.session.projectPath,
                onSelect: { project in
                    viewModel.setProject(project)
                }
            )
        }
        .sheet(isPresented: $showVoiceRecorder) {
            VoiceRecorderSheet(
                viewModel: voiceRecorderViewModel,
                onTranscribe: { text in
                    // Append transcribed text to existing input
                    if viewModel.inputText.isEmpty {
                        viewModel.inputText = text
                    } else {
                        viewModel.inputText += " " + text
                    }
                }
            )
        }
        .alert("Authentication Required", isPresented: $viewModel.showAuthAlert) {
            Button("Open Browser") {
                viewModel.openAuthUrl()
            }
            Button("Cancel", role: .cancel) {}
        } message: {
            Text("Claude needs you to log in. Tap 'Open Browser' to authenticate.")
        }
        .sheet(isPresented: $viewModel.showAuthCodeInput) {
            AuthCodeInputView(viewModel: viewModel)
        }
    }

    // MARK: - Connection State

    private var connectionState: ConnectionState {
        // Check for error first
        if let error = viewModel.errorMessage {
            return .error(error)
        }

        // Map session status to connection state
        switch viewModel.session.status {
        case .connecting:
            return .connecting
        case .disconnected:
            return .disconnected
        case .running:
            return .running
        case .idle, .stopped:
            return viewModel.isConnected ? .connected : .disconnected
        }
    }

    private func handleStatusTap() {
        switch connectionState {
        case .disconnected:
            viewModel.connect()
        case .running:
            viewModel.stop()
        case .error:
            viewModel.errorMessage = nil
            viewModel.connect()
        default:
            break
        }
    }

    // MARK: - Starting Session View

    private var startingSessionView: some View {
        VStack(spacing: 20) {
            Spacer()

            ProgressView()
                .scaleEffect(1.5)

            Text("Starting Claude...")
                .font(.headline)
                .foregroundColor(.secondary)

            Text("Connecting to interactive session")
                .font(.subheadline)
                .foregroundColor(.secondary.opacity(0.7))

            Spacer()
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }

    // MARK: - Empty State View

    private var emptyStateView: some View {
        EmptyStateView(
            context: emptyStateContext,
            onSelectProject: { showProjectPicker = true },
            onPromptSelected: { prompt in
                viewModel.inputText = prompt
            }
        )
    }

    private var emptyStateContext: EmptyStateContext {
        if viewModel.session.projectPath == nil {
            return .noProject
        } else if viewModel.session.status == .connecting || !viewModel.isConnected {
            return .connecting
        } else {
            return .ready
        }
    }

    // MARK: - Messages List View

    private var messagesListView: some View {
        ScrollViewReader { proxy in
            ScrollView {
                LazyVStack(alignment: .leading, spacing: 12) {
                    ForEach(viewModel.session.messages) { message in
                        MessageRow(message: message)
                            .id(message.id)
                    }

                    // Show thinking indicator when Claude is processing
                    if viewModel.session.status == .running {
                        ThinkingIndicatorRow()
                            .id("thinking")
                    }
                }
                .padding()
            }
            .onChange(of: viewModel.session.messages.count) { _ in
                scrollToBottom(proxy: proxy)
            }
            .onChange(of: viewModel.session.status) { status in
                if status == .running {
                    // Scroll to thinking indicator
                    withAnimation(.easeOut(duration: 0.2)) {
                        proxy.scrollTo("thinking", anchor: .bottom)
                    }
                }
            }
            .onAppear {
                scrollProxy = proxy
            }
        }
    }

    // MARK: - Input Area

    private var inputArea: some View {
        VStack(spacing: 0) {
            HStack(spacing: 8) {
                TextField("Type command or prompt...", text: $viewModel.inputText, axis: .vertical)
                    .textFieldStyle(.plain)
                    .lineLimit(1...5)
                    .padding(.horizontal, 12)
                    .padding(.vertical, 8)
                    .background(Color(.secondarySystemBackground))
                    .cornerRadius(20)

            // Mic button for dictation
            Button {
                showVoiceRecorder = true
            } label: {
                Image(systemName: "mic.fill")
                    .font(.system(size: 18))
                    .foregroundColor(.white)
                    .frame(width: 36, height: 36)
                    .background(Color.blue)
                    .clipShape(Circle())
            }
            .accessibilityLabel("Voice input")

            // Send button
            Button {
                viewModel.sendPrompt(viewModel.inputText)
            } label: {
                Image(systemName: "arrow.up")
                    .font(.system(size: 18, weight: .semibold))
                    .foregroundColor(.white)
                    .frame(width: 36, height: 36)
                    .background(canSend ? Color.green : Color.gray.opacity(0.5))
                    .clipShape(Circle())
            }
            .disabled(!canSend)
            .accessibilityLabel("Send")
            }
            .padding()
        }
    }

    private var canSend: Bool {
        !viewModel.inputText.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty &&
        viewModel.session.projectPath != nil
    }

    private func scrollToBottom(proxy: ScrollViewProxy) {
        guard let lastMessage = viewModel.session.messages.last else { return }
        withAnimation(.easeOut(duration: 0.2)) {
            proxy.scrollTo(lastMessage.id, anchor: .bottom)
        }
    }
}

// MARK: - Auth Code Input View

struct AuthCodeInputView: View {
    @ObservedObject var viewModel: TerminalViewModel
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationView {
            VStack(spacing: 24) {
                Image(systemName: "key.fill")
                    .font(.system(size: 60))
                    .foregroundColor(.blue)

                Text("Enter Authentication Code")
                    .font(.title2)
                    .fontWeight(.semibold)

                Text("Copy the code from the browser and paste it below")
                    .font(.body)
                    .foregroundColor(.secondary)
                    .multilineTextAlignment(.center)
                    .padding(.horizontal)

                TextField("Paste code here...", text: $viewModel.authCode)
                    .textFieldStyle(.roundedBorder)
                    .font(.system(.body, design: .monospaced))
                    .autocapitalization(.none)
                    .disableAutocorrection(true)
                    .padding(.horizontal)

                if viewModel.isSubmittingAuthCode {
                    HStack {
                        ProgressView()
                        Text("Verifying...")
                            .foregroundColor(.secondary)
                    }
                }

                Button {
                    viewModel.submitAuthCode()
                } label: {
                    Text("Submit Code")
                        .fontWeight(.semibold)
                        .frame(maxWidth: .infinity)
                        .padding()
                        .background(viewModel.authCode.isEmpty ? Color.gray : Color.blue)
                        .foregroundColor(.white)
                        .cornerRadius(12)
                }
                .disabled(viewModel.authCode.isEmpty || viewModel.isSubmittingAuthCode)
                .padding(.horizontal)

                Spacer()
            }
            .padding(.top, 40)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") {
                        viewModel.cancelAuthCodeInput()
                        dismiss()
                    }
                }
            }
        }
    }
}

// MARK: - Thinking Indicator Row

struct ThinkingIndicatorRow: View {
    @State private var isAnimating = false

    var body: some View {
        HStack(alignment: .top, spacing: 12) {
            // Avatar
            Image(systemName: "cpu.fill")
                .font(.system(size: 20))
                .foregroundColor(.purple)
                .frame(width: 32, height: 32)
                .background(Color.purple.opacity(0.2))
                .cornerRadius(8)
                .accessibilityHidden(true)

            VStack(alignment: .leading, spacing: 4) {
                // Role label
                Text("Claude")
                    .font(.caption)
                    .fontWeight(.semibold)
                    .foregroundColor(.secondary)

                // Animated thinking dots
                HStack(spacing: 6) {
                    ForEach(0..<3) { index in
                        Circle()
                            .fill(Color.purple)
                            .frame(width: 8, height: 8)
                            .scaleEffect(isAnimating ? 1.0 : 0.6)
                            .opacity(isAnimating ? 1.0 : 0.4)
                            .animation(
                                .easeInOut(duration: 0.6)
                                .repeatForever(autoreverses: true)
                                .delay(Double(index) * 0.2),
                                value: isAnimating
                            )
                    }
                    Text("Thinking...")
                        .font(.callout)
                        .foregroundColor(.secondary)
                        .italic()
                }
                .padding(.vertical, 8)
            }

            Spacer()
        }
        .onAppear {
            isAnimating = true
        }
        .accessibilityLabel("Claude is thinking")
    }
}

// MARK: - Message Row

struct MessageRow: View {
    let message: Message

    var body: some View {
        HStack(alignment: .top, spacing: 12) {
            // Avatar
            Image(systemName: message.role == .user ? "person.fill" : "cpu.fill")
                .font(.system(size: 20))
                .foregroundColor(message.role == .user ? .blue : .purple)
                .frame(width: 32, height: 32)
                .background(
                    (message.role == .user ? Color.blue : Color.purple).opacity(0.2)
                )
                .cornerRadius(8)
                .accessibilityHidden(true)

            VStack(alignment: .leading, spacing: 4) {
                // Role label
                Text(message.role == .user ? "You" : "Claude")
                    .font(.caption)
                    .fontWeight(.semibold)
                    .foregroundColor(.secondary)

                // Content
                contentView
            }

            Spacer()
        }
        .accessibilityElement(children: .combine)
        .accessibilityLabel("\(message.role == .user ? "You" : "Claude") said: \(message.content)")
    }

    @ViewBuilder
    private var contentView: some View {
        switch message.outputType {
        case .text:
            if message.role == .assistant {
                // Terminal-style output for Claude
                Text(message.content)
                    .font(.system(size: 13, design: .monospaced))
                    .foregroundColor(.primary)
                    .textSelection(.enabled)
                    .padding(10)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .background(Color(.systemGray6))
                    .cornerRadius(8)
            } else {
                // User messages - normal style
                Text(message.content)
                    .font(.body)
                    .textSelection(.enabled)
            }

        case .codeBlock:
            ScrollView(.horizontal, showsIndicators: false) {
                Text(message.content)
                    .font(.system(.body, design: .monospaced))
                    .padding(12)
            }
            .background(Color(.tertiarySystemBackground))
            .cornerRadius(8)

        case .thinking:
            HStack {
                Image(systemName: "brain.head.profile")
                    .foregroundColor(.orange)
                Text(message.content)
                    .font(.callout)
                    .italic()
                    .foregroundColor(.secondary)
            }
            .padding(8)
            .background(Color.orange.opacity(0.1))
            .cornerRadius(8)

        case .fileChange:
            if let change = parseFileChange(message.content) {
                HStack {
                    Image(systemName: change.tool == "Write" ? "doc.badge.plus" : "pencil")
                        .foregroundColor(.green)
                    Text(change.file ?? "Unknown file")
                        .font(.callout)
                        .foregroundColor(.primary)
                }
                .padding(8)
                .background(Color.green.opacity(0.1))
                .cornerRadius(8)
            } else {
                Text(message.content)
                    .font(.callout)
            }
        }
    }

    private func parseFileChange(_ content: String) -> FileChange? {
        guard let data = content.data(using: .utf8) else { return nil }
        return try? JSONDecoder().decode(FileChange.self, from: data)
    }
}

#Preview {
    let session = Session(
        projectPath: "/path/to/project",
        messages: [
            Message(role: .user, content: "Hello, can you help me with a bug?"),
            Message(role: .assistant, content: "Of course! I'd be happy to help. What bug are you experiencing?")
        ]
    )
    return TerminalView(viewModel: TerminalViewModel(session: session))
}

#Preview("Empty State - No Project") {
    let session = Session()
    return TerminalView(viewModel: TerminalViewModel(session: session))
}

#Preview("Empty State - Ready") {
    let session = Session(projectPath: "/path/to/project")
    return TerminalView(viewModel: TerminalViewModel(session: session))
}
