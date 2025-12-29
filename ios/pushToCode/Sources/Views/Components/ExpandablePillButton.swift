import SwiftUI

struct ExpandablePillButton<Content: View>: View {
    let icon: String
    @Binding var isExpanded: Bool
    let content: () -> Content

    private let impactFeedback = UIImpactFeedbackGenerator(style: .light)

    var body: some View {
        HStack(spacing: 8) {
            // Main toggle button
            Button {
                impactFeedback.impactOccurred()
                withAnimation(.spring(response: 0.3, dampingFraction: 0.7)) {
                    isExpanded.toggle()
                }
            } label: {
                Image(systemName: icon)
                    .font(.system(size: 14, weight: .medium))
                    .foregroundColor(.primary)
                    .frame(width: 32, height: 32)
                    .background(Color(.tertiarySystemBackground))
                    .cornerRadius(16)
            }

            // Expandable content
            if isExpanded {
                content()
                    .transition(.asymmetric(
                        insertion: .scale(scale: 0.8, anchor: .leading).combined(with: .opacity),
                        removal: .scale(scale: 0.8, anchor: .leading).combined(with: .opacity)
                    ))
            }
        }
    }
}

// MARK: - Pill Button Style

struct PillButton: View {
    let label: String?
    let icon: String?
    let action: () -> Void
    var isActive: Bool = false

    private let impactFeedback = UIImpactFeedbackGenerator(style: .light)

    var body: some View {
        Button {
            impactFeedback.impactOccurred()
            action()
        } label: {
            Group {
                if let icon = icon {
                    Image(systemName: icon)
                        .font(.system(size: 14, weight: .medium))
                } else if let label = label {
                    Text(label)
                        .font(.system(size: 12, weight: .medium, design: .monospaced))
                }
            }
            .foregroundColor(isActive ? .blue : .primary)
            .frame(minWidth: 32, minHeight: 32)
            .padding(.horizontal, 6)
            .background(isActive ? Color.blue.opacity(0.15) : Color(.tertiarySystemBackground))
            .cornerRadius(16)
        }
    }
}

#Preview {
    struct PreviewWrapper: View {
        @State private var isExpanded = false

        var body: some View {
            VStack(spacing: 20) {
                ExpandablePillButton(icon: "keyboard", isExpanded: $isExpanded) {
                    HStack(spacing: 6) {
                        PillButton(label: "ESC", icon: nil) {}
                        PillButton(label: nil, icon: "arrow.up") {}
                        PillButton(label: nil, icon: "arrow.down") {}
                    }
                }

                Text("Expanded: \(isExpanded ? "Yes" : "No")")
            }
            .padding()
        }
    }

    return PreviewWrapper()
}
