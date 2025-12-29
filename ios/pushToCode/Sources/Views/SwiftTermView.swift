import SwiftUI
import SwiftTerm

/// A SwiftUI wrapper around SwiftTerm's TerminalView for proper terminal emulation
struct SwiftTermView: UIViewRepresentable {
    @ObservedObject var viewModel: TerminalViewModel

    func makeUIView(context: Context) -> SwiftTerm.TerminalView {
        let terminalView = SwiftTerm.TerminalView(frame: .zero)

        // Set dark background
        terminalView.nativeBackgroundColor = .black
        terminalView.nativeForegroundColor = .white

        // Set font
        let fontSize: CGFloat = 13
        terminalView.font = UIFont.monospacedSystemFont(ofSize: fontSize, weight: .regular)

        // Set terminal size (cols x rows)
        terminalView.getTerminal().resize(cols: 120, rows: 30)

        // Store reference in coordinator
        context.coordinator.terminalView = terminalView

        return terminalView
    }

    func updateUIView(_ terminalView: SwiftTerm.TerminalView, context: Context) {
        // Feed new PTY data to terminal
        context.coordinator.processOutput(viewModel.ptyOutput, terminalView: terminalView)
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
