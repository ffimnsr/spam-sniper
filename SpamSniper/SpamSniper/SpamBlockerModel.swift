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

        var message: String {
            switch self {
            case .enabled:
                return "Call blocking is active."
            case .disabled:
                return "Enable the extension in Settings to block calls."
            case .unknown:
                return "SpamSniper is checking the call blocking status."
            }
        }
    }

    var isBlockingEnabled = SpamBlockerShared.isEnabled
    var extensionStatus: ExtensionStatus = .unknown
    var blockedNumberCount = 0
    var blocklistSource = "Loading"
    var lastSyncDescription = "Not synced yet"
    var sampleEntries: [BlockedNumberRecord] = []
    var isBusy = false
    var errorMessage: String?

    func refresh() async {
        SpamBlockerShared.registerDefaults()
        isBlockingEnabled = SpamBlockerShared.isEnabled

        do {
            let summary = try await BlocklistSyncService.refreshIfNeeded()
            let snapshot = try BlocklistSyncService.fetchSnapshot()
            blockedNumberCount = summary.totalEntries
            blocklistSource = summary.source ?? snapshot.source
            lastSyncDescription = summary.syncedAt.map { Self.syncFormatter.localizedString(for: $0, relativeTo: Date()) } ?? "Not synced yet"
            sampleEntries = Array(snapshot.records.prefix(3))
            try? await reloadExtension()
            extensionStatus = try await fetchExtensionStatus()
            errorMessage = nil
        } catch {
            extensionStatus = .unknown
            errorMessage = error.localizedDescription
        }
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
        try await withCheckedThrowingContinuation { continuation in
            CXCallDirectoryManager.sharedInstance.getEnabledStatusForExtension(withIdentifier: SpamBlockerShared.extensionIdentifier) { status, error in
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
    }

    private static let syncFormatter: RelativeDateTimeFormatter = {
        let formatter = RelativeDateTimeFormatter()
        formatter.unitsStyle = .full
        return formatter
    }()
}
