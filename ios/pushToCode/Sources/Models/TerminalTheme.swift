import SwiftUI

/// Theme definitions for terminal rendering with ANSI color support
struct TerminalTheme {

    // MARK: - Theme Colors

    /// Dark theme background color (#1a1b26)
    static let darkBackground = Color(hex: 0x1a1b26)

    /// Default text foreground color (#c0caf5)
    static let textForeground = Color(hex: 0xc0caf5)

    /// Input bar background color (#24283b)
    static let inputBarBackground = Color(hex: 0x24283b)

    /// Alias for textForeground - default text color
    static let textColor = textForeground

    /// Cursor color (bright cyan for visibility)
    static let cursorColor = Color(hex: 0x7dcfff)

    // MARK: - Standard ANSI Colors (0-7)

    /// ANSI color 0: Black
    static let black = Color(hex: 0x414868)

    /// ANSI color 1: Red
    static let red = Color(hex: 0xf7768e)

    /// ANSI color 2: Green
    static let green = Color(hex: 0x9ece6a)

    /// ANSI color 3: Yellow
    static let yellow = Color(hex: 0xe0af68)

    /// ANSI color 4: Blue
    static let blue = Color(hex: 0x7aa2f7)

    /// ANSI color 5: Magenta
    static let magenta = Color(hex: 0xbb9af7)

    /// ANSI color 6: Cyan
    static let cyan = Color(hex: 0x7dcfff)

    /// ANSI color 7: White
    static let white = Color(hex: 0xa9b1d6)

    // MARK: - Bright ANSI Colors (8-15)

    /// ANSI color 8: Bright Black
    static let brightBlack = Color(hex: 0x414868)

    /// ANSI color 9: Bright Red
    static let brightRed = Color(hex: 0xf7768e)

    /// ANSI color 10: Bright Green
    static let brightGreen = Color(hex: 0x9ece6a)

    /// ANSI color 11: Bright Yellow
    static let brightYellow = Color(hex: 0xe0af68)

    /// ANSI color 12: Bright Blue
    static let brightBlue = Color(hex: 0x7aa2f7)

    /// ANSI color 13: Bright Magenta
    static let brightMagenta = Color(hex: 0xbb9af7)

    /// ANSI color 14: Bright Cyan
    static let brightCyan = Color(hex: 0x7dcfff)

    /// ANSI color 15: Bright White
    static let brightWhite = Color(hex: 0xc0caf5)

    // MARK: - Color Lookup

    /// Standard ANSI colors (0-7)
    static let standardColors: [Color] = [
        black, red, green, yellow, blue, magenta, cyan, white
    ]

    /// Bright ANSI colors (8-15)
    static let brightColors: [Color] = [
        brightBlack, brightRed, brightGreen, brightYellow,
        brightBlue, brightMagenta, brightCyan, brightWhite
    ]

    /// All 16 ANSI colors (0-15)
    static let allColors: [Color] = standardColors + brightColors

    /// Get ANSI color by index (0-15)
    /// - Parameter index: Color index (0-15)
    /// - Returns: The corresponding SwiftUI Color, or nil if index is out of range
    static func color(at index: Int) -> Color? {
        guard index >= 0 && index < 16 else { return nil }
        return allColors[index]
    }

    /// Get foreground color from SGR code (30-37 or 90-97)
    /// - Parameter code: SGR code for foreground color
    /// - Returns: The corresponding SwiftUI Color, or nil if code is not a foreground color
    static func foregroundColor(forSGR code: Int) -> Color? {
        switch code {
        case 30...37:
            return standardColors[code - 30]
        case 90...97:
            return brightColors[code - 90]
        default:
            return nil
        }
    }

    /// Get background color from SGR code (40-47 or 100-107)
    /// - Parameter code: SGR code for background color
    /// - Returns: The corresponding SwiftUI Color, or nil if code is not a background color
    static func backgroundColor(forSGR code: Int) -> Color? {
        switch code {
        case 40...47:
            return standardColors[code - 40]
        case 100...107:
            return brightColors[code - 100]
        default:
            return nil
        }
    }
}

// MARK: - Color Hex Initializer

extension Color {
    /// Initialize a Color from a hex value
    /// - Parameter hex: The hex color value (e.g., 0x1a1b26)
    init(hex: UInt32) {
        let red = Double((hex >> 16) & 0xFF) / 255.0
        let green = Double((hex >> 8) & 0xFF) / 255.0
        let blue = Double(hex & 0xFF) / 255.0
        self.init(red: red, green: green, blue: blue)
    }
}
