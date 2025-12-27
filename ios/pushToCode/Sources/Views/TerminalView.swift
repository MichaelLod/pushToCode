import SwiftUI

struct TerminalView: View {
    @ObservedObject var viewModel: TerminalViewModel
    var onShowVoiceRecorder: (() -> Void)?
    @State private var scrollProxy: ScrollViewProxy?
    @State private var showProjectPicker = false

    var body: some View {
        VStack(spacing: 0) {
            // Connection Status Bar (slim, at top)
            ConnectionStatusView(
                state: connectionState,
                onTap: handleStatusTap,
                onRetry: { viewModel.connect() }
            )

            Divider()

            // Content Area: Messages or Empty State
            if viewModel.session.messages.isEmpty {
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
                }
                .padding()
            }
            .onChange(of: viewModel.session.messages.count) { _ in
                scrollToBottom(proxy: proxy)
            }
            .onAppear {
                scrollProxy = proxy
            }
        }
    }

    // MARK: - Input Area

    private var inputArea: some View {
        HStack(spacing: 12) {
            TextField("Enter prompt...", text: $viewModel.inputText, axis: .vertical)
                .textFieldStyle(.plain)
                .lineLimit(1...5)
                .padding(.horizontal, 12)
                .padding(.vertical, 8)
                .background(Color(.secondarySystemBackground))
                .cornerRadius(20)

            // Smart button: mic when empty, send when has text
            if hasText {
                // Send button
                Button {
                    viewModel.sendPrompt(viewModel.inputText)
                } label: {
                    Image(systemName: "arrow.up.circle.fill")
                        .font(.system(size: 32))
                        .foregroundColor(canSend ? .blue : .gray)
                }
                .frame(minWidth: 44, minHeight: 44)
                .disabled(!canSend)
                .accessibilityLabel("Send prompt")
                .accessibilityHint(canSend ? "Double tap to send your message" : "Select a project to send")
            } else {
                // Mic button
                Button {
                    onShowVoiceRecorder?()
                } label: {
                    Image(systemName: "mic.circle.fill")
                        .font(.system(size: 32))
                        .foregroundColor(.blue)
                }
                .frame(minWidth: 44, minHeight: 44)
                .accessibilityLabel("Voice input")
                .accessibilityHint("Double tap to record voice input")
            }
        }
        .padding()
    }

    private var hasText: Bool {
        !viewModel.inputText.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
    }

    private var canSend: Bool {
        !viewModel.inputText.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty &&
        viewModel.session.projectPath != nil &&
        viewModel.session.status != .running
    }

    private func scrollToBottom(proxy: ScrollViewProxy) {
        guard let lastMessage = viewModel.session.messages.last else { return }
        withAnimation(.easeOut(duration: 0.2)) {
            proxy.scrollTo(lastMessage.id, anchor: .bottom)
        }
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
            Text(message.content)
                .font(.body)
                .textSelection(.enabled)

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
