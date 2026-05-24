//
//  SpamBlockerModel+Support.swift
//  SpamSniper
//

import CallKit
import Foundation

struct RefreshCoordinatorResult {
    let repositoryFetch: RepositoryFetchResult
    let resolvedSelections: [StoredBlocklistSelection]
    let signatureStatus: String
    let databaseSummary: BlocklistDatabaseSummary
    let effectiveSnapshot: EffectiveBlocklistSnapshot
    let extensionStatus: SpamBlockerModel.ExtensionStatus

    var repository: BlocklistRepositoryDocument {
        repositoryFetch.document
    }
}

struct ManualSyncStatus: Equatable {
    enum Style: Equatable {
        case success
        case warning
        case failure
    }

    let title: String
    let message: String
    let style: Style
    let recordedAt: Date
}

struct RepositoryKeyStatus: Equatable {
    enum State: Equatable {
        case builtIn
        case trusted
        case untrusted
        case missing
    }

    let state: State
    let title: String
    let detail: String
    let fingerprint: String?

    var isWarning: Bool {
        switch state {
        case .trusted, .builtIn:
            return false
        case .untrusted, .missing:
            return true
        }
    }
}

struct RepositoryKeyMatchStatus: Equatable {
    let title: String
    let detail: String
    let isWarning: Bool
}

extension SpamBlockerModel {
    func resetNumberSearch() {
        numberSearchQuery = ""
        numberSearchResults = []
        numberSearchMessage = Self.defaultNumberSearchMessage
        isSearchingNumbers = false
    }

    func searchNumbers() async {
        let rawQuery = numberSearchQuery
        let normalizedDigits = BlockedNumberRecord.normalizedDigits(from: rawQuery)
        numberSearchQuery = rawQuery.trimmingCharacters(in: .whitespacesAndNewlines)
        numberSearchMessage = nil

        guard !normalizedDigits.isEmpty else {
            numberSearchResults = []
            numberSearchMessage = "Enter a phone number to search the local blocklist."
            return
        }

        isSearchingNumbers = true
        defer { isSearchingNumbers = false }

        do {
            let response = try BlocklistSyncService.searchEffectiveNumbers(matching: rawQuery)
            numberSearchResults = response.results
        } catch {
            numberSearchResults = []
        }

        let totalCount = numberSearchResults.count
        if totalCount == 0 {
            numberSearchMessage = "No matches found for +\(normalizedDigits)."
        } else {
            numberSearchMessage = "Found \(totalCount) match\(totalCount == 1 ? "" : "es") for +\(normalizedDigits)."
        }
    }

    func reloadExtension() async throws {
        try await withCheckedThrowingContinuation { (continuation: CheckedContinuation<Void, Error>) in
            CXCallDirectoryManager.sharedInstance.reloadExtension(
                withIdentifier: SpamBlockerShared.extensionIdentifier
            ) { error in
                if let error {
                    continuation.resume(throwing: error)
                } else {
                    continuation.resume()
                }
            }
        }
    }

    func fetchExtensionStatus() async throws -> ExtensionStatus {
#if targetEnvironment(simulator)
        return .unavailableOnSimulator
#else
        try await withCheckedThrowingContinuation { continuation in
            CXCallDirectoryManager.sharedInstance.getEnabledStatusForExtension(
                withIdentifier: SpamBlockerShared.extensionIdentifier
            ) { status, error in
                if let error {
                    continuation.resume(throwing: error)
                    return
                }

                let value: ExtensionStatus
                switch status {
                case .enabled:
                    value = .enabled
                case .disabled:
                    value = .disabled
                case .unknown:
                    value = .unknown
                @unknown default:
                    value = .unknown
                }

                continuation.resume(returning: value)
            }
        }
#endif
    }

    func applyEffectiveSnapshot(_ snapshot: EffectiveBlocklistSnapshot) {
        blockedNumberCount = snapshot.totalEntries
        blocklistSource = snapshot.source
        lastSyncDescription = snapshot.syncedAt.map {
            Self.syncFormatter.localizedString(for: $0, relativeTo: Date())
        } ?? "Not synced yet"
    }

    func refreshStoredState() {
        SpamBlockerShared.registerDefaults()
        isBlockingEnabled = SpamBlockerShared.isEnabled
        contactsPermissionState = ContactFilteringService.currentPermissionState()
        contactsStatusDescription = contactsPermissionState.description
        repositories = [.builtIn] + BlocklistSyncService.repositories
        activeRepositoryID = BlocklistSyncService.activeRepository.id
        trustedKeys = SpamBlockerShared.trustedKeys
        refreshPersonalEntries()
    }

    func applyCachedEffectiveSnapshotIfAvailable() {
        if let snapshot = try? BlocklistSyncService.fetchEffectiveSnapshot() {
            applyEffectiveSnapshot(snapshot)
        }
    }

    func applySummary(_ summary: BlocklistDatabaseSummary, effectiveSnapshot: EffectiveBlocklistSnapshot) {
        blockedNumberCount = effectiveSnapshot.totalEntries
        blocklistSource = effectiveSnapshot.source
        lastSyncDescription = summary.syncedAt.map {
            Self.syncFormatter.localizedString(for: $0, relativeTo: Date())
        } ?? "Not synced yet"
    }

    func applyRefreshResult(_ result: RefreshCoordinatorResult) {
        availableBlocklists = result.repository.resolvedCountries(relativeTo: BlocklistSyncService.repositoryURL)
        applySelections(result.resolvedSelections)
        blocklistSignatureStatus = result.signatureStatus
        applySummary(result.databaseSummary, effectiveSnapshot: result.effectiveSnapshot)
        extensionStatus = result.extensionStatus
        refreshStoredState()
    }

    @discardableResult
    func applyRepository(_ repository: BlocklistRepositoryDocument) -> [StoredBlocklistSelection] {
        availableBlocklists = repository.resolvedCountries(relativeTo: BlocklistSyncService.repositoryURL)
        if let selections = try? BlocklistSyncService.resolveSelections(in: repository) {
            applySelections(selections)
            return selections
        }

        return []
    }

    func applySelections(_ selections: [StoredBlocklistSelection]) {
        selectedBlocklistIDs = Set(selections.map(\.id))

        guard !selections.isEmpty else {
            selectedBlocklistTitle = "No blocklists selected"
            selectedBlocklistDescription = "Choose one or more blocklists to sync into the local database."
            selectedBlocklistCountry = ""
            blocklistSignatureStatus = "Unavailable"
            return
        }

        if selections.count == 1, let selection = selections.first {
            selectedBlocklistTitle = selection.title
            selectedBlocklistDescription = selection.description
            selectedBlocklistCountry = "\(selection.countryName) (\(selection.countryCode))"
            blocklistSignatureStatus = selection.resolvedSignatureURL == nil ? "Unavailable" : "Checking"
            return
        }

        let countryLabels = Array(
            NSOrderedSet(array: selections.map { "\($0.countryName) (\($0.countryCode))" })
        ) as? [String] ?? []
        selectedBlocklistTitle = "\(selections.count) Blocklists Selected"
        selectedBlocklistDescription = selections.map(\.title).joined(separator: ", ")
        selectedBlocklistCountry = countryLabels.joined(separator: " • ")
        blocklistSignatureStatus = selections.contains { $0.resolvedSignatureURL != nil }
        ? "Checking"
        : "Unavailable"
    }

    func updateSignatureStatus(for selections: [StoredBlocklistSelection]) async {
        blocklistSignatureStatus = await signatureStatusDescription(for: selections)
    }

    func coordinatedRefresh(forceSync: Bool) async throws -> RefreshCoordinatorResult {
        let repositoryFetch = try await BlocklistSyncService.fetchRepositoryResult()
        let selections = try BlocklistSyncService.resolveSelections(in: repositoryFetch.document)
        let signatureStatus = await signatureStatusDescription(for: selections)
        let contactNumbers = await contactNumbersForSync()

        let summary: BlocklistDatabaseSummary
        if forceSync {
            try await BlocklistSyncService.refreshNow(using: selections, excluding: contactNumbers)
            summary = try BlocklistDatabase.fetchSummary()
        } else {
            summary = try await BlocklistSyncService.refreshIfNeeded(using: selections, excluding: contactNumbers)
        }

        let effectiveSnapshot = try BlocklistSyncService.fetchEffectiveSnapshot()
        try? await reloadExtension()
        let extensionStatus = try await fetchExtensionStatus()

        return RefreshCoordinatorResult(
            repositoryFetch: repositoryFetch,
            resolvedSelections: selections,
            signatureStatus: signatureStatus,
            databaseSummary: summary,
            effectiveSnapshot: effectiveSnapshot,
            extensionStatus: extensionStatus
        )
    }

    func signatureStatusDescription(for selections: [StoredBlocklistSelection]) async -> String {
        guard selections.contains(where: { $0.resolvedSignatureURL != nil }) else {
            return "Unavailable"
        }

        return await BlocklistSyncService.signatureStatus(for: selections) ? "Good" : "Unavailable"
    }

    func manualSyncStatus(for result: RefreshCoordinatorResult, at date: Date = Date()) -> ManualSyncStatus {
        if result.repositoryFetch.usedBundledSeedFallback {
            return ManualSyncStatus(
                title: "Bundled fallback used",
                message: "SpamSniper refreshed using the bundled community repository catalog because the live built-in index was unavailable.",
                style: .warning,
                recordedAt: date
            )
        }

        return ManualSyncStatus(
            title: "Sync complete",
            message: "SpamSniper refreshed repository metadata, rebuilt the blocking feed, and reloaded the Call Directory extension.",
            style: .success,
            recordedAt: date
        )
    }

    func manualSyncStatus(
        for error: Error,
        fallbackMessage: String,
        at date: Date = Date()
    ) -> ManualSyncStatus {
        if let syncError = error as? BlocklistSyncServiceError {
            switch syncError {
            case let .repositoryUnavailable(repositoryName):
                return ManualSyncStatus(
                    title: "Repository unavailable",
                    message: "The active custom repository \"" + repositoryName + "\" is unavailable right now. SpamSniper kept your last synced snapshot.",
                    style: .warning,
                    recordedAt: date
                )
            case .repositorySignatureUnavailable,
                    .repositorySignatureInvalid,
                    .blocklistSignatureUnavailable,
                    .blocklistSignatureInvalid:
                return ManualSyncStatus(
                    title: "Signature verification failed",
                    message: "SpamSniper refused to complete the manual sync because repository or blocklist signatures could not be verified.",
                    style: .failure,
                    recordedAt: date
                )
            default:
                break
            }
        }

        return ManualSyncStatus(
            title: "Sync needs attention",
            message: fallbackMessage,
            style: .failure,
            recordedAt: date
        )
    }

    func repositoriesUsingTrustedKey(_ key: TrustedKey) -> [StoredRepository] {
        repositories
            .filter { !$0.isBuiltIn && $0.trustedKeyFingerprint?.uppercased() == key.id.uppercased() }
            .sorted { $0.displayName.localizedCaseInsensitiveCompare($1.displayName) == .orderedAscending }
    }

    func repositoryKeyStatus(for repository: StoredRepository) -> RepositoryKeyStatus {
        guard !repository.isBuiltIn else {
            return RepositoryKeyStatus(
                state: .builtIn,
                title: "Built-in community key",
                detail: "This repository always uses SpamSniper’s bundled community signing key.",
                fingerprint: nil
            )
        }

        guard let fingerprint = repository.trustedKeyFingerprint, !fingerprint.isEmpty else {
            return RepositoryKeyStatus(
                state: .missing,
                title: "No saved key association",
                detail: "Test this repository again to capture and trust its signing key before the next sync.",
                fingerprint: nil
            )
        }

        if SpamBlockerShared.isTrusted(fingerprint: fingerprint) {
            return RepositoryKeyStatus(
                state: .trusted,
                title: "Trusted key matches last validation",
                detail: "The key saved for this repository is still trusted and will be used for future syncs.",
                fingerprint: fingerprint
            )
        }

        return RepositoryKeyStatus(
            state: .untrusted,
            title: "Last validated key is no longer trusted",
            detail: "Syncing this repository will fail until that key is trusted again or the repository is revalidated.",
            fingerprint: fingerprint
        )
    }

    func repositoryKeyMatchStatus(
        savedFingerprint: String?,
        validatedFingerprint: String
    ) -> RepositoryKeyMatchStatus {
        let normalizedSavedFingerprint = savedFingerprint?.trimmingCharacters(in: .whitespacesAndNewlines)

        guard let normalizedSavedFingerprint, !normalizedSavedFingerprint.isEmpty else {
            return RepositoryKeyMatchStatus(
                title: "New key association",
                detail: "Saving will bind this repository to the validated signing key shown below.",
                isWarning: false
            )
        }

        if normalizedSavedFingerprint.caseInsensitiveCompare(validatedFingerprint) == .orderedSame {
            return RepositoryKeyMatchStatus(
                title: "Matches current saved key",
                detail: "The validated signing key matches the repository’s currently saved fingerprint.",
                isWarning: false
            )
        }

        return RepositoryKeyMatchStatus(
            title: "Different from saved key",
            detail: "Saving will replace the repository’s saved fingerprint with the validated key from this URL.",
            isWarning: true
        )
    }

    @discardableResult
    func processPersonalBlocklistChange() async -> Bool {
        refreshPersonalEntries()
        errorMessage = nil

        if let effectiveSnapshot = try? BlocklistSyncService.fetchEffectiveSnapshot() {
            applyEffectiveSnapshot(effectiveSnapshot)
        }

        if !numberSearchQuery.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
            await searchNumbers()
        }

        do {
            try await reloadExtension()
            extensionStatus = try await fetchExtensionStatus()
            return true
        } catch {
            extensionStatus = fallbackExtensionStatus(for: error)
            errorMessage = userFacingMessage(for: error)
            return false
        }
    }

    func userFacingMessage(for error: Error) -> String {
        if let syncError = error as? BlocklistSyncServiceError {
            return message(for: syncError)
        }

        if contactsPermissionState == .denied {
            return """
            Contacts access is turned off. Enable Contacts in Settings if you want SpamSniper \
            to avoid blocking saved contacts.
            """
        }

        let nsError = error as NSError
        if nsError.domain == CXErrorDomainCallDirectoryManager {
            return """
            Turn on SpamSniper in Settings > Phone > Call Blocking & Identification \
            to finish setup.
            """
        }

        return "SpamSniper could not finish setup right now. Check your connection and iPhone settings, then try again."
    }

    func fallbackExtensionStatus(for error: Error) -> ExtensionStatus {
#if targetEnvironment(simulator)
        return .unavailableOnSimulator
#else
        _ = error
        return .unknown
#endif
    }

    var isUsingCustomRepository: Bool {
        !BlocklistSyncService.activeRepository.isBuiltIn
    }

    static let syncFormatter: RelativeDateTimeFormatter = {
        let formatter = RelativeDateTimeFormatter()
        formatter.unitsStyle = .full
        return formatter
    }()
}

private extension SpamBlockerModel {
    func message(for syncError: BlocklistSyncServiceError) -> String {
        switch syncError {
        case .remoteBlocklistUnavailable:
            return """
            SpamSniper could not download the selected blocklists. \
            Check your internet connection and try again.
            """
        case .repositoryEmpty:
            return "No blocklists are currently available. Try again later."
        case .invalidRepositoryURL:
            return "The custom repository URL is invalid. Use a GitHub repo URL or a direct repo.json URL."
        case let .repositoryUnavailable(repositoryName):
            return "The custom repository \"\(repositoryName)\" is unavailable right now. SpamSniper kept your last synced snapshot."
        case .repositoryKeyUnavailable:
            return "SpamSniper could not find a usable public key for the selected repository."
        case .repositoryKeyUntrusted:
            return "The repository signing key is not trusted. Go to Settings → Trusted Keys and add the key."
        case .repositoryMetadataInvalid:
            return "The selected repository metadata is invalid."
        case .bundledSeedMissing:
            return "SpamSniper could not load its backup blocklist catalog. Reinstall the app and try again."
        case .repositorySignatureUnavailable, .repositorySignatureInvalid:
            return """
            SpamSniper could not trust the remote blocklist repository. \
            Try again later or verify the repo signing setup.
            """
        case .blocklistSignatureUnavailable, .blocklistSignatureInvalid:
            return "SpamSniper refused to import a blocklist because its signature could not be verified."
        }
    }
}
