import SwiftUI

struct RepoManagerView: View {
    @ObservedObject var reposService = ReposService.shared
    @State private var showingAddRepo = false
    @State private var repoToDelete: Project?
    @State private var pullingRepo: String?
    @State private var errorMessage: String?

    var body: some View {
        List {
            if reposService.projects.isEmpty {
                emptyState
            } else {
                ForEach(reposService.projects) { project in
                    RepoRow(
                        project: project,
                        isPulling: pullingRepo == project.id,
                        onPull: { pullRepo(project) },
                        onDelete: { repoToDelete = project }
                    )
                }
            }
        }
        .navigationTitle("Repositories")
        .toolbar {
            ToolbarItem(placement: .primaryAction) {
                Button {
                    showingAddRepo = true
                } label: {
                    Image(systemName: "plus")
                }
            }
        }
        .sheet(isPresented: $showingAddRepo) {
            AddRepoView()
        }
        .alert("Delete Repository", isPresented: .constant(repoToDelete != nil)) {
            Button("Cancel", role: .cancel) {
                repoToDelete = nil
            }
            Button("Delete", role: .destructive) {
                if let repo = repoToDelete {
                    deleteRepo(repo)
                }
            }
        } message: {
            if let repo = repoToDelete {
                Text("Are you sure you want to delete '\(repo.name)'? This will remove all local files.")
            }
        }
        .alert("Error", isPresented: .constant(errorMessage != nil)) {
            Button("OK") {
                errorMessage = nil
            }
        } message: {
            Text(errorMessage ?? "")
        }
        .refreshable {
            try? await reposService.fetchProjects()
        }
        .task {
            try? await reposService.fetchProjects()
        }
    }

    private var emptyState: some View {
        VStack(spacing: 16) {
            Image(systemName: "folder.badge.questionmark")
                .font(.system(size: 48))
                .foregroundColor(.secondary)

            Text("No Repositories")
                .font(.headline)

            Text("Clone a repository to get started")
                .font(.subheadline)
                .foregroundColor(.secondary)

            Button {
                showingAddRepo = true
            } label: {
                Label("Add Repository", systemImage: "plus")
            }
            .buttonStyle(.borderedProminent)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .listRowBackground(Color.clear)
    }

    private func pullRepo(_ project: Project) {
        pullingRepo = project.id

        Task {
            do {
                try await reposService.pullProject(project)
            } catch {
                errorMessage = error.localizedDescription
            }
            pullingRepo = nil
        }
    }

    private func deleteRepo(_ project: Project) {
        Task {
            do {
                try await reposService.deleteProject(project)
            } catch {
                errorMessage = error.localizedDescription
            }
            repoToDelete = nil
        }
    }
}

// MARK: - Repo Row

struct RepoRow: View {
    let project: Project
    let isPulling: Bool
    let onPull: () -> Void
    let onDelete: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Image(systemName: "folder.fill")
                    .foregroundColor(.blue)

                Text(project.name)
                    .font(.headline)

                Spacer()

                if isPulling {
                    ProgressView()
                }
            }

            Text(project.path)
                .font(.caption)
                .foregroundColor(.secondary)
                .lineLimit(1)

            HStack {
                if let branch = project.branch {
                    Label(branch, systemImage: "arrow.triangle.branch")
                        .font(.caption)
                        .foregroundColor(.secondary)
                }

                Spacer()

                Text(project.createdAt, style: .relative)
                    .font(.caption2)
                    .foregroundColor(.secondary)
            }
        }
        .padding(.vertical, 4)
        .swipeActions(edge: .trailing) {
            Button(role: .destructive) {
                onDelete()
            } label: {
                Label("Delete", systemImage: "trash")
            }
        }
        .swipeActions(edge: .leading) {
            Button {
                onPull()
            } label: {
                Label("Pull", systemImage: "arrow.down.circle")
            }
            .tint(.blue)
        }
        .contextMenu {
            Button {
                onPull()
            } label: {
                Label("Pull Latest", systemImage: "arrow.down.circle")
            }

            Button {
                UIPasteboard.general.string = project.path
            } label: {
                Label("Copy Path", systemImage: "doc.on.doc")
            }

            Divider()

            Button(role: .destructive) {
                onDelete()
            } label: {
                Label("Delete", systemImage: "trash")
            }
        }
    }
}

#Preview {
    NavigationStack {
        RepoManagerView()
    }
}
