import SwiftUI

struct SessionTabView: View {
    @StateObject private var sessionsViewModel = SessionsViewModel()
    @State private var showingSettings = false
    @State private var showingVoiceRecorder = false

    var body: some View {
        NavigationStack {
            VStack(spacing: 0) {
                // Session tabs
                if sessionsViewModel.hasMultipleSessions {
                    sessionTabBar
                }

                // Current session content
                if let session = sessionsViewModel.selectedSession {
                    SessionContentView(
                        session: session,
                        selectedProject: $sessionsViewModel.selectedProject,
                        onShowVoiceRecorder: { showingVoiceRecorder = true },
                        onSessionUpdate: { sessionsViewModel.updateSession($0) }
                    )
                } else {
                    emptyState
                }
            }
            .navigationTitle(currentTitle)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    ProjectPickerView(selectedProject: $sessionsViewModel.selectedProject)
                }

                ToolbarItem(placement: .topBarTrailing) {
                    HStack(spacing: 12) {
                        Button {
                            sessionsViewModel.createNewSession()
                        } label: {
                            Image(systemName: "plus.square")
                        }

                        Button {
                            showingSettings = true
                        } label: {
                            Image(systemName: "gear")
                        }
                    }
                }
            }
            .sheet(isPresented: $showingSettings) {
                NavigationStack {
                    SettingsView()
                }
            }
            .sheet(isPresented: $showingVoiceRecorder) {
                VoiceRecorderSheet(
                    selectedProject: sessionsViewModel.selectedProject,
                    onSend: { prompt in
                        if let session = sessionsViewModel.selectedSession {
                            let viewModel = TerminalViewModel(session: session)
                            viewModel.sendPrompt(prompt)
                            sessionsViewModel.updateSession(viewModel.session)
                        }
                    }
                )
            }
            .onChange(of: sessionsViewModel.selectedProject) { project in
                if let project = project {
                    sessionsViewModel.selectProject(project)
                }
            }
        }
    }

    private var currentTitle: String {
        if let session = sessionsViewModel.selectedSession {
            return sessionsViewModel.sessionTitle(for: session)
        }
        return "pushToCode"
    }

    private var sessionTabBar: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 8) {
                ForEach(sessionsViewModel.sessions) { session in
                    SessionTab(
                        session: session,
                        title: sessionsViewModel.sessionTitle(for: session),
                        isSelected: session.id == sessionsViewModel.selectedSessionId,
                        canClose: sessionsViewModel.hasMultipleSessions,
                        onSelect: { sessionsViewModel.selectSession(session) },
                        onClose: { sessionsViewModel.deleteSession(session) }
                    )
                }
            }
            .padding(.horizontal)
            .padding(.vertical, 8)
        }
        .background(Color(.secondarySystemBackground))
    }

    private var emptyState: some View {
        VStack(spacing: 16) {
            Image(systemName: "terminal")
                .font(.system(size: 48))
                .foregroundColor(.secondary)

            Text("No Session")
                .font(.headline)

            Button {
                sessionsViewModel.createNewSession()
            } label: {
                Label("New Session", systemImage: "plus")
            }
            .buttonStyle(.borderedProminent)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }
}

// MARK: - Session Tab

struct SessionTab: View {
    let session: Session
    let title: String
    let isSelected: Bool
    let canClose: Bool
    let onSelect: () -> Void
    let onClose: () -> Void

    var body: some View {
        Button(action: onSelect) {
            HStack(spacing: 4) {
                Circle()
                    .fill(statusColor)
                    .frame(width: 6, height: 6)

                Text(title)
                    .font(.callout)
                    .lineLimit(1)

                if canClose {
                    Button {
                        onClose()
                    } label: {
                        Image(systemName: "xmark")
                            .font(.caption2)
                            .foregroundColor(.secondary)
                    }
                }
            }
            .padding(.horizontal, 12)
            .padding(.vertical, 8)
            .background(isSelected ? Color(.tertiarySystemBackground) : Color.clear)
            .cornerRadius(8)
        }
        .foregroundColor(isSelected ? .primary : .secondary)
    }

    private var statusColor: Color {
        switch session.status {
        case .idle: return .gray
        case .running: return .blue
        case .stopped: return .orange
        case .connecting: return .yellow
        case .disconnected: return .red
        }
    }
}

// MARK: - Session Content View

struct SessionContentView: View {
    let session: Session
    @Binding var selectedProject: Project?
    let onShowVoiceRecorder: () -> Void
    let onSessionUpdate: (Session) -> Void

    @StateObject private var terminalViewModel: TerminalViewModel

    init(
        session: Session,
        selectedProject: Binding<Project?>,
        onShowVoiceRecorder: @escaping () -> Void,
        onSessionUpdate: @escaping (Session) -> Void
    ) {
        self.session = session
        self._selectedProject = selectedProject
        self.onShowVoiceRecorder = onShowVoiceRecorder
        self.onSessionUpdate = onSessionUpdate
        self._terminalViewModel = StateObject(wrappedValue: TerminalViewModel(session: session))
    }

    var body: some View {
        ZStack(alignment: .bottomTrailing) {
            TerminalView(viewModel: terminalViewModel)

            // Voice recorder FAB
            Button {
                onShowVoiceRecorder()
            } label: {
                Image(systemName: "mic.fill")
                    .font(.title2)
                    .foregroundColor(.white)
                    .frame(width: 56, height: 56)
                    .background(Color.blue)
                    .clipShape(Circle())
                    .shadow(radius: 4)
            }
            .padding()
        }
        .onChange(of: selectedProject) { project in
            if let project = project {
                terminalViewModel.setProject(project)
            }
        }
        .onChange(of: terminalViewModel.session) { updatedSession in
            onSessionUpdate(updatedSession)
        }
    }
}

// MARK: - Voice Recorder Sheet

struct VoiceRecorderSheet: View {
    @Environment(\.dismiss) private var dismiss
    @StateObject private var viewModel = VoiceRecorderViewModel()

    let selectedProject: Project?
    let onSend: (String) -> Void

    var body: some View {
        NavigationStack {
            VStack {
                if selectedProject == nil {
                    Text("Please select a project first")
                        .foregroundColor(.secondary)
                } else {
                    VoiceRecorderView(viewModel: viewModel)
                }
            }
            .padding()
            .navigationTitle("Voice Input")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") {
                        viewModel.cancelRecording()
                        dismiss()
                    }
                }
            }
            .onAppear {
                viewModel.onTranscriptionComplete = { text in
                    onSend(text)
                    dismiss()
                }
            }
        }
        .presentationDetents([.medium])
    }
}

#Preview {
    SessionTabView()
}
