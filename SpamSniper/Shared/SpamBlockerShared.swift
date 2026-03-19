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
    private static let blockedNumbersKey = "spamBlocker.blockedNumbers"

    static let defaultBlockedNumbers: [Int64] = [
        1_408_555_1234,
        1_408_555_5678,
        1_650_555_0100,
        1_800_555_1212,
        1_877_555_0199
    ]

    static var blockedNumbers: [Int64] {
        let numbers = sharedDefaults.array(forKey: blockedNumbersKey) as? [Int64]
        let source = numbers?.isEmpty == false ? numbers! : defaultBlockedNumbers
        return source
            .filter { $0 > 0 }
            .sorted()
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
            isEnabledKey: true,
            blockedNumbersKey: defaultBlockedNumbers
        ])
    }

    private static var sharedDefaults: UserDefaults {
        guard let defaults = UserDefaults(suiteName: appGroupIdentifier) else {
            fatalError("Unable to create shared defaults for app group \(appGroupIdentifier)")
        }

        return defaults
    }
}
