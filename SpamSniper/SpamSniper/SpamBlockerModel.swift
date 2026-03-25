//
//  SpamBlockerModel.swift
//  SpamSniper
//
//  Created by Codex on 3/19/26.
//

import CallKit
import Observation
import UIKit

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
                return """
                Call blocking status cannot be verified in Simulator. \
                Use a physical iPhone for the real extension flow.
                """
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
    var isTestingRepository = false
    var errorMessage: String?
    var repositoryInput = ""
    var repositoryNameInput = ""
    var repositoryTestMessage: String?
    var repositoryTestPassed = false
    var pendingValidatedRepositoryURL: URL?
    /// The name pulled from the repo's own metadata after a successful test.
    var pendingRepoMetaName: String = ""

    // MARK: - Multi-repo state
    var repositories: [StoredRepository] = [.builtIn] + SpamBlockerShared.repositories
    var activeRepositoryID: String = BlocklistSyncService.activeRepository.id

    // Edit-sheet state
    var editingRepository: StoredRepository?
    var editNameInput: String = ""
    var editURLInput: String = ""
    var editTestMessage: String?
    var editTestPassed: Bool = false
    var isTestingEditRepository: Bool = false
    var numberSearchQuery = ""
    var numberSearchResults: [BlockedNumberSearchResult] = []
    var isSearchingNumbers = false
    var numberSearchMessage: String?

    func refresh() async {
        SpamBlockerShared.registerDefaults()
        isBlockingEnabled = SpamBlockerShared.isEnabled
        contactsPermissionState = ContactFilteringService.currentPermissionState()
        contactsStatusDescription = contactsPermissionState.description
        // Sync multi-repo state
        repositories = [.builtIn] + BlocklistSyncService.repositories
        activeRepositoryID = BlocklistSyncService.activeRepository.id

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
}
