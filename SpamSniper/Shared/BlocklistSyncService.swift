//
//  BlocklistSyncService.swift
//  SpamSniper
//
//  Created by Codex on 3/19/26.
//

import Foundation

enum BlocklistSyncServiceError: LocalizedError {
    case bundledSeedMissing(String)
    case repositoryEmpty
    case invalidRepositoryURL
    case repositoryKeyUnavailable
    case repositoryMetadataInvalid
    case remoteBlocklistUnavailable(String)
    case repositorySignatureUnavailable
    case repositorySignatureInvalid
    case blocklistSignatureUnavailable(String)
    case blocklistSignatureInvalid(String)

    var errorDescription: String? {
        switch self {
        case let .bundledSeedMissing(resourceName):
            return """
            The bundled seed blocklist resource \(resourceName) is missing from the app build. \
            Clean the build folder, delete the app from Simulator, and run it again.
            """
        case .repositoryEmpty:
            return "The blocklist repository did not publish any blocklists."
        case .invalidRepositoryURL:
            return "The repository URL is invalid. Use a GitHub repository URL or a direct repo.json URL."
        case .repositoryKeyUnavailable:
            return "The repository public key is missing or could not be fetched."
        case .repositoryMetadataInvalid:
            return "The repository metadata is invalid or incomplete."
        case let .remoteBlocklistUnavailable(title):
            return """
            SpamSniper could not download the blocklist "\(title)". Connect to the internet and try syncing again.
            """
        case .repositorySignatureUnavailable:
            return "The blocklist repository signature is missing."
        case .repositorySignatureInvalid:
            return "The blocklist repository signature is invalid."
        case let .blocklistSignatureUnavailable(title):
            return "The blocklist signature for \"\(title)\" is missing."
        case let .blocklistSignatureInvalid(title):
            return "The blocklist signature for \"\(title)\" is invalid."
        }
    }
}

struct RepositoryValidationResult {
    let normalizedRepositoryURL: URL
    let repositoryName: String
    let blocklistCount: Int
}

enum BlocklistSyncService {
    static func signatureStatus(for selections: [StoredBlocklistSelection]) async -> Bool {
        guard !selections.isEmpty else {
            return false
        }

        let publicKeyData: Data
        do {
            publicKeyData = try await currentPublicKeyData()
        } catch {
            return false
        }

        for selection in selections {
            guard let documentURL = selection.resolvedDocumentURL,
                  let signatureURL = selection.resolvedSignatureURL else {
                return false
            }

            do {
                let documentData = try await fetchRemoteData(from: documentURL)
                let signatureData = try await fetchRemoteData(from: signatureURL)
                try BlocklistSignatureVerifier.verifyDetachedSignature(
                    signedData: documentData,
                    signatureData: signatureData,
                    publicKeyData: publicKeyData
                )
            } catch {
                return false
            }
        }

        return true
    }

    static func refreshIfNeeded(excluding contactNumbers: Set<Int64> = []) async throws -> BlocklistDatabaseSummary {
        try BlocklistDatabase.initializeIfNeeded()

        let repository = try await fetchRepository()
        let selections = try resolveSelections(in: repository)
        let currentSummary = try BlocklistDatabase.fetchSummary()
        if shouldRefresh(summary: currentSummary, selectedBlocklistIDs: selections.map(\.id)) {
            try await refreshNow(using: selections, excluding: contactNumbers)
        }

        return try BlocklistDatabase.fetchSummary()
    }

    static func refreshNow(
        using selections: [StoredBlocklistSelection],
        excluding contactNumbers: Set<Int64> = []
    ) async throws {
        try BlocklistDatabase.initializeIfNeeded()

        var deduplicatedRecords: [Int64: BlockedNumberRecord] = [:]
        var sourceLabels: [String] = []

        for selection in selections {
            let document = try await loadDocument(for: selection)
            sourceLabels.append(document.source)

            for record in document.entries.compactMap(BlockedNumberRecord.from(document:))
            where !contactNumbers.contains(record.phoneNumber) {
                deduplicatedRecords[record.phoneNumber] = record
            }
        }

        let records = deduplicatedRecords.values.sorted { $0.phoneNumber < $1.phoneNumber }
        try BlocklistDatabase.replaceEntries(
            records,
            blocklistIDs: selections.map(\.id),
            source: combinedSourceLabel(from: sourceLabels),
            syncedAt: Date()
        )
    }

    static func fetchSnapshot() throws -> BlocklistSnapshot {
        try BlocklistDatabase.initializeIfNeeded()
        return try BlocklistDatabase.fetchSnapshot()
    }

    static func fetchRepository() async throws -> BlocklistRepositoryDocument {
        guard let repositoryURL else {
            return try loadSeedRepository()
        }

        do {
            return try await fetchVerifiedRepositoryContext(
                from: repositoryURL
            ).document
        } catch let error as BlocklistSyncServiceError {
            switch error {
            case .repositorySignatureUnavailable,
                 .repositorySignatureInvalid,
                 .repositoryKeyUnavailable,
                 .repositoryMetadataInvalid:
                throw error
            default:
                return try loadSeedRepository()
            }
        } catch {
            return try loadSeedRepository()
        }
    }

    static func validateRepository(at input: String) async throws -> RepositoryValidationResult {
        let normalizedRepositoryURL = try await resolvedRepositoryURLForValidation(from: input)
        let context = try await fetchVerifiedRepositoryContext(from: normalizedRepositoryURL)
        let entries = context.document.catalogEntries(relativeTo: normalizedRepositoryURL)

        guard !entries.isEmpty else {
            throw BlocklistSyncServiceError.repositoryEmpty
        }

        for entry in entries {
            guard let documentURL = entry.documentURL else {
                throw BlocklistSyncServiceError.remoteBlocklistUnavailable(entry.title)
            }
            guard let signatureURL = entry.signatureURL else {
                throw BlocklistSyncServiceError.blocklistSignatureUnavailable(entry.title)
            }

            let documentData = try await fetchRemoteData(from: documentURL)
            let signatureData = try await fetchRemoteData(from: signatureURL)
            try BlocklistSignatureVerifier.verifyDetachedSignature(
                signedData: documentData,
                signatureData: signatureData,
                publicKeyData: context.publicKeyData
            )
            _ = try decoder.decode(BlocklistDocument.self, from: documentData)
        }

        return RepositoryValidationResult(
            normalizedRepositoryURL: normalizedRepositoryURL,
            repositoryName: context.document.name,
            blocklistCount: entries.count
        )
    }

    static func normalizedRepositoryURL(from input: String) throws -> URL {
        let trimmed = input.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else {
            throw BlocklistSyncServiceError.invalidRepositoryURL
        }

        if let directURL = URL(string: trimmed), let scheme = directURL.scheme, !scheme.isEmpty {
            if directURL.lastPathComponent == "repo.json" {
                return directURL
            }

            if directURL.host?.contains("github.com") == true {
                let components = directURL.path.split(separator: "/").map(String.init)
                if components.count >= 2 {
                    let owner = components[0]
                    let repo = components[1]
                    if let resolved = try? githubRepositoryURL(owner: owner, repo: repo) {
                        return resolved
                    }
                }
            }

            throw BlocklistSyncServiceError.invalidRepositoryURL
        }

        let parts = trimmed.split(separator: "/").map(String.init)
        guard parts.count == 2 else {
            throw BlocklistSyncServiceError.invalidRepositoryURL
        }

        return try githubRepositoryURL(owner: parts[0], repo: parts[1])
    }

    static var repositoryURL: URL? {
        SpamBlockerShared.activeRepositoryURL ?? defaultRepositoryURL
    }
}
