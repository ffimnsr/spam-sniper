//
//  SpamBlockerModel+Support.swift
//  SpamSniper
//

import CallKit
import Foundation

extension SpamBlockerModel {
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

        // --- Repo results ---
        var repoResults: [BlockedNumberSearchResult] = []
        do {
            let response = try BlocklistDatabase.searchNumbers(matching: rawQuery)
            repoResults = response.results
        } catch {
            // non-fatal; continue with personal results
        }

        // --- Personal results ---
        let personal = personalBlocklistStore.entries
        let personalMatches = personal.filter { entry in
            entry.normalizedDigits.contains(normalizedDigits)
        }

        // Build a lookup of repo results by phoneNumber for fast dedup
        var repoByNumber: [Int64: BlockedNumberSearchResult] = [:]
        for result in repoResults {
            repoByNumber[result.record.phoneNumber] = result
        }

        // Build merged list:
        // 1. For each repo result, check if there is also a personal entry → .combined
        // 2. For personal-only entries, synthesize a BlockedNumberRecord → .personal
        var merged: [BlockedNumberSearchResult] = repoResults.map { result in
            if let personalEntry = personal.first(where: { $0.phoneNumber == result.record.phoneNumber }) {
                return BlockedNumberSearchResult(
                    record: result.record,
                    matchedDigits: result.matchedDigits,
                    matchKind: result.matchKind,
                    source: .combined,
                    personalEntry: personalEntry
                )
            }
            return BlockedNumberSearchResult(
                record: result.record,
                matchedDigits: result.matchedDigits,
                matchKind: result.matchKind,
                source: .repo,
                personalEntry: nil
            )
        }

        // Add personal-only entries (not already in repo)
        for entry in personalMatches where repoByNumber[entry.phoneNumber] == nil {
            let record = BlockedNumberRecord(
                phoneNumber: entry.phoneNumber,
                displayName: entry.displayName.isEmpty ? entry.phoneNumberE164 : entry.displayName,
                category: "Personal",
                confidence: "high",
                aliases: [],
                tags: entry.tags,
                notes: entry.notes
            )
            let matchKind: BlockedNumberSearchResult.MatchKind =
                entry.normalizedDigits == normalizedDigits ? .exact
                : entry.normalizedDigits.hasSuffix(normalizedDigits) ? .suffix
                : .contains
            merged.append(BlockedNumberSearchResult(
                record: record,
                matchedDigits: normalizedDigits,
                matchKind: matchKind,
                source: .personal,
                personalEntry: entry
            ))
        }

        // Sort: personal-only first, then combined, then repo; within each group keep existing order
        merged.sort { lhs, rhs in
            sourceOrder(lhs.source) < sourceOrder(rhs.source)
        }

        numberSearchResults = merged

        let totalCount = merged.count
        if totalCount == 0 {
            numberSearchMessage = "No matches found for +\(normalizedDigits)."
        } else {
            numberSearchMessage = "Found \(totalCount) match\(totalCount == 1 ? "" : "es") for +\(normalizedDigits)."
        }
    }

    private func sourceOrder(_ source: BlockedNumberSearchResult.ResultSource) -> Int {
        switch source {
        case .personal: return 0
        case .combined: return 1
        case .repo:     return 2
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

    func applySnapshot(_ snapshot: BlocklistSnapshot) {
        blockedNumberCount = snapshot.records.count
        blocklistSource = snapshot.source
        lastSyncDescription = snapshot.syncedAt.map {
            Self.syncFormatter.localizedString(for: $0, relativeTo: Date())
        } ?? "Not synced yet"
    }

    func applySummary(_ summary: BlocklistDatabaseSummary, snapshot: BlocklistSnapshot) {
        blockedNumberCount = summary.totalEntries
        blocklistSource = summary.source ?? snapshot.source
        lastSyncDescription = summary.syncedAt.map {
            Self.syncFormatter.localizedString(for: $0, relativeTo: Date())
        } ?? "Not synced yet"
    }

    @discardableResult
    func applyRepository(_ repository: BlocklistRepositoryDocument) -> [StoredBlocklistSelection] {
        availableBlocklists = repository.countries
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
        guard selections.contains(where: { $0.resolvedSignatureURL != nil }) else {
            blocklistSignatureStatus = "Unavailable"
            return
        }

        blocklistSignatureStatus = await BlocklistSyncService.signatureStatus(for: selections)
            ? "Good"
            : "Unavailable"
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
        case .repositoryKeyUnavailable:
            return "SpamSniper could not find a usable public key for the selected repository."
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
