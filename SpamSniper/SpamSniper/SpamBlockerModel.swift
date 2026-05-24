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
    static let defaultNumberSearchMessage = "Search the numbers currently included in SpamSniper’s blocking feed."

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
    var availableBlocklists: [ResolvedBlocklistRepositoryCountry] = []
    var contactsStatusDescription = ContactFilterSnapshot.PermissionState.notDetermined.description
    var isBusy = false
    var isRefreshingBlocklists = false
    var isManualSyncInProgress = false
    var isTestingRepository = false
    var errorMessage: String?
    var lastManualSyncStatus: ManualSyncStatus?
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
    var editValidatedRepositoryURL: URL?
    var editValidatedRepoMetaName: String = ""
    var editPendingKeyFingerprint: String = ""
    var editPendingKeyArmoredData: String = ""
    var editPendingKeyAlreadyTrusted: Bool = false

    // MARK: - Trusted Keys
    var trustedKeys: [TrustedKey] = SpamBlockerShared.trustedKeys
    /// Pending key fingerprint from the most recent successful repo test.
    var pendingKeyFingerprint: String = ""
    /// Pending armored key data from the most recent successful repo test.
    var pendingKeyArmoredData: String = ""
    /// Whether the pending key is already in the trusted store.
    var pendingKeyAlreadyTrusted: Bool = false
    var numberSearchQuery = ""
    var numberSearchResults: [BlockedNumberSearchResult] = []
    var isSearchingNumbers = false
    var numberSearchMessage: String?

    // MARK: - Personal Blocklist

    /// The user's personal blocklist store (iCloud-backed).
    let personalBlocklistStore = PersonalBlocklistStore.shared

    /// All personal entries; updated whenever the store changes.
    var personalEntries: [PersonalBlocklistEntry] = PersonalBlocklistStore.shared.entries

    func refreshPersonalEntries() {
        personalEntries = personalBlocklistStore.entries
    }

    func refresh() async {
        refreshStoredState()
        applyCachedEffectiveSnapshotIfAvailable()

        do {
            let result = try await coordinatedRefresh(forceSync: false)
            applyRefreshResult(result)
            errorMessage = nil
        } catch {
            extensionStatus = fallbackExtensionStatus(for: error)
            errorMessage = userFacingMessage(for: error)
        }
    }

    func syncNow() async {
        guard !isManualSyncInProgress else { return }

        isManualSyncInProgress = true
        defer { isManualSyncInProgress = false }

        refreshStoredState()
        applyCachedEffectiveSnapshotIfAvailable()

        do {
            let result = try await coordinatedRefresh(forceSync: true)
            applyRefreshResult(result)

            let syncStatus = manualSyncStatus(for: result)
            lastManualSyncStatus = syncStatus
            errorMessage = syncStatus.style == .failure ? syncStatus.message : nil
        } catch {
            extensionStatus = fallbackExtensionStatus(for: error)
            let message = userFacingMessage(for: error)
            errorMessage = message
            lastManualSyncStatus = manualSyncStatus(for: error, fallbackMessage: message)
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
        let nextSelections = selectionsAfterToggling(entry, in: repositoryEntries)
        let storedSelections = storedSelections(for: nextSelections)

        BlocklistSyncService.updateSelectedBlocklists(to: nextSelections)
        applySelections(storedSelections)
        await updateSignatureStatus(for: storedSelections)

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
