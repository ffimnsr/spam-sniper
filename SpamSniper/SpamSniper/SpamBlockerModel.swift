//
//  SpamBlockerModel.swift
//  SpamSniper
//
//  Created by Codex on 3/19/26.
//

import CallKit
import Observation
import SwiftUI

@MainActor
@Observable
final class SpamBlockerModel {
    enum ExtensionStatus: String {
        case enabled
        case disabled
        case unknown
        case unavailableOnSimulator

        var message: String {
            switch self {
            case .enabled:
                return "Call blocking is active."
            case .disabled:
                return "Enable the extension in Settings to block calls."
            case .unknown:
                return "SpamSniper is checking the call blocking status."
            case .unavailableOnSimulator:
                return "Call blocking status cannot be verified in Simulator. Use a physical iPhone for the real extension flow."
            }
        }
    }

    var isBlockingEnabled = SpamBlockerShared.isEnabled
    var extensionStatus: ExtensionStatus = .unknown
    var contactsPermissionState: ContactFilterSnapshot.PermissionState = .notDetermined
    var blockedNumberCount = 0
    var blocklistSource = "Loading"
    var selectedBlocklistIDs: Set<String> = []
    var selectedBlocklistTitle = "Loading"
    var selectedBlocklistDescription = ""
    var selectedBlocklistCountry = ""
    var blocklistSignatureStatus = "Checking"
    var lastSyncDescription = "Not synced yet"
    var availableBlocklists: [BlocklistRepositoryCountry] = []
    var contactsStatusDescription = ContactFilterSnapshot.PermissionState.notDetermined.description
    var isBusy = false
    var isRefreshingBlocklists = false
    var errorMessage: String?

    func refresh() async {
        SpamBlockerShared.registerDefaults()
        isBlockingEnabled = SpamBlockerShared.isEnabled
        contactsPermissionState = ContactFilteringService.currentPermissionState()
        contactsStatusDescription = contactsPermissionState.description

        do {
            let repository = try await BlocklistSyncService.fetchRepository()
            let selections = applyRepository(repository)
            await updateSignatureStatus(for: selections)
            let snapshot = try BlocklistSyncService.fetchSnapshot()
            applySnapshot(snapshot)
        } catch {
            errorMessage = userFacingMessage(for: error)
        }

        do {
            let shouldExcludeContacts = contactsPermissionState == .authorized || contactsPermissionState == .limited
            let contactNumbers = if shouldExcludeContacts {
                await ContactFilteringService.loadSnapshot().phoneNumbers
            } else {
                Set<Int64>()
            }

            let repository = try await BlocklistSyncService.fetchRepository()
            let selections = applyRepository(repository)
            await updateSignatureStatus(for: selections)
            let summary = try await BlocklistSyncService.refreshIfNeeded(excluding: contactNumbers)
            let snapshot = try BlocklistSyncService.fetchSnapshot()
            applySummary(summary, snapshot: snapshot)
            try? await reloadExtension()
            extensionStatus = try await fetchExtensionStatus()
            errorMessage = nil
        } catch {
            extensionStatus = fallbackExtensionStatus(for: error)
            errorMessage = userFacingMessage(for: error)
        }
    }

    func requestContactsAccess() async {
        let state = await ContactFilteringService.requestAccessIfNeeded()
        contactsPermissionState = state
        contactsStatusDescription = state.description
        await refresh()
    }

    func setBlockingEnabled(_ enabled: Bool) async {
        isBusy = true
        errorMessage = nil
        isBlockingEnabled = enabled
        SpamBlockerShared.isEnabled = enabled

        do {
            try await reloadExtension()
            extensionStatus = try await fetchExtensionStatus()
        } catch {
            errorMessage = userFacingMessage(for: error)
        }

        isBusy = false
    }

    func toggleBlocklistSelection(_ entry: BlocklistCatalogEntry) async {
        isRefreshingBlocklists = true
        errorMessage = nil

        let repositoryEntries = flattenedRepositoryEntries()

        var nextSelections = repositoryEntries.filter { selectedBlocklistIDs.contains($0.id) }

        if selectedBlocklistIDs.contains(entry.id) {
            if nextSelections.count > 1 {
                nextSelections.removeAll { $0.id == entry.id }
            }
        } else {
            nextSelections.append(entry)
        }

        nextSelections.sort { $0.title.localizedCaseInsensitiveCompare($1.title) == .orderedAscending }
        BlocklistSyncService.updateSelectedBlocklists(to: nextSelections)
        applySelections(nextSelections.map(StoredBlocklistSelection.init(entry:)))
        await updateSignatureStatus(for: nextSelections.map(StoredBlocklistSelection.init(entry:)))

        do {
            try await syncSelections(nextSelections)
        } catch {
            errorMessage = userFacingMessage(for: error)
        }

        isRefreshingBlocklists = false
    }

    func openSettings() async {
        do {
            try await withCheckedThrowingContinuation { (continuation: CheckedContinuation<Void, Error>) in
                CXCallDirectoryManager.sharedInstance.openSettings { error in
                    if let error {
                        continuation.resume(throwing: error)
                    } else {
                        continuation.resume()
                    }
                }
            }
        } catch {
            errorMessage = userFacingMessage(for: error)
        }
    }

    func openAppSettings() {
        guard let url = URL(string: UIApplication.openSettingsURLString) else {
            errorMessage = "Open the Settings app and review SpamSniper permissions."
            return
        }

        UIApplication.shared.open(url)
    }

    private func reloadExtension() async throws {
        try await withCheckedThrowingContinuation { (continuation: CheckedContinuation<Void, Error>) in
            CXCallDirectoryManager.sharedInstance.reloadExtension(withIdentifier: SpamBlockerShared.extensionIdentifier) { error in
                if let error {
                    continuation.resume(throwing: error)
                } else {
                    continuation.resume()
                }
            }
        }
    }

    private func fetchExtensionStatus() async throws -> ExtensionStatus {
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

    private func applySnapshot(_ snapshot: BlocklistSnapshot) {
        blockedNumberCount = snapshot.records.count
        blocklistSource = snapshot.source
        lastSyncDescription = snapshot.syncedAt.map { Self.syncFormatter.localizedString(for: $0, relativeTo: Date()) } ?? "Not synced yet"
    }

    private func applySummary(_ summary: BlocklistDatabaseSummary, snapshot: BlocklistSnapshot) {
        blockedNumberCount = summary.totalEntries
        blocklistSource = summary.source ?? snapshot.source
        lastSyncDescription = summary.syncedAt.map { Self.syncFormatter.localizedString(for: $0, relativeTo: Date()) } ?? "Not synced yet"
    }

    @discardableResult
    private func applyRepository(_ repository: BlocklistRepositoryDocument) -> [StoredBlocklistSelection] {
        availableBlocklists = repository.countries
        if let selections = try? BlocklistSyncService.resolveSelections(in: repository) {
            applySelections(selections)
            return selections
        }

        return []
    }

    private func applySelections(_ selections: [StoredBlocklistSelection]) {
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

        let countryLabels = Array(NSOrderedSet(array: selections.map { "\($0.countryName) (\($0.countryCode))" })) as? [String] ?? []
        selectedBlocklistTitle = "\(selections.count) Blocklists Selected"
        selectedBlocklistDescription = selections.map(\.title).joined(separator: ", ")
        selectedBlocklistCountry = countryLabels.joined(separator: " • ")
        blocklistSignatureStatus = selections.contains { $0.resolvedSignatureURL != nil } ? "Checking" : "Unavailable"
    }

    private func updateSignatureStatus(for selections: [StoredBlocklistSelection]) async {
        guard selections.contains(where: { $0.resolvedSignatureURL != nil }) else {
            blocklistSignatureStatus = "Unavailable"
            return
        }

        blocklistSignatureStatus = await BlocklistSyncService.signatureStatus(for: selections) ? "Good" : "Unavailable"
    }

    private func userFacingMessage(for error: Error) -> String {
        if let syncError = error as? BlocklistSyncServiceError {
            switch syncError {
            case .remoteBlocklistUnavailable:
                return "SpamSniper could not download the selected blocklists. Check your internet connection and try again."
            case .repositoryEmpty:
                return "No blocklists are currently available. Try again later."
            case .bundledSeedMissing:
                return "SpamSniper could not load its backup blocklist catalog. Reinstall the app and try again."
            case .repositorySignatureUnavailable, .repositorySignatureInvalid:
                return "SpamSniper could not trust the remote blocklist repository. Try again later or verify the repo signing setup."
            case .blocklistSignatureUnavailable, .blocklistSignatureInvalid:
                return "SpamSniper refused to import a blocklist because its signature could not be verified."
            }
        }

        if contactsPermissionState == .denied {
            return "Contacts access is turned off. Enable Contacts in Settings if you want SpamSniper to avoid blocking saved contacts."
        }

        let nsError = error as NSError
        if nsError.domain == CXErrorDomainCallDirectoryManager {
            return "Turn on SpamSniper in Settings > Phone > Call Blocking & Identification to finish setup."
        }

        return "SpamSniper could not finish setup right now. Check your connection and iPhone settings, then try again."
    }

    private func fallbackExtensionStatus(for error: Error) -> ExtensionStatus {
        #if targetEnvironment(simulator)
        return .unavailableOnSimulator
        #else
        _ = error
        return .unknown
        #endif
    }

    private static let syncFormatter: RelativeDateTimeFormatter = {
        let formatter = RelativeDateTimeFormatter()
        formatter.unitsStyle = .full
        return formatter
    }()
}

private extension SpamBlockerModel {
    func flattenedRepositoryEntries() -> [BlocklistCatalogEntry] {
        availableBlocklists.flatMap { country in
            country.blocklists.map { repositoryEntry in
                BlocklistCatalogEntry(
                    id: repositoryEntry.id,
                    countryCode: country.code,
                    countryName: country.name,
                    title: repositoryEntry.title,
                    description: repositoryEntry.description,
                    source: repositoryEntry.source,
                    documentURL: BlocklistSyncService.repositoryURL?
                        .deletingLastPathComponent()
                        .appending(path: repositoryEntry.path),
                    signatureURL: resolvedSignatureURL(
                        entrySignatureURL: repositoryEntry.signatureURL,
                        countrySignatureURL: country.signatureURL
                    )
                )
            }
        }
    }

    func resolvedSignatureURL(entrySignatureURL: String?, countrySignatureURL: String?) -> URL? {
        let value = entrySignatureURL ?? countrySignatureURL
        guard let value else {
            return nil
        }

        if let absoluteURL = URL(string: value), absoluteURL.scheme != nil {
            return absoluteURL
        }

        return BlocklistSyncService.repositoryURL?
            .deletingLastPathComponent()
            .appending(path: value)
    }

    func syncSelections(_ selections: [BlocklistCatalogEntry]) async throws {
        let selectedEntries = selections.map(StoredBlocklistSelection.init(entry:))
        let contactNumbers = await contactNumbersForSync()

        try await BlocklistSyncService.refreshNow(
            using: selectedEntries,
            excluding: contactNumbers
        )
        let snapshot = try BlocklistSyncService.fetchSnapshot()
        applySnapshot(snapshot)
        try? await reloadExtension()
        extensionStatus = try await fetchExtensionStatus()
    }

    func contactNumbersForSync() async -> Set<Int64> {
        let shouldExcludeContacts = contactsPermissionState == .authorized || contactsPermissionState == .limited
        guard shouldExcludeContacts else {
            return []
        }

        return await ContactFilteringService.loadSnapshot().phoneNumbers
    }
}
