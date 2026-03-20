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
    var selectedBlocklistID = ""
    var selectedBlocklistTitle = "Loading"
    var selectedBlocklistDescription = ""
    var selectedBlocklistCountry = ""
    var blocklistSignatureLocation = "Unavailable"
    var lastSyncDescription = "Not synced yet"
    var sampleEntries: [BlockedNumberRecord] = []
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
            applyRepository(repository)
            let snapshot = try BlocklistSyncService.fetchSnapshot()
            applySnapshot(snapshot)
        } catch {
            errorMessage = error.localizedDescription
        }

        do {
            let shouldExcludeContacts = contactsPermissionState == .authorized
            let contactNumbers = if shouldExcludeContacts {
                await ContactFilteringService.loadSnapshot().phoneNumbers
            } else {
                Set<Int64>()
            }

            let repository = try await BlocklistSyncService.fetchRepository()
            applyRepository(repository)
            let summary = try await BlocklistSyncService.refreshIfNeeded(excluding: contactNumbers)
            let snapshot = try BlocklistSyncService.fetchSnapshot()
            applySummary(summary, snapshot: snapshot)
            try? await reloadExtension()
            extensionStatus = try await fetchExtensionStatus()
            errorMessage = nil
        } catch {
            extensionStatus = fallbackExtensionStatus(for: error)
            errorMessage = error.localizedDescription
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
            errorMessage = error.localizedDescription
        }

        isBusy = false
    }

    func selectBlocklist(_ entry: BlocklistCatalogEntry) async {
        isRefreshingBlocklists = true
        errorMessage = nil
        BlocklistSyncService.updateSelectedBlocklist(to: entry)
        applySelection(StoredBlocklistSelection(entry: entry))

        do {
            let shouldExcludeContacts = contactsPermissionState == .authorized
            let contactNumbers = if shouldExcludeContacts {
                await ContactFilteringService.loadSnapshot().phoneNumbers
            } else {
                Set<Int64>()
            }

            try await BlocklistSyncService.refreshNow(
                using: StoredBlocklistSelection(entry: entry),
                excluding: contactNumbers
            )
            let snapshot = try BlocklistSyncService.fetchSnapshot()
            applySnapshot(snapshot)
            try? await reloadExtension()
            extensionStatus = try await fetchExtensionStatus()
        } catch {
            errorMessage = error.localizedDescription
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
            errorMessage = error.localizedDescription
        }
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
        sampleEntries = Array(snapshot.records.prefix(3))
    }

    private func applySummary(_ summary: BlocklistDatabaseSummary, snapshot: BlocklistSnapshot) {
        blockedNumberCount = summary.totalEntries
        blocklistSource = summary.source ?? snapshot.source
        lastSyncDescription = summary.syncedAt.map { Self.syncFormatter.localizedString(for: $0, relativeTo: Date()) } ?? "Not synced yet"
        sampleEntries = Array(snapshot.records.prefix(3))
    }

    private func applyRepository(_ repository: BlocklistRepositoryDocument) {
        availableBlocklists = repository.countries
        if let selection = try? BlocklistSyncService.resolveSelection(in: repository) {
            applySelection(selection)
        }
    }

    private func applySelection(_ selection: StoredBlocklistSelection) {
        selectedBlocklistID = selection.id
        selectedBlocklistTitle = selection.title
        selectedBlocklistDescription = selection.description
        selectedBlocklistCountry = "\(selection.countryName) (\(selection.countryCode))"
        blocklistSignatureLocation = selection.resolvedSignatureURL?.absoluteString ?? "Unavailable"
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
