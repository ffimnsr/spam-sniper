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
    private static let selectedBlocklistsKey = "spamBlocker.selectedBlocklists"
    private static let customRepositoryURLKey = "spamBlocker.customRepositoryURL"
    private static let repositoriesKey = "spamBlocker.repositories"
    private static let activeRepositoryURLKey = "spamBlocker.activeRepositoryURL"

    // swiftlint:disable:next unused_declaration
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

    static var customRepositoryURL: URL? {
        get {
            guard let value = sharedDefaults.string(forKey: customRepositoryURLKey),
                  let url = URL(string: value) else {
                return nil
            }

            return url
        }
        set {
            if let newValue {
                sharedDefaults.set(newValue.absoluteString, forKey: customRepositoryURLKey)
            } else {
                sharedDefaults.removeObject(forKey: customRepositoryURLKey)
            }
        }
    }

    // MARK: - Multi-repo support

    /// All saved repositories (excluding the built-in entry which is always implied).
    static var repositories: [StoredRepository] {
        get {
            if let data = sharedDefaults.data(forKey: repositoriesKey),
               let repos = try? JSONDecoder().decode([StoredRepository].self, from: data) {
                return repos
            }
            // Migration: if a custom URL was previously saved, create a custom entry from it.
            if let legacy = customRepositoryURL {
                let migrated = [StoredRepository(validatedURL: legacy, repoName: "Custom Repository")]
                self.repositories = migrated
                return migrated
            }
            return []
        }
        set {
            // Never persist the built-in entry in the list
            let filtered = newValue.filter { !$0.isBuiltIn }
            if let data = try? JSONEncoder().encode(filtered) {
                sharedDefaults.set(data, forKey: repositoriesKey)
            }
        }
    }

    /// The URL of the currently active repository. Returns `nil` when the built-in repo is active.
    static var activeRepositoryURL: URL? {
        get {
            // If an explicit active URL is stored, return it
            if let stored = sharedDefaults.string(forKey: activeRepositoryURLKey),
               !stored.isEmpty {
                return URL(string: stored)
            }
            // Migration: honour legacy customRepositoryURL
            return customRepositoryURL
        }
        set {
            if let newValue {
                sharedDefaults.set(newValue.absoluteString, forKey: activeRepositoryURLKey)
            } else {
                sharedDefaults.removeObject(forKey: activeRepositoryURLKey)
            }
        }
    }

    static func addRepository(_ repo: StoredRepository) {
        var current = repositories
        if !current.contains(where: { $0.urlString == repo.urlString }) {
            current.append(repo)
            repositories = current
        }
    }

    static func removeRepository(id: String) {
        repositories = repositories.filter { $0.id != id }
        // If the active repo was removed, fall back to the built-in
        if activeRepositoryURL?.absoluteString == id {
            activeRepositoryURL = nil
        }
    }

    /// Replace the stored entry that matches `updated.id` with `updated`.
    /// Also migrates the active URL if the entry being edited is currently active.
    static func updateRepository(_ updated: StoredRepository) {
        guard !updated.isBuiltIn else { return }
        var current = repositories
        guard let index = current.firstIndex(where: { $0.id == updated.id }) else { return }
        let wasActive = activeRepositoryURL?.absoluteString == current[index].urlString
        current[index] = updated
        repositories = current
        if wasActive {
            activeRepositoryURL = updated.resolvedURL
        }
    }

    static func setActiveRepository(_ repo: StoredRepository?) {
        activeRepositoryURL = repo?.isBuiltIn == true ? nil : repo?.resolvedURL
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

    static var selectedBlocklists: [StoredBlocklistSelection] {
        get {
            if let data = sharedDefaults.data(forKey: selectedBlocklistsKey),
               let selections = try? JSONDecoder().decode([StoredBlocklistSelection].self, from: data),
               !selections.isEmpty {
                return selections
            }

            if let legacySelection = selectedBlocklist {
                let selections = [legacySelection]
                self.selectedBlocklists = selections
                return selections
            }

            return []
        }
        set {
            let uniqueSelections = Array(
                Dictionary(
                    newValue.map { ($0.id, $0) },
                    uniquingKeysWith: { current, _ in current }
                ).values
            )
                .sorted { $0.title.localizedCaseInsensitiveCompare($1.title) == .orderedAscending }

            if let data = try? JSONEncoder().encode(uniqueSelections), !uniqueSelections.isEmpty {
                sharedDefaults.set(data, forKey: selectedBlocklistsKey)
                if let firstSelection = uniqueSelections.first,
                   let firstData = try? JSONEncoder().encode(firstSelection) {
                    sharedDefaults.set(firstData, forKey: selectedBlocklistKey)
                }
            } else {
                sharedDefaults.removeObject(forKey: selectedBlocklistsKey)
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
