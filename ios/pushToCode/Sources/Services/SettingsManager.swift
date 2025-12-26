import Foundation
import Security

final class SettingsManager: ObservableObject {
    static let shared = SettingsManager()

    private let keychainService = "com.pushtocode.app"

    private enum Keys {
        static let serverURL = "serverURL"
        static let apiKey = "apiKey"
    }

    @Published var serverURL: String? {
        didSet {
            if let value = serverURL {
                saveToKeychain(value, for: Keys.serverURL)
            } else {
                deleteFromKeychain(Keys.serverURL)
            }
        }
    }

    @Published var apiKey: String? {
        didSet {
            if let value = apiKey {
                saveToKeychain(value, for: Keys.apiKey)
            } else {
                deleteFromKeychain(Keys.apiKey)
            }
        }
    }

    init() {
        loadSettings()
    }

    private func loadSettings() {
        serverURL = loadFromKeychain(Keys.serverURL)
        apiKey = loadFromKeychain(Keys.apiKey)
    }

    // MARK: - Keychain Operations

    private func saveToKeychain(_ value: String, for key: String) {
        guard let data = value.data(using: .utf8) else { return }

        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: keychainService,
            kSecAttrAccount as String: key,
        ]

        // Delete existing item
        SecItemDelete(query as CFDictionary)

        // Add new item
        var newQuery = query
        newQuery[kSecValueData as String] = data
        newQuery[kSecAttrAccessible as String] = kSecAttrAccessibleWhenUnlockedThisDeviceOnly

        SecItemAdd(newQuery as CFDictionary, nil)
    }

    private func loadFromKeychain(_ key: String) -> String? {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: keychainService,
            kSecAttrAccount as String: key,
            kSecReturnData as String: true,
            kSecMatchLimit as String: kSecMatchLimitOne
        ]

        var result: AnyObject?
        let status = SecItemCopyMatching(query as CFDictionary, &result)

        guard status == errSecSuccess,
              let data = result as? Data,
              let value = String(data: data, encoding: .utf8) else {
            return nil
        }

        return value
    }

    private func deleteFromKeychain(_ key: String) {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: keychainService,
            kSecAttrAccount as String: key,
        ]

        SecItemDelete(query as CFDictionary)
    }

    // MARK: - Validation

    var isConfigured: Bool {
        serverURL != nil && !serverURL!.isEmpty &&
        apiKey != nil && !apiKey!.isEmpty
    }

    func clearAll() {
        serverURL = nil
        apiKey = nil
    }
}
