//
//  SpamBlockerShared.swift
//  SpamSniper
//
//  Created by Codex on 3/19/26.
//

import Foundation

enum SpamBlockerShared {
    static let appGroupIdentifier = "group.com.vastorigins.app.SpamSniper.shared"
    static let extensionIdentifier = "com.vastorigins.app.SpamSniper.CallBlockerExtension"

    private static let isEnabledKey = "spamBlocker.isEnabled"
    private static let selectedBlocklistKey = "spamBlocker.selectedBlocklist"
    static var blockedNumbers: [Int64] {
        (try? BlocklistSyncService.fetchSnapshot().blockedNumbers) ?? []
    }

    static var isEnabled: Bool {
        get {
            if sharedDefaults.object(forKey: isEnabledKey) == nil {
                return true
            }

            return sharedDefaults.bool(forKey: isEnabledKey)
        }
        set {
            sharedDefaults.set(newValue, forKey: isEnabledKey)
        }
    }

    static func registerDefaults() {
        sharedDefaults.register(defaults: [
            isEnabledKey: true
        ])
    }

    static var selectedBlocklist: StoredBlocklistSelection? {
        get {
            guard let data = sharedDefaults.data(forKey: selectedBlocklistKey) else {
                return nil
            }

            return try? JSONDecoder().decode(StoredBlocklistSelection.self, from: data)
        }
        set {
            if let newValue, let data = try? JSONEncoder().encode(newValue) {
                sharedDefaults.set(data, forKey: selectedBlocklistKey)
            } else {
                sharedDefaults.removeObject(forKey: selectedBlocklistKey)
            }
        }
    }

    private static var sharedDefaults: UserDefaults {
        guard let defaults = UserDefaults(suiteName: appGroupIdentifier) else {
            fatalError("Unable to create shared defaults for app group \(appGroupIdentifier)")
        }

        return defaults
    }
}
