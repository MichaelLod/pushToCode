import SwiftUI

struct AgentSelectorView: View {
    @Binding var inputText: String
    @State private var isExpanded = false

    private let impactFeedback = UIImpactFeedbackGenerator(style: .light)

    // Available agents
    private let agents = [
        ("strat", "Strategic advisor"),
        ("debug", "Bug detective"),
        ("mentor", "Business mentor"),
        ("patrol", "Code auditor"),
        ("cleaner", "Dead code removal")
    ]

    var body: some View {
        HStack(spacing: 6) {
            // Main toggle button
            Button {
                impactFeedback.impactOccurred()
                withAnimation(.spring(response: 0.3, dampingFraction: 0.7)) {
                    isExpanded.toggle()
                }
            } label: {
                Image(systemName: "at")
                    .font(.system(size: 14, weight: .bold))
                    .foregroundColor(isExpanded ? .blue : .primary)
                    .frame(width: 32, height: 32)
                    .background(isExpanded ? Color.blue.opacity(0.15) : Color(.tertiarySystemBackground))
                    .cornerRadius(16)
            }
            .accessibilityLabel("Agent selector")

            // Expandable agent pills
            if isExpanded {
                HStack(spacing: 6) {
                    ForEach(agents, id: \.0) { agent in
                        agentPill(name: agent.0, hint: agent.1)
                    }
                }
                .transition(.asymmetric(
                    insertion: .scale(scale: 0.8, anchor: .leading).combined(with: .opacity),
                    removal: .scale(scale: 0.8, anchor: .leading).combined(with: .opacity)
                ))
            }
        }
    }

    private func agentPill(name: String, hint: String) -> some View {
        Button {
            impactFeedback.impactOccurred()
            insertAgent(name)
            withAnimation(.spring(response: 0.3, dampingFraction: 0.7)) {
                isExpanded = false
            }
        } label: {
            Text(name)
                .font(.system(size: 11, weight: .medium))
                .foregroundColor(.primary)
                .padding(.horizontal, 8)
                .frame(height: 32)
                .background(Color(.tertiarySystemBackground))
                .cornerRadius(16)
        }
        .accessibilityLabel("@\(name)")
        .accessibilityHint(hint)
    }

    private func insertAgent(_ name: String) {
        let agentPrefix = "@\(name) "
        if inputText.isEmpty {
            inputText = agentPrefix
        } else if inputText.hasPrefix("@") {
            // Replace existing agent prefix
            if let spaceIndex = inputText.firstIndex(of: " ") {
                inputText = agentPrefix + String(inputText[inputText.index(after: spaceIndex)...])
            } else {
                inputText = agentPrefix
            }
        } else {
            inputText = agentPrefix + inputText
        }
    }
}

#Preview {
    struct PreviewWrapper: View {
        @State private var text = ""

        var body: some View {
            VStack(spacing: 20) {
                AgentSelectorView(inputText: $text)

                TextField("Input", text: $text)
                    .textFieldStyle(.roundedBorder)
                    .padding()
            }
            .padding()
        }
    }

    return PreviewWrapper()
}
