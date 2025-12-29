import SwiftUI

struct KeyboardControlsView: View {
    let onKeyPress: (String) -> Void

    private let impactFeedback = UIImpactFeedbackGenerator(style: .light)

    // Escape sequences
    private let escapeKey = "\u{1b}"
    private let upArrow = "\u{1b}[A"
    private let downArrow = "\u{1b}[B"
    private let leftArrow = "\u{1b}[D"
    private let rightArrow = "\u{1b}[C"
    private let enterKey = "\r"

    var body: some View {
        Menu {
            Button {
                impactFeedback.impactOccurred()
                onKeyPress(escapeKey)
            } label: {
                Label("ESC", systemImage: "escape")
            }

            Divider()

            Button {
                impactFeedback.impactOccurred()
                onKeyPress(upArrow)
            } label: {
                Label("Up", systemImage: "arrow.up")
            }

            Button {
                impactFeedback.impactOccurred()
                onKeyPress(downArrow)
            } label: {
                Label("Down", systemImage: "arrow.down")
            }

            Button {
                impactFeedback.impactOccurred()
                onKeyPress(leftArrow)
            } label: {
                Label("Left", systemImage: "arrow.left")
            }

            Button {
                impactFeedback.impactOccurred()
                onKeyPress(rightArrow)
            } label: {
                Label("Right", systemImage: "arrow.right")
            }

            Divider()

            Button {
                impactFeedback.impactOccurred()
                onKeyPress(enterKey)
            } label: {
                Label("Enter", systemImage: "return")
            }
        } label: {
            Image(systemName: "keyboard")
                .font(.system(size: 14, weight: .medium))
                .foregroundColor(.primary)
                .frame(width: 32, height: 32)
                .background(Color(.tertiarySystemBackground))
                .cornerRadius(16)
        }
        .accessibilityLabel("Keyboard controls")
    }
}

#Preview {
    KeyboardControlsView { key in
        print("Key pressed: \(key.debugDescription)")
    }
    .padding()
}
