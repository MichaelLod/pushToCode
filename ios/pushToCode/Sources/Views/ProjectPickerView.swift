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
            HStack {
                Image(systemName: "folder.fill")
                    .foregroundColor(.blue)

                if let project = selectedProject {
                    Text(project.name)
                        .lineLimit(1)
                } else {
                    Text("Select Project")
                        .foregroundColor(.secondary)
                }

                Image(systemName: "chevron.down")
                    .font(.caption)
                    .foregroundColor(.secondary)
            }
            .padding(.horizontal, 12)
            .padding(.vertical, 8)
            .background(Color(.secondarySystemBackground))
            .cornerRadius(8)
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
    @State private var customName = ""
    @State private var branch = ""
    @State private var isLoading = false
    @State private var errorMessage: String?

    var onComplete: ((Project) -> Void)?

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    TextField("Repository URL", text: $repoURL)
                        .textContentType(.URL)
                        .autocapitalization(.none)
                        .autocorrectionDisabled()

                    TextField("Custom Name (optional)", text: $customName)
                        .autocapitalization(.none)
                        .autocorrectionDisabled()

                    TextField("Branch (optional)", text: $branch)
                        .autocapitalization(.none)
                        .autocorrectionDisabled()
                } header: {
                    Text("Repository Details")
                } footer: {
                    Text("Enter a Git repository URL (HTTPS or SSH)")
                }

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
                }

                ToolbarItem(placement: .confirmationAction) {
                    Button("Clone") {
                        cloneRepo()
                    }
                    .disabled(repoURL.isEmpty || isLoading)
                }
            }
            .overlay {
                if isLoading {
                    ProgressView("Cloning repository...")
                        .padding()
                        .background(Color(.systemBackground))
                        .cornerRadius(12)
                        .shadow(radius: 10)
                }
            }
        }
    }

    private func cloneRepo() {
        isLoading = true
        errorMessage = nil

        Task {
            do {
                let project = try await reposService.cloneRepo(
                    url: repoURL,
                    name: customName.isEmpty ? nil : customName,
                    branch: branch.isEmpty ? nil : branch
                )

                await MainActor.run {
                    onComplete?(project)
                    dismiss()
                }
            } catch {
                await MainActor.run {
                    errorMessage = error.localizedDescription
                    isLoading = false
                }
            }
        }
    }
}

#Preview {
    ProjectPickerView(selectedProject: .constant(nil))
}
