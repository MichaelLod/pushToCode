import SwiftUI
import UIKit

// MARK: - Connection State

enum ConnectionState: Equatable {
    case disconnected
    case connecting
    case connected
    case running
    case error(String)

    var displayText: String {
        switch self {
        case .disconnected: return "Tap to connect"
        case .connecting: return "Connecting..."
        case .connected: return "Ready"
        case .running: return "Processing..."
        case .error: return "Connection failed"
        }
    }

    var accessibilityLabel: String {
        switch self {
        case .disconnected: return "Disconnected. Tap to connect"
        case .connecting: return "Connecting to server"
        case .connected: return "Connected and ready"
        case .running: return "Processing your request"
        case .error(let message): return "Connection failed: \(message). Tap to retry"
        }
    }

    var color: Color {
        switch self {
        case .disconnected: return .red
        case .connecting: return .orange
        case .connected: return .green
        case .running: return .blue
        case .error: return .red
        }
    }
}

// MARK: - ConnectionStatusView

struct ConnectionStatusView: View {
    let state: ConnectionState
    let onTap: () -> Void
    let onRetry: (() -> Void)?

    @State private var isPulsing = false
    @State private var previousState: ConnectionState?

    private let hapticFeedback = UIImpactFeedbackGenerator(style: .light)

    init(
        state: ConnectionState,
        onTap: @escaping () -> Void,
        onRetry: (() -> Void)? = nil
    ) {
        self.state = state
        self.onTap = onTap
        self.onRetry = onRetry
    }

    var body: some View {
        Button(action: handleTap) {
            HStack(spacing: 8) {
                // Status indicator
                statusIndicator

                // Status text
                Text(state.displayText)
                    .font(.subheadline)
                    .fontWeight(.medium)
                    .foregroundColor(.primary)

                Spacer()

                // Show retry button for error state
                if case .error = state {
                    Image(systemName: "arrow.clockwise")
                        .font(.subheadline)
                        .foregroundColor(.secondary)
                }

                // Show stop button when running
                if case .running = state {
                    Image(systemName: "stop.fill")
                        .font(.caption)
                        .foregroundColor(.red)
                }
            }
            .padding(.horizontal, 16)
            .frame(minHeight: 44)
            .background(Color(.secondarySystemBackground))
        }
        .buttonStyle(.plain)
        .accessibilityLabel(state.accessibilityLabel)
        .accessibilityHint(accessibilityHint)
        .accessibilityAddTraits(.isButton)
        .onChange(of: state) { newState in
            if previousState != newState {
                triggerHapticFeedback(for: newState)
                previousState = newState
            }
        }
        .onAppear {
            previousState = state
            startAnimationIfNeeded()
        }
    }

    // MARK: - Status Indicator

    @ViewBuilder
    private var statusIndicator: some View {
        ZStack {
            // Pulse animation ring for connected/running states
            if shouldPulse {
                Circle()
                    .fill(state.color.opacity(0.3))
                    .frame(width: 12, height: 12)
                    .scaleEffect(isPulsing ? 1.5 : 1.0)
                    .opacity(isPulsing ? 0.0 : 0.6)
                    .animation(
                        .easeInOut(duration: 1.5).repeatForever(autoreverses: false),
                        value: isPulsing
                    )
            }

            // Main indicator dot
            Circle()
                .fill(state.color)
                .frame(width: 8, height: 8)

            // Spinner overlay for connecting state
            if case .connecting = state {
                ProgressView()
                    .progressViewStyle(.circular)
                    .tint(.secondary)
                    .scaleEffect(0.6)
            }
        }
        .frame(width: 20, height: 20)
    }

    // MARK: - Helpers

    private var shouldPulse: Bool {
        switch state {
        case .connected, .running:
            return true
        default:
            return false
        }
    }

    private var accessibilityHint: String {
        switch state {
        case .disconnected:
            return "Double tap to connect"
        case .error:
            return "Double tap to retry connection"
        case .running:
            return "Double tap to stop"
        default:
            return ""
        }
    }

    private func handleTap() {
        switch state {
        case .disconnected:
            onTap()
        case .error:
            onRetry?() ?? onTap()
        case .running:
            onTap()
        default:
            break
        }
    }

    private func startAnimationIfNeeded() {
        if shouldPulse {
            isPulsing = true
        }
    }

    private func triggerHapticFeedback(for newState: ConnectionState) {
        hapticFeedback.prepare()

        switch newState {
        case .connected:
            // Success feedback
            let successFeedback = UINotificationFeedbackGenerator()
            successFeedback.notificationOccurred(.success)
        case .error:
            // Error feedback
            let errorFeedback = UINotificationFeedbackGenerator()
            errorFeedback.notificationOccurred(.error)
        case .running:
            // Light impact for running
            hapticFeedback.impactOccurred()
        default:
            // Light impact for other state changes
            hapticFeedback.impactOccurred(intensity: 0.5)
        }
    }
}

// MARK: - Preview

#Preview("Disconnected") {
    ConnectionStatusView(
        state: .disconnected,
        onTap: {}
    )
    .padding()
}

#Preview("Connecting") {
    ConnectionStatusView(
        state: .connecting,
        onTap: {}
    )
    .padding()
}

#Preview("Connected") {
    ConnectionStatusView(
        state: .connected,
        onTap: {}
    )
    .padding()
}

#Preview("Running") {
    ConnectionStatusView(
        state: .running,
        onTap: {}
    )
    .padding()
}

#Preview("Error") {
    ConnectionStatusView(
        state: .error("Server unreachable"),
        onTap: {},
        onRetry: {}
    )
    .padding()
}
