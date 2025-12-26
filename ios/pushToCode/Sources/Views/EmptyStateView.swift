import SwiftUI

// MARK: - Empty State Context

enum EmptyStateContext {
    case noProject
    case connecting
    case ready

    var icon: String {
        switch self {
        case .noProject: return "folder"
        case .connecting: return "antenna.radiowaves.left.and.right"
        case .ready: return "waveform"
        }
    }

    var title: String {
        switch self {
        case .noProject: return "Select a Project"
        case .connecting: return "Connecting..."
        case .ready: return "Ready to Code"
        }
    }

    var subtitle: String {
        switch self {
        case .noProject: return "Choose a project folder to start coding with Claude"
        case .connecting: return "Establishing connection to server"
        case .ready: return "Ask Claude to help with your code"
        }
    }

    var accessibilityLabel: String {
        switch self {
        case .noProject: return "No project selected. Tap select project button to choose a project folder"
        case .connecting: return "Connecting to server. Please wait"
        case .ready: return "Ready to code. You can ask Claude for help or tap one of the suggested prompts below"
        }
    }
}

// MARK: - Prompt Card Model

struct PromptCard: Identifiable {
    let id = UUID()
    let title: String
    let description: String
    let prompt: String
    let icon: String

    static let suggestions: [PromptCard] = [
        PromptCard(
            title: "Fix a bug",
            description: "Find and fix errors in the code",
            prompt: "Help me find and fix bugs in this code",
            icon: "ladybug"
        ),
        PromptCard(
            title: "Add a feature",
            description: "Implement new functionality",
            prompt: "Help me add a new feature",
            icon: "plus.circle"
        ),
        PromptCard(
            title: "Refactor",
            description: "Improve code structure",
            prompt: "Help me refactor this code to improve its structure",
            icon: "arrow.triangle.2.circlepath"
        )
    ]
}

// MARK: - EmptyStateView

struct EmptyStateView: View {
    let context: EmptyStateContext
    let onSelectProject: (() -> Void)?
    let onPromptSelected: ((String) -> Void)?

    init(
        context: EmptyStateContext,
        onSelectProject: (() -> Void)? = nil,
        onPromptSelected: ((String) -> Void)? = nil
    ) {
        self.context = context
        self.onSelectProject = onSelectProject
        self.onPromptSelected = onPromptSelected
    }

    var body: some View {
        VStack(spacing: 24) {
            Spacer()

            // Icon
            iconView

            // Title and subtitle
            VStack(spacing: 8) {
                Text(context.title)
                    .font(.title2)
                    .fontWeight(.semibold)
                    .foregroundColor(.primary)
                    .multilineTextAlignment(.center)

                Text(context.subtitle)
                    .font(.subheadline)
                    .foregroundColor(.secondary)
                    .multilineTextAlignment(.center)
                    .padding(.horizontal, 32)
            }

            // Context-specific content
            contextContent

            Spacer()
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .accessibilityElement(children: .contain)
        .accessibilityLabel(context.accessibilityLabel)
    }

    // MARK: - Icon View

    @ViewBuilder
    private var iconView: some View {
        ZStack {
            Circle()
                .fill(iconBackgroundColor.opacity(0.15))
                .frame(width: 80, height: 80)

            if case .connecting = context {
                ProgressView()
                    .progressViewStyle(CircularProgressViewStyle(tint: .orange))
                    .scaleEffect(1.5)
            } else {
                Image(systemName: context.icon)
                    .font(.system(size: 32))
                    .foregroundColor(iconBackgroundColor)
            }
        }
        .accessibilityHidden(true)
    }

    private var iconBackgroundColor: Color {
        switch context {
        case .noProject: return .blue
        case .connecting: return .orange
        case .ready: return .green
        }
    }

    // MARK: - Context Content

    @ViewBuilder
    private var contextContent: some View {
        switch context {
        case .noProject:
            selectProjectButton

        case .connecting:
            // Just show the spinner in iconView
            EmptyView()

        case .ready:
            promptCardsSection
        }
    }

    // MARK: - Select Project Button

    private var selectProjectButton: some View {
        Button(action: { onSelectProject?() }) {
            HStack {
                Image(systemName: "folder.badge.plus")
                Text("Select Project")
            }
            .font(.headline)
            .foregroundColor(.white)
            .padding(.horizontal, 24)
            .frame(minHeight: 44)
            .background(Color.blue)
            .cornerRadius(12)
        }
        .accessibilityLabel("Select a project folder")
        .accessibilityHint("Opens the project picker to choose a folder")
    }

    // MARK: - Prompt Cards Section

    private var promptCardsSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Try asking")
                .font(.caption)
                .fontWeight(.medium)
                .foregroundColor(.secondary)
                .padding(.horizontal, 24)

            VStack(spacing: 8) {
                ForEach(PromptCard.suggestions) { card in
                    PromptCardView(card: card) {
                        onPromptSelected?(card.prompt)
                    }
                }
            }
            .padding(.horizontal, 16)
        }
    }
}

// MARK: - Prompt Card View

struct PromptCardView: View {
    let card: PromptCard
    let onTap: () -> Void

    var body: some View {
        Button(action: onTap) {
            HStack(spacing: 12) {
                // Icon
                Image(systemName: card.icon)
                    .font(.system(size: 18))
                    .foregroundColor(.blue)
                    .frame(width: 32, height: 32)
                    .background(Color.blue.opacity(0.1))
                    .cornerRadius(8)

                // Text content
                VStack(alignment: .leading, spacing: 2) {
                    Text(card.title)
                        .font(.subheadline)
                        .fontWeight(.medium)
                        .foregroundColor(.primary)

                    Text(card.description)
                        .font(.caption)
                        .foregroundColor(.secondary)
                        .lineLimit(1)
                }

                Spacer()

                // Chevron
                Image(systemName: "chevron.right")
                    .font(.caption)
                    .foregroundColor(.secondary)
            }
            .padding(.horizontal, 12)
            .frame(minHeight: 44)
            .background(Color(.secondarySystemBackground))
            .cornerRadius(10)
        }
        .buttonStyle(.plain)
        .accessibilityLabel(card.title)
        .accessibilityHint(card.description)
        .accessibilityAddTraits(.isButton)
    }
}

// MARK: - Previews

#Preview("No Project") {
    EmptyStateView(
        context: .noProject,
        onSelectProject: {}
    )
}

#Preview("Connecting") {
    EmptyStateView(
        context: .connecting
    )
}

#Preview("Ready") {
    EmptyStateView(
        context: .ready,
        onPromptSelected: { prompt in
            print("Selected: \(prompt)")
        }
    )
}
