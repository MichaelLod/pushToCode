import SwiftUI

/// A sheet-style view for selecting a project from the list of cloned repositories
struct ProjectSelectionView: View {
    @Environment(\.dismiss) private var dismiss
    @ObservedObject var reposService = ReposService.shared

    let selectedProjectPath: String?
    let onSelect: (Project) -> Void

    @State private var showingAddRepo = false

    var body: some View {
        NavigationStack {
            List {
                if reposService.projects.isEmpty {
                    emptyState
                } else {
                    ForEach(reposService.projects) { project in
                        ProjectSelectionRow(
                            project: project,
                            isSelected: project.path == selectedProjectPath,
                            onSelect: {
                                onSelect(project)
                                dismiss()
                            }
                        )
                    }
                }
            }
            .navigationTitle("Select Project")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") {
                        dismiss()
                    }
                }

                ToolbarItem(placement: .primaryAction) {
                    Button {
                        showingAddRepo = true
                    } label: {
                        Image(systemName: "plus")
                    }
                    .accessibilityLabel("Add repository")
                }
            }
            .sheet(isPresented: $showingAddRepo) {
                AddRepoView { project in
                    onSelect(project)
                    dismiss()
                }
            }
            .task {
                try? await reposService.fetchProjects()
            }
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
        .frame(maxWidth: .infinity)
        .padding(.vertical, 48)
        .listRowBackground(Color.clear)
        .accessibilityElement(children: .contain)
    }
}

// MARK: - Project Selection Row

struct ProjectSelectionRow: View {
    let project: Project
    let isSelected: Bool
    let onSelect: () -> Void

    var body: some View {
        Button(action: onSelect) {
            HStack(spacing: 12) {
                // Folder icon
                Image(systemName: "folder.fill")
                    .font(.title2)
                    .foregroundColor(.blue)
                    .frame(width: 32, height: 32)

                // Project details
                VStack(alignment: .leading, spacing: 2) {
                    Text(project.name)
                        .font(.body)
                        .fontWeight(.medium)
                        .foregroundColor(.primary)

                    if let branch = project.branch {
                        HStack(spacing: 4) {
                            Image(systemName: "arrow.triangle.branch")
                            Text(branch)
                        }
                        .font(.caption)
                        .foregroundColor(.secondary)
                    }
                }

                Spacer()

                // Selection checkmark
                if isSelected {
                    Image(systemName: "checkmark.circle.fill")
                        .foregroundColor(.blue)
                        .font(.title3)
                }
            }
            .padding(.vertical, 4)
            .frame(minHeight: 44)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityLabel("\(project.name)\(isSelected ? ", selected" : "")")
        .accessibilityHint("Double tap to select this project")
        .accessibilityAddTraits(isSelected ? [.isButton, .isSelected] : .isButton)
    }
}

#Preview {
    ProjectSelectionView(
        selectedProjectPath: nil,
        onSelect: { _ in }
    )
}
