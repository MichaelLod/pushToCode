import SwiftUI

struct AgentSelectorView: View {
    @Binding var inputText: String

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
        Menu {
            ForEach(agents, id: \.0) { agent in
                Button {
                    impactFeedback.impactOccurred()
                    insertAgent(agent.0)
                } label: {
                    Text(agent.0)
                }
            }
        } label: {
            Image(systemName: "at")
                .font(.system(size: 14, weight: .bold))
                .foregroundColor(.primary)
                .frame(width: 32, height: 32)
                .background(Color(.tertiarySystemBackground))
                .cornerRadius(16)
        }
        .accessibilityLabel("Agent selector")
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
