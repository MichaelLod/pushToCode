import SwiftUI

struct KeyboardControlsView: View {
    let onKeyPress: (String) -> Void
    @State private var isExpanded = false

    private let impactFeedback = UIImpactFeedbackGenerator(style: .light)

    // Escape sequences
    private let escapeKey = "\u{1b}"
    private let upArrow = "\u{1b}[A"
    private let downArrow = "\u{1b}[B"
    private let leftArrow = "\u{1b}[D"
    private let rightArrow = "\u{1b}[C"
    private let enterKey = "\r"

    var body: some View {
        HStack(spacing: 6) {
            // Expandable content (shown on left when expanded)
            if isExpanded {
                HStack(spacing: 6) {
                    // ESC
                    keyButton(label: "ESC", icon: nil, key: escapeKey)
                        .accessibilityLabel("Escape key")

                    // Arrow keys
                    keyButton(label: nil, icon: "arrow.up", key: upArrow)
                        .accessibilityLabel("Up arrow")

                    keyButton(label: nil, icon: "arrow.down", key: downArrow)
                        .accessibilityLabel("Down arrow")

                    keyButton(label: nil, icon: "arrow.left", key: leftArrow)
                        .accessibilityLabel("Left arrow")

                    keyButton(label: nil, icon: "arrow.right", key: rightArrow)
                        .accessibilityLabel("Right arrow")

                    // Enter
                    keyButton(label: "↵", icon: nil, key: enterKey)
                        .accessibilityLabel("Return key")
                }
                .transition(.asymmetric(
                    insertion: .scale(scale: 0.8, anchor: .trailing).combined(with: .opacity),
                    removal: .scale(scale: 0.8, anchor: .trailing).combined(with: .opacity)
                ))
            }

            // Main toggle button
            Button {
                impactFeedback.impactOccurred()
                withAnimation(.spring(response: 0.3, dampingFraction: 0.7)) {
                    isExpanded.toggle()
                }
            } label: {
                Image(systemName: "keyboard")
                    .font(.system(size: 14, weight: .medium))
                    .foregroundColor(isExpanded ? .blue : .primary)
                    .frame(width: 32, height: 32)
                    .background(isExpanded ? Color.blue.opacity(0.15) : Color(.tertiarySystemBackground))
                    .cornerRadius(16)
            }
            .accessibilityLabel("Toggle keyboard controls")
        }
    }

    private func keyButton(label: String?, icon: String?, key: String) -> some View {
        Button {
            impactFeedback.impactOccurred()
            onKeyPress(key)
        } label: {
            Group {
                if let icon = icon {
                    Image(systemName: icon)
                        .font(.system(size: 14, weight: .medium))
                } else if let label = label {
                    Text(label)
                        .font(.system(size: 11, weight: .medium, design: .monospaced))
                }
            }
            .foregroundColor(.primary)
            .frame(minWidth: 32, minHeight: 32)
            .background(Color(.tertiarySystemBackground))
            .cornerRadius(16)
        }
    }
}

#Preview {
    KeyboardControlsView { key in
        print("Key pressed: \(key.debugDescription)")
    }
    .padding()
}
