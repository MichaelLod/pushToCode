import SwiftUI

struct ProjectPickerView: View {
    @ObservedObject var reposService = ReposService.shared
    @Binding var selectedProject: Project?
    @State private var showingAddRepo = false

    var body: some View {
        Menu {
            // Project list
            ForEach(reposService.projects) { project in
                Button {
                    selectedProject = project
                } label: {
                    HStack {
                        Text(project.name)
                        if project.id == selectedProject?.id {
                            Image(systemName: "checkmark")
                        }
                    }
                }
            }

            if !reposService.projects.isEmpty {
                Divider()
            }

            // Add repo button
            Button {
                showingAddRepo = true
            } label: {
                Label("Add Repository", systemImage: "plus")
            }

            // Manage repos button
            NavigationLink {
                RepoManagerView()
            } label: {
                Label("Manage Repositories", systemImage: "folder")
            }

        } label: {
            HStack(spacing: 6) {
                Image(systemName: "folder.fill")
                    .font(.subheadline)
                    .foregroundColor(.blue)

                if let project = selectedProject {
                    Text(project.name)
                        .font(.subheadline)
                        .lineLimit(1)
                        .truncationMode(.middle)
                        .frame(maxWidth: 180)
                } else {
                    Text("Select")
                        .font(.subheadline)
                        .foregroundColor(.secondary)
                }

                Image(systemName: "chevron.down")
                    .font(.caption2)
                    .foregroundColor(.secondary)
            }
            .padding(.horizontal, 10)
            .padding(.vertical, 6)
            .background(Color(.secondarySystemBackground))
            .cornerRadius(6)
        }
        .sheet(isPresented: $showingAddRepo) {
            AddRepoView { project in
                selectedProject = project
            }
        }
        .task {
            try? await reposService.fetchProjects()
        }
    }
}

// MARK: - Add Repo View

struct AddRepoView: View {
    @Environment(\.dismiss) private var dismiss
    @ObservedObject var reposService = ReposService.shared

    @State private var repoURL = ""
    @State private var isLoadingRepos = false
    @State private var cloningRepoId: String?
    @State private var errorMessage: String?

    var onComplete: ((Project) -> Void)?

    var body: some View {
        NavigationStack {
            List {
                // Your Repositories section
                if isLoadingRepos {
                    Section {
                        HStack {
                            Spacer()
                            ProgressView()
                                .padding()
                            Spacer()
                        }
                    } header: {
                        Text("Your Repositories")
                    }
                } else if !reposService.availableRepos.isEmpty {
                    Section {
                        ForEach(reposService.availableRepos) { repo in
                            GitHubRepoRow(
                                repo: repo,
                                isCloning: cloningRepoId == repo.id,
                                isDisabled: cloningRepoId != nil && cloningRepoId != repo.id
                            ) {
                                cloneGitHubRepo(repo)
                            }
                        }
                    } header: {
                        Text("Your Repositories")
                    } footer: {
                        Text("Tap a repository to clone it")
                    }
                } else if errorMessage == nil {
                    Section {
                        Text("No repositories found")
                            .foregroundColor(.secondary)
                            .frame(maxWidth: .infinity, alignment: .center)
                            .padding()
                    } header: {
                        Text("Your Repositories")
                    } footer: {
                        Text("Make sure your GitHub token is configured correctly")
                    }
                }

                // Clone from URL section
                Section {
                    TextField("Repository URL", text: $repoURL)
                        .textContentType(.URL)
                        .autocapitalization(.none)
                        .autocorrectionDisabled()

                    Button {
                        cloneFromURL()
                    } label: {
                        if cloningRepoId == "url" {
                            HStack {
                                ProgressView()
                                    .padding(.trailing, 8)
                                Text("Cloning...")
                            }
                        } else {
                            Text("Clone")
                        }
                    }
                    .disabled(repoURL.isEmpty || cloningRepoId != nil)
                } header: {
                    Text("Clone from URL")
                } footer: {
                    Text("Enter a Git repository URL (HTTPS or SSH)")
                }

                // Error section
                if let error = errorMessage {
                    Section {
                        Text(error)
                            .foregroundColor(.red)
                    }
                }
            }
            .navigationTitle("Add Repository")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") {
                        dismiss()
                    }
                    .disabled(cloningRepoId != nil)
                }
            }
            .refreshable {
                await loadAvailableRepos()
            }
            .task {
                await loadAvailableRepos()
            }
        }
    }

    private func loadAvailableRepos() async {
        isLoadingRepos = true
        errorMessage = nil

        do {
            try await reposService.fetchAvailableRepos()
        } catch {
            errorMessage = error.localizedDescription
        }

        isLoadingRepos = false
    }

    private func cloneGitHubRepo(_ repo: GitHubRepo) {
        cloningRepoId = repo.id
        errorMessage = nil

        Task {
            do {
                let project = try await reposService.cloneRepo(url: repo.cloneUrl)

                await MainActor.run {
                    onComplete?(project)
                    dismiss()
                }
            } catch {
                await MainActor.run {
                    errorMessage = error.localizedDescription
                    cloningRepoId = nil
                }
            }
        }
    }

    private func cloneFromURL() {
        cloningRepoId = "url"
        errorMessage = nil

        Task {
            do {
                let project = try await reposService.cloneRepo(url: repoURL)

                await MainActor.run {
                    onComplete?(project)
                    dismiss()
                }
            } catch {
                await MainActor.run {
                    errorMessage = error.localizedDescription
                    cloningRepoId = nil
                }
            }
        }
    }
}

// MARK: - GitHub Repo Row

struct GitHubRepoRow: View {
    let repo: GitHubRepo
    let isCloning: Bool
    let isDisabled: Bool
    let onTap: () -> Void

    var body: some View {
        Button(action: onTap) {
            HStack {
                VStack(alignment: .leading, spacing: 4) {
                    HStack(spacing: 6) {
                        Text(repo.name)
                            .font(.body)
                            .foregroundColor(isDisabled ? .secondary : .primary)

                        if repo.isPrivate {
                            Image(systemName: "lock.fill")
                                .font(.caption)
                                .foregroundColor(.secondary)
                        }
                    }

                    if let description = repo.description, !description.isEmpty {
                        Text(description)
                            .font(.caption)
                            .foregroundColor(.secondary)
                            .lineLimit(2)
                    }
                }

                Spacer()

                if isCloning {
                    ProgressView()
                }
            }
        }
        .disabled(isDisabled)
    }
}

#Preview {
    ProjectPickerView(selectedProject: .constant(nil))
}
