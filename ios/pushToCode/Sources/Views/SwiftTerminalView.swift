import SwiftUI
import SwiftTerm

/// UIKit wrapper for SwiftTerm's TerminalView connected to WebSocket
class WebSocketTerminal: TerminalView, TerminalViewDelegate {
    private var onInput: ((String) -> Void)?

    init(frame: CGRect, onInput: @escaping (String) -> Void) {
        self.onInput = onInput
        super.init(frame: frame)
        self.terminalDelegate = self

        // Configure terminal appearance
        let fontSize: CGFloat = 14
        self.font = UIFont.monospacedSystemFont(ofSize: fontSize, weight: .regular)
        self.backgroundColor = UIColor.black

        // Set terminal colors (Solarized Dark inspired)
        self.nativeForegroundColor = UIColor.white
        self.nativeBackgroundColor = UIColor.black
    }

    required init?(coder: NSCoder) {
        fatalError("init(coder:) has not been implemented")
    }

    /// Feed raw PTY data to the terminal
    func feedData(_ data: String) {
        let bytes = Array(data.utf8)
        self.feed(byteArray: bytes)
    }

    /// Feed raw bytes to the terminal
    func feedBytes(_ data: Data) {
        self.feed(byteArray: Array(data))
    }

    // MARK: - TerminalViewDelegate

    func sizeChanged(source: TerminalView, newCols: Int, newRows: Int) {
        // Could notify backend of resize if needed
    }

    func setTerminalTitle(source: TerminalView, title: String) {
        // Could update navigation title
    }

    func send(source: TerminalView, data: ArraySlice<UInt8>) {
        // User typed something - send to WebSocket
        let str = String(bytes: data, encoding: .utf8) ?? ""
        onInput?(str)
    }

    func scrolled(source: TerminalView, position: Double) {
        // Handle scroll if needed
    }

    func hostCurrentDirectoryUpdate(source: TerminalView, directory: String?) {
        // Handle directory change notification
    }

    func requestOpenLink(source: TerminalView, link: String, params: [String : String]) {
        if let url = URL(string: link) {
            UIApplication.shared.open(url)
        }
    }

    func bell(source: TerminalView) {
        // Could play haptic feedback
        let generator = UINotificationFeedbackGenerator()
        generator.notificationOccurred(.warning)
    }
}

/// SwiftUI wrapper for WebSocketTerminal
struct SwiftTerminalView: UIViewRepresentable {
    @ObservedObject var viewModel: TerminalViewModel

    func makeUIView(context: Context) -> WebSocketTerminal {
        let terminal = WebSocketTerminal(frame: .zero) { input in
            // Send input to backend via WebSocket
            viewModel.sendRawInput(input)
        }

        context.coordinator.terminal = terminal
        context.coordinator.setupBindings(viewModel: viewModel)

        return terminal
    }

    func updateUIView(_ uiView: WebSocketTerminal, context: Context) {
        // Updates handled via Combine bindings in coordinator
    }

    func makeCoordinator() -> Coordinator {
        Coordinator()
    }

    class Coordinator {
        var terminal: WebSocketTerminal?
        private var cancellables = Set<AnyCancellable>()

        func setupBindings(viewModel: TerminalViewModel) {
            // Listen for PTY output and feed to terminal
            viewModel.$ptyOutput
                .receive(on: DispatchQueue.main)
                .sink { [weak self] output in
                    if !output.isEmpty {
                        self?.terminal?.feedData(output)
                    }
                }
                .store(in: &cancellables)
        }
    }
}

import Combine
