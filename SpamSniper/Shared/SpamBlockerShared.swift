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
    private static let selectedBlocklistsByRepositoryKey = "spamBlocker.selectedBlocklistsByRepository"
    private static let customRepositoryURLKey = "spamBlocker.customRepositoryURL"
    private static let repositoriesKey = "spamBlocker.repositories"
    private static let activeRepositoryIDKey = "spamBlocker.activeRepositoryID"
    private static let activeRepositoryURLKey = "spamBlocker.activeRepositoryURL"
    private static let trustedKeysKey = "spamBlocker.trustedKeys"

    // swiftlint:disable:next unused_declaration
    static var blockedNumbers: [Int64] {
        (try? BlocklistSyncService.fetchEffectiveSnapshot().blockedNumbers) ?? []
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
                persistRepositoriesIfNeeded(repos)
                return repos
            }
            // Migration: if a custom URL was previously saved, create a custom entry from it.
            if let legacy = customRepositoryURL {
                let migrated = [StoredRepository(validatedURL: legacy, repoName: "Custom Repository")]
                self.repositories = migrated
                customRepositoryURL = nil
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

    /// The stable id of the currently active repository. Returns `nil` when the built-in repo is active.
    static var activeRepositoryID: String? {
        get {
            if let stored = sharedDefaults.string(forKey: activeRepositoryIDKey), !stored.isEmpty {
                guard repositories.contains(where: { $0.id == stored }) else {
                    sharedDefaults.removeObject(forKey: activeRepositoryIDKey)
                    return nil
                }
                return stored
            }

            let migratedID = repositories.first { $0.urlString == legacyActiveRepositoryURLString }?.id
            if let migratedID {
                sharedDefaults.set(migratedID, forKey: activeRepositoryIDKey)
            }
            sharedDefaults.removeObject(forKey: activeRepositoryURLKey)
            return migratedID
        }
        set {
            if let newValue {
                sharedDefaults.set(newValue, forKey: activeRepositoryIDKey)
            } else {
                sharedDefaults.removeObject(forKey: activeRepositoryIDKey)
            }

            sharedDefaults.removeObject(forKey: activeRepositoryURLKey)
        }
    }

    /// Compatibility accessor for URL-based callers. The canonical persisted state is `activeRepositoryID`.
    static var activeRepositoryURL: URL? {
        get {
            activeRepositoryID.flatMap { id in
                repository(withID: id)?.resolvedURL
            }
        }
        set {
            guard let newValue else {
                activeRepositoryID = nil
                return
            }

            activeRepositoryID = repositories.first(where: { $0.urlString == newValue.absoluteString })?.id
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
        removeSelectedBlocklists(forRepositoryID: id)
        repositories = repositories.filter { $0.id != id }
        // If the active repo was removed, fall back to the built-in
        if activeRepositoryID == id {
            activeRepositoryID = nil
        }
    }

    /// Replace the stored entry that matches `updated.id` with `updated`.
    static func updateRepository(_ updated: StoredRepository) {
        guard !updated.isBuiltIn else { return }
        var current = repositories
        guard let index = current.firstIndex(where: { $0.id == updated.id }) else { return }
        current[index] = updated
        repositories = current
    }

    static func setActiveRepository(_ repo: StoredRepository?) {
        activeRepositoryID = repo?.isBuiltIn == true ? nil : repo?.id
    }

    // MARK: - Trusted Keys

    /// All trusted public keys. The built-in community key is always first and read-only.
    static var trustedKeys: [TrustedKey] {
        get {
            var keys: [TrustedKey] = []
            if let data = sharedDefaults.data(forKey: trustedKeysKey),
               let stored = try? JSONDecoder().decode([TrustedKey].self, from: data) {
                keys = stored
            }
            // Ensure the built-in key is always present (it's not persisted – derived from bundle)
            if !keys.contains(where: { $0.isBuiltIn }) {
                if let builtIn = builtInTrustedKey() {
                    keys.insert(builtIn, at: 0)
                }
            }
            return keys
        }
        set {
            // Never persist the built-in key entry
            let filtered = newValue.filter { !$0.isBuiltIn }
            if let data = try? JSONEncoder().encode(filtered) {
                sharedDefaults.set(data, forKey: trustedKeysKey)
            }
        }
    }

    static func addTrustedKey(_ key: TrustedKey) {
        guard !key.isBuiltIn else { return }
        var current = trustedKeys.filter { !$0.isBuiltIn }
        if !current.contains(where: { $0.id == key.id }) {
            current.append(key)
            trustedKeys = current
        }
    }

    static func removeTrustedKey(id: String) {
        trustedKeys = trustedKeys.filter { $0.id != id && !$0.isBuiltIn }
        // If any repo was associated with this key, clear the association
        let updated = repositories.map { repo -> StoredRepository in
            if repo.trustedKeyFingerprint == id {
                return repo.updating(trustedKeyFingerprint: .some(nil))
            }
            return repo
        }
        repositories = updated
    }

    static func isTrusted(fingerprint: String) -> Bool {
        trustedKeys.contains { $0.id.uppercased() == fingerprint.uppercased() }
    }

    private static func builtInTrustedKey() -> TrustedKey? {
        let bundles = [Bundle.main] + Bundle.allBundles + Bundle.allFrameworks
        guard let url = bundles.lazy.compactMap({
            $0.url(forResource: "spam-blocklist-trusted-public-key", withExtension: "asc")
        }).first,
              let armoredData = try? String(contentsOf: url, encoding: .utf8) else {
            return nil
        }

        // Use a stable well-known fingerprint placeholder; real fingerprint resolved at runtime
        // by BlocklistSignatureVerifier when needed.
        return TrustedKey(
            id: "BUILTIN",
            name: "SpamSniper Community Key",
            armoredData: armoredData,
            addedAt: Date(timeIntervalSince1970: 0),
            isBuiltIn: true
        )
    }

    static func selectedBlocklists(forRepositoryID repositoryID: String) -> [StoredBlocklistSelection] {
        selectedBlocklistsByRepository[repositoryID] ?? []
    }

    static func setSelectedBlocklists(_ selections: [StoredBlocklistSelection], forRepositoryID repositoryID: String) {
        var selectionMap = selectedBlocklistsByRepository
        let normalizedSelections = normalizedSelections(selections)

        if normalizedSelections.isEmpty {
            selectionMap.removeValue(forKey: repositoryID)
        } else {
            selectionMap[repositoryID] = normalizedSelections
        }

        selectedBlocklistsByRepository = selectionMap
    }

    static func removeSelectedBlocklists(forRepositoryID repositoryID: String) {
        var selectionMap = selectedBlocklistsByRepository
        selectionMap.removeValue(forKey: repositoryID)
        selectedBlocklistsByRepository = selectionMap
    }

    private static var legacySelectedBlocklist: StoredBlocklistSelection? {
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
            selectedBlocklists(forRepositoryID: currentSelectionRepositoryID)
        }
        set {
            setSelectedBlocklists(newValue, forRepositoryID: currentSelectionRepositoryID)
        }
    }

    private static var sharedDefaults: UserDefaults {
        guard let defaults = UserDefaults(suiteName: appGroupIdentifier) else {
            fatalError("Unable to create shared defaults for app group \(appGroupIdentifier)")
        }

        return defaults
    }

    private static func repository(withID id: String) -> StoredRepository? {
        repositories.first(where: { $0.id == id })
    }

    private static var currentSelectionRepositoryID: String {
        activeRepositoryID ?? StoredRepository.builtIn.id
    }

    private static var selectedBlocklistsByRepository: [String: [StoredBlocklistSelection]] {
        get {
            if let data = sharedDefaults.data(forKey: selectedBlocklistsByRepositoryKey),
               let storedSelections = try? JSONDecoder().decode([String: [StoredBlocklistSelection]].self, from: data) {
                let normalizedMap = normalizedSelectionMap(storedSelections)
                if normalizedMap != storedSelections {
                    persistSelectionMap(normalizedMap)
                }
                clearLegacySelectionStorageIfNeeded()
                return normalizedMap
            }

            guard let migratedSelections = legacySelectedBlocklists(), !migratedSelections.isEmpty else {
                return [:]
            }

            let migratedMap = [currentSelectionRepositoryID: normalizedSelections(migratedSelections)]
            persistSelectionMap(migratedMap)
            clearLegacySelectionStorageIfNeeded()
            return migratedMap
        }
        set {
            persistSelectionMap(normalizedSelectionMap(newValue))
            clearLegacySelectionStorageIfNeeded()
        }
    }

    private static var legacyActiveRepositoryURLString: String? {
        if let stored = sharedDefaults.string(forKey: activeRepositoryURLKey), !stored.isEmpty {
            return stored
        }

        return customRepositoryURL?.absoluteString
    }

    private static func persistRepositoriesIfNeeded(_ repositories: [StoredRepository]) {
        let hasLegacyID = repositories.contains { !$0.isBuiltIn && (URL(string: $0.id)?.scheme != nil || $0.id == $0.urlString) }
        guard hasLegacyID else { return }
        self.repositories = repositories
    }

    private static func legacySelectedBlocklists() -> [StoredBlocklistSelection]? {
        if let data = sharedDefaults.data(forKey: selectedBlocklistsKey),
           let selections = try? JSONDecoder().decode([StoredBlocklistSelection].self, from: data),
           !selections.isEmpty {
            return selections
        }

        if let legacySelection = legacySelectedBlocklist {
            return [legacySelection]
        }

        return nil
    }

    private static func persistSelectionMap(_ selectionMap: [String: [StoredBlocklistSelection]]) {
        if let data = try? JSONEncoder().encode(selectionMap), !selectionMap.isEmpty {
            sharedDefaults.set(data, forKey: selectedBlocklistsByRepositoryKey)
        } else {
            sharedDefaults.removeObject(forKey: selectedBlocklistsByRepositoryKey)
        }
    }

    private static func clearLegacySelectionStorageIfNeeded() {
        sharedDefaults.removeObject(forKey: selectedBlocklistsKey)
        sharedDefaults.removeObject(forKey: selectedBlocklistKey)
    }

    private static func normalizedSelectionMap(
        _ selectionMap: [String: [StoredBlocklistSelection]]
    ) -> [String: [StoredBlocklistSelection]] {
        selectionMap.reduce(into: [:]) { result, item in
            let repositoryID = item.key.trimmingCharacters(in: .whitespacesAndNewlines)
            let normalizedSelections = normalizedSelections(item.value)
            guard !repositoryID.isEmpty, !normalizedSelections.isEmpty else {
                return
            }

            result[repositoryID] = normalizedSelections
        }
    }

    private static func normalizedSelections(_ selections: [StoredBlocklistSelection]) -> [StoredBlocklistSelection] {
        Array(
            Dictionary(
                selections.map { ($0.id, $0) },
                uniquingKeysWith: { current, _ in current }
            ).values
        )
        .sorted { $0.title.localizedCaseInsensitiveCompare($1.title) == .orderedAscending }
    }
}
