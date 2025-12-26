import Foundation
import Combine

@MainActor
final class SessionsViewModel: ObservableObject {
    @Published var sessions: [Session] = []
    @Published var selectedSessionId: String?
    @Published var selectedProject: Project?

    private let webSocketService = WebSocketService.shared
    private let reposService = ReposService.shared
    private var cancellables = Set<AnyCancellable>()

    var selectedSession: Session? {
        sessions.first { $0.id == selectedSessionId }
    }

    var selectedSessionIndex: Int? {
        sessions.firstIndex { $0.id == selectedSessionId }
    }

    init() {
        // Create initial session
        createNewSession()

        setupBindings()
    }

    private func setupBindings() {
        reposService.$projects
            .receive(on: DispatchQueue.main)
            .sink { [weak self] projects in
                // Auto-select first project if none selected
                if self?.selectedProject == nil, let first = projects.first {
                    self?.selectProject(first)
                }
            }
            .store(in: &cancellables)
    }

    // MARK: - Session Management

    func createNewSession() {
        let session = Session(
            projectId: selectedProject?.id,
            projectPath: selectedProject?.path
        )
        sessions.append(session)
        selectedSessionId = session.id
    }

    func deleteSession(_ session: Session) {
        guard sessions.count > 1 else { return } // Keep at least one session

        sessions.removeAll { $0.id == session.id }

        // Select another session if the deleted one was selected
        if selectedSessionId == session.id {
            selectedSessionId = sessions.first?.id
        }
    }

    func selectSession(_ session: Session) {
        selectedSessionId = session.id
    }

    func updateSession(_ session: Session) {
        if let index = sessions.firstIndex(where: { $0.id == session.id }) {
            sessions[index] = session
        }
    }

    // MARK: - Project Selection

    func selectProject(_ project: Project) {
        selectedProject = project

        // Update current session with project
        if let index = selectedSessionIndex {
            sessions[index].projectId = project.id
            sessions[index].projectPath = project.path
        }
    }

    // MARK: - Computed Properties

    var hasMultipleSessions: Bool {
        sessions.count > 1
    }

    func sessionTitle(for session: Session) -> String {
        if let project = reposService.projects.first(where: { $0.id == session.projectId }) {
            return project.name
        }
        return "New Session"
    }
}
