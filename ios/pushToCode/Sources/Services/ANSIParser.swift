import SwiftUI

/// Parser for ANSI escape sequences that converts PTY output to AttributedString
final class ANSIParser {

    // MARK: - Text Attributes State

    /// Current foreground color (nil means default)
    private var currentForeground: Color?

    /// Current background color (nil means default)
    private var currentBackground: Color?

    /// Whether bold is currently enabled
    private var isBold: Bool = false

    /// Whether italic is currently enabled
    private var isItalic: Bool = false

    /// Whether underline is currently enabled
    private var isUnderline: Bool = false

    // MARK: - Constants

    /// Escape character that starts ANSI sequences
    private static let escapeChar: Character = "\u{1b}"

    /// Monospace font for terminal text
    private static let terminalFont = Font.system(size: 13, design: .monospaced)

    // MARK: - Initialization

    init() {}

    // MARK: - Public API

    /// Parse raw PTY output containing ANSI escape sequences into an AttributedString
    /// - Parameter text: Raw text potentially containing ANSI escape sequences
    /// - Returns: Formatted AttributedString suitable for SwiftUI Text display
    func parse(_ text: String) -> AttributedString {
        var result = AttributedString()
        var currentText = ""
        var index = text.startIndex

        while index < text.endIndex {
            let char = text[index]

            if char == Self.escapeChar {
                // Flush accumulated text before processing escape sequence
                if !currentText.isEmpty {
                    result += createAttributedString(from: currentText)
                    currentText = ""
                }

                // Try to parse escape sequence
                if let (newIndex, codes) = parseEscapeSequence(from: text, startingAt: index) {
                    applySGRCodes(codes)
                    index = newIndex
                } else {
                    // Not a valid escape sequence, treat as regular character
                    currentText.append(char)
                    index = text.index(after: index)
                }
            } else {
                currentText.append(char)
                index = text.index(after: index)
            }
        }

        // Flush any remaining text
        if !currentText.isEmpty {
            result += createAttributedString(from: currentText)
        }

        return result
    }

    /// Reset the parser state to default values
    func reset() {
        currentForeground = nil
        currentBackground = nil
        isBold = false
        isItalic = false
        isUnderline = false
    }

    // MARK: - Private Methods

    /// Parse an escape sequence starting at the given index
    /// - Parameters:
    ///   - text: The full text
    ///   - startIndex: Index of the escape character
    /// - Returns: Tuple of (index after sequence, SGR codes) or nil if not a valid sequence
    private func parseEscapeSequence(
        from text: String,
        startingAt startIndex: String.Index
    ) -> (String.Index, [Int])? {
        var index = text.index(after: startIndex)

        // Check for CSI (Control Sequence Introducer): ESC[
        guard index < text.endIndex, text[index] == "[" else {
            return nil
        }

        index = text.index(after: index)

        // Collect parameter bytes (digits and semicolons)
        var parameterString = ""

        while index < text.endIndex {
            let char = text[index]

            if char.isNumber || char == ";" {
                parameterString.append(char)
                index = text.index(after: index)
            } else if char == "m" {
                // SGR (Select Graphic Rendition) sequence
                index = text.index(after: index)

                let codes = parseSGRParameters(parameterString)
                return (index, codes)
            } else {
                // Some other CSI sequence we don't handle - skip it
                index = text.index(after: index)
                return (index, [])
            }
        }

        return nil
    }

    /// Parse SGR parameter string into array of codes
    /// - Parameter parameterString: String like "1;31" or "0"
    /// - Returns: Array of integer codes
    private func parseSGRParameters(_ parameterString: String) -> [Int] {
        if parameterString.isEmpty {
            return [0]  // Empty parameter means reset
        }

        return parameterString
            .split(separator: ";")
            .compactMap { Int($0) }
    }

    /// Apply SGR codes to update the current text attributes
    /// - Parameter codes: Array of SGR codes to apply
    private func applySGRCodes(_ codes: [Int]) {
        for code in codes {
            switch code {
            case 0:
                // Reset all attributes
                reset()

            case 1:
                // Bold
                isBold = true

            case 3:
                // Italic
                isItalic = true

            case 4:
                // Underline
                isUnderline = true

            case 22:
                // Normal intensity (not bold)
                isBold = false

            case 23:
                // Not italic
                isItalic = false

            case 24:
                // Not underlined
                isUnderline = false

            case 30...37:
                // Standard foreground colors
                currentForeground = TerminalTheme.foregroundColor(forSGR: code)

            case 39:
                // Default foreground color
                currentForeground = nil

            case 40...47:
                // Standard background colors
                currentBackground = TerminalTheme.backgroundColor(forSGR: code)

            case 49:
                // Default background color
                currentBackground = nil

            case 90...97:
                // Bright foreground colors
                currentForeground = TerminalTheme.foregroundColor(forSGR: code)

            case 100...107:
                // Bright background colors
                currentBackground = TerminalTheme.backgroundColor(forSGR: code)

            default:
                // Ignore unsupported codes
                break
            }
        }
    }

    /// Create an AttributedString with current text attributes
    /// - Parameter text: The plain text content
    /// - Returns: AttributedString with current formatting applied
    private func createAttributedString(from text: String) -> AttributedString {
        var attributed = AttributedString(text)

        // Apply font
        var font = Self.terminalFont
        if isBold {
            font = font.bold()
        }
        if isItalic {
            font = font.italic()
        }
        attributed.font = font

        // Apply foreground color
        if let foreground = currentForeground {
            attributed.foregroundColor = foreground
        } else {
            attributed.foregroundColor = TerminalTheme.textForeground
        }

        // Apply background color
        if let background = currentBackground {
            attributed.backgroundColor = background
        }

        // Apply underline
        if isUnderline {
            attributed.underlineStyle = .single
        }

        return attributed
    }
}
