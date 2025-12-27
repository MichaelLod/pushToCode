import SwiftUI

struct SessionTabView: View {
    @StateObject private var sessionsViewModel = SessionsViewModel()
    @State private var showingSettings = false

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
    let onSessionUpdate: (Session) -> Void

    @StateObject private var terminalViewModel: TerminalViewModel

    init(
        session: Session,
        selectedProject: Binding<Project?>,
        onSessionUpdate: @escaping (Session) -> Void
    ) {
        self.session = session
        self._selectedProject = selectedProject
        self.onSessionUpdate = onSessionUpdate
        self._terminalViewModel = StateObject(wrappedValue: TerminalViewModel(session: session))
    }

    var body: some View {
        TerminalView(viewModel: terminalViewModel)
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
    @ObservedObject var viewModel: VoiceRecorderViewModel
    let onTranscribe: (String) -> Void

    var body: some View {
        NavigationStack {
            VStack(spacing: 24) {
                Spacer()

                // Audio Visualizer
                ZStack {
                    Circle()
                        .fill(viewModel.isRecording ? Color.red.opacity(0.2) : Color.blue.opacity(0.1))
                        .frame(width: 140, height: 140)

                    if viewModel.isRecording {
                        ForEach(0..<3, id: \.self) { index in
                            Circle()
                                .stroke(Color.red.opacity(0.3), lineWidth: 2)
                                .frame(width: 140 + CGFloat(index) * 25, height: 140 + CGFloat(index) * 25)
                                .scaleEffect(1 + CGFloat(viewModel.audioLevel) * 0.3)
                                .animation(.easeInOut(duration: 0.1), value: viewModel.audioLevel)
                        }
                    }

                    Image(systemName: viewModel.isRecording ? "mic.fill" : "mic")
                        .font(.system(size: 50))
                        .foregroundColor(viewModel.isRecording ? .red : .blue)
                }

                // Status
                if viewModel.isRecording {
                    VStack(spacing: 8) {
                        HStack {
                            Circle().fill(Color.red).frame(width: 10, height: 10)
                            Text("Recording...").font(.headline).foregroundColor(.red)
                        }
                        Text(viewModel.formattedDuration)
                            .font(.system(.title2, design: .monospaced))
                            .foregroundColor(.secondary)
                    }
                } else if viewModel.isTranscribing {
                    HStack {
                        ProgressView()
                        Text("Transcribing...").font(.headline).foregroundColor(.blue)
                    }
                } else {
                    Text("Tap to record").font(.headline).foregroundColor(.secondary)
                }

                if let error = viewModel.errorMessage {
                    Text(error)
                        .font(.caption)
                        .foregroundColor(.red)
                        .multilineTextAlignment(.center)
                        .padding(.horizontal)
                }

                Spacer()

                // Single record/stop button
                Button {
                    if viewModel.isRecording {
                        viewModel.stopRecording()
                    } else {
                        viewModel.startRecording()
                    }
                } label: {
                    ZStack {
                        Circle()
                            .fill(viewModel.isRecording ? Color.red : Color.blue)
                            .frame(width: 72, height: 72)

                        if viewModel.isRecording {
                            RoundedRectangle(cornerRadius: 6)
                                .fill(Color.white)
                                .frame(width: 28, height: 28)
                        } else {
                            Circle()
                                .fill(Color.white)
                                .frame(width: 28, height: 28)
                        }
                    }
                }
                .disabled(viewModel.isTranscribing)

                Spacer().frame(height: 20)
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
                // Auto-start recording when sheet opens
                viewModel.startRecording()

                // Auto-append and dismiss when transcription completes
                viewModel.onTranscriptionComplete = { text in
                    onTranscribe(text)
                    dismiss()
                }
            }
            .alert("Microphone Access Required", isPresented: $viewModel.showPermissionAlert) {
                Button("Open Settings") {
                    if let url = URL(string: UIApplication.openSettingsURLString) {
                        UIApplication.shared.open(url)
                    }
                }
                Button("Cancel", role: .cancel) { dismiss() }
            } message: {
                Text("Please enable microphone access in Settings.")
            }
        }
        .presentationDetents([.medium])
    }
}

#Preview {
    SessionTabView()
}
