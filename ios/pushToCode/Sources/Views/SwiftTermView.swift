import SwiftUI
import SwiftTerm

/// A SwiftUI wrapper around SwiftTerm's TerminalView for proper terminal emulation
struct SwiftTermView: UIViewRepresentable {
    @ObservedObject var viewModel: TerminalViewModel

    func makeUIView(context: Context) -> UIView {
        // Create a container view for proper sizing
        let containerView = UIView()
        containerView.backgroundColor = .black

        let terminalView = SwiftTerm.TerminalView(frame: .zero)
        terminalView.translatesAutoresizingMaskIntoConstraints = false

        // Sharp rendering settings
        terminalView.contentScaleFactor = UIScreen.main.scale
        terminalView.layer.contentsScale = UIScreen.main.scale
        terminalView.layer.rasterizationScale = UIScreen.main.scale
        terminalView.layer.shouldRasterize = false

        // Set dark background
        terminalView.nativeBackgroundColor = .black
        terminalView.nativeForegroundColor = .white

        // Set font - smaller for more content on screen
        let fontSize: CGFloat = 10
        terminalView.font = UIFont.monospacedSystemFont(ofSize: fontSize, weight: .regular)

        containerView.addSubview(terminalView)

        // Pin terminal view to container edges
        NSLayoutConstraint.activate([
            terminalView.topAnchor.constraint(equalTo: containerView.topAnchor),
            terminalView.bottomAnchor.constraint(equalTo: containerView.bottomAnchor),
            terminalView.leadingAnchor.constraint(equalTo: containerView.leadingAnchor),
            terminalView.trailingAnchor.constraint(equalTo: containerView.trailingAnchor)
        ])

        // Store reference in coordinator
        context.coordinator.terminalView = terminalView

        return containerView
    }

    func updateUIView(_ uiView: UIView, context: Context) {
        // Feed new PTY data to terminal
        if let terminalView = context.coordinator.terminalView {
            context.coordinator.processOutput(viewModel.ptyOutput, terminalView: terminalView)
        }
    }

    func makeCoordinator() -> Coordinator {
        Coordinator()
    }

    class Coordinator {
        weak var terminalView: SwiftTerm.TerminalView?
        private var lastProcessedLength = 0

        func processOutput(_ output: String, terminalView: SwiftTerm.TerminalView) {
            // Only process new data (delta)
            guard output.count > lastProcessedLength else {
                // Output was reset, clear terminal and reprocess
                if output.count < lastProcessedLength {
                    lastProcessedLength = 0
                    terminalView.getTerminal().resetToInitialState()
                }
                return
            }

            let startIndex = output.index(output.startIndex, offsetBy: lastProcessedLength)
            let newData = String(output[startIndex...])
            lastProcessedLength = output.count

            // Feed data to terminal
            if let data = newData.data(using: .utf8) {
                let byteArray = [UInt8](data)
                terminalView.feed(byteArray: ArraySlice(byteArray))
            }
        }

        func reset() {
            lastProcessedLength = 0
            terminalView?.getTerminal().resetToInitialState()
        }
    }
}

#Preview {
    SwiftTermView(viewModel: TerminalViewModel(session: Session()))
}
