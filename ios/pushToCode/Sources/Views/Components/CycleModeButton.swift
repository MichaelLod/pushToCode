import SwiftUI

struct CycleModeButton: View {
    let onCycle: () -> Void

    private let impactFeedback = UIImpactFeedbackGenerator(style: .light)

    var body: some View {
        Button {
            impactFeedback.impactOccurred()
            onCycle()
        } label: {
            Image(systemName: "arrow.trianglehead.2.clockwise.rotate.90")
                .font(.system(size: 14, weight: .medium))
                .foregroundColor(.primary)
                .frame(width: 32, height: 32)
                .background(Color(.tertiarySystemBackground))
                .cornerRadius(16)
        }
        .accessibilityLabel("Cycle mode")
        .accessibilityHint("Sends shift-tab to cycle through Claude modes")
    }
}

#Preview {
    CycleModeButton {
        print("Cycle mode triggered")
    }
    .padding()
}
