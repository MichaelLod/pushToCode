import SwiftUI

struct TerminalView: View {
    @ObservedObject var viewModel: TerminalViewModel
    @State private var scrollProxy: ScrollViewProxy?

    var body: some View {
        VStack(spacing: 0) {
            // Messages List
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

            Divider()

            // Status Bar
            statusBar

            Divider()

            // Input Area
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
    }

    private var statusBar: some View {
        HStack {
            // Connection status
            HStack(spacing: 4) {
                Circle()
                    .fill(viewModel.isConnected ? Color.green : Color.red)
                    .frame(width: 8, height: 8)
                Text(viewModel.isConnected ? "Connected" : "Disconnected")
                    .font(.caption)
                    .foregroundColor(.secondary)
            }

            Spacer()

            // Session status
            Text(viewModel.session.status.rawValue.capitalized)
                .font(.caption)
                .foregroundColor(statusColor)
                .padding(.horizontal, 8)
                .padding(.vertical, 4)
                .background(statusColor.opacity(0.2))
                .cornerRadius(4)

            // Stop button
            if viewModel.session.status == .running {
                Button {
                    viewModel.stop()
                } label: {
                    Image(systemName: "stop.fill")
                        .foregroundColor(.red)
                }
            }
        }
        .padding(.horizontal)
        .padding(.vertical, 8)
        .background(Color(.secondarySystemBackground))
    }

    private var statusColor: Color {
        switch viewModel.session.status {
        case .idle: return .gray
        case .running: return .blue
        case .stopped: return .orange
        case .connecting: return .yellow
        case .disconnected: return .red
        }
    }

    private var inputArea: some View {
        HStack(spacing: 12) {
            TextField("Enter prompt...", text: $viewModel.inputText, axis: .vertical)
                .textFieldStyle(.plain)
                .lineLimit(1...5)
                .padding(.horizontal, 12)
                .padding(.vertical, 8)
                .background(Color(.secondarySystemBackground))
                .cornerRadius(20)

            Button {
                viewModel.sendPrompt(viewModel.inputText)
            } label: {
                Image(systemName: "arrow.up.circle.fill")
                    .font(.system(size: 32))
                    .foregroundColor(canSend ? .blue : .gray)
            }
            .disabled(!canSend)
        }
        .padding()
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
