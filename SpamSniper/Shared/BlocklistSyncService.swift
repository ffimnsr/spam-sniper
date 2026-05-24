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
    case repositoryUnavailable(String)
    case repositoryKeyUnavailable
    case repositoryKeyUntrusted
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
        case let .repositoryUnavailable(repositoryName):
            return "The repository \"\(repositoryName)\" is currently unavailable."
        case .repositoryKeyUnavailable:
            return "The repository public key is missing or could not be fetched."
        case .repositoryKeyUntrusted:
            return "The repository signing key is not in your trusted keys. Add it in Settings → Trusted Keys."
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
    /// Uppercase hex fingerprint of the key that signed the repository.
    let signingKeyFingerprint: String
    /// ASCII-armored public key data.
    let signingKeyArmoredData: String
    /// `true` when the signing key fingerprint is already in the user's trusted keys store.
    var isKeyAlreadyTrusted: Bool {
        SpamBlockerShared.isTrusted(fingerprint: signingKeyFingerprint)
    }
}

struct RepositoryFetchResult {
    enum Source {
        case verifiedRemote
        case bundledSeedFallback
    }

    let document: BlocklistRepositoryDocument
    let source: Source

    var usedBundledSeedFallback: Bool {
        source == .bundledSeedFallback
    }
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
        return try await refreshIfNeeded(using: selections, excluding: contactNumbers)
    }

    static func refreshIfNeeded(
        using selections: [StoredBlocklistSelection],
        excluding contactNumbers: Set<Int64> = []
    ) async throws -> BlocklistDatabaseSummary {
        try BlocklistDatabase.initializeIfNeeded()

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

    static func fetchEffectiveSnapshot() throws -> EffectiveBlocklistSnapshot {
        try BlocklistDatabase.initializeIfNeeded()
        return try EffectiveBlocklistComposer.fetchSnapshot()
    }

    static func searchEffectiveNumbers(
        matching rawQuery: String,
        limit: Int = 100
    ) throws -> EffectiveBlocklistSearchResponse {
        try BlocklistDatabase.initializeIfNeeded()
        return try EffectiveBlocklistComposer.searchNumbers(matching: rawQuery, limit: limit)
    }

    static func fetchRepository() async throws -> BlocklistRepositoryDocument {
        try await fetchRepositoryResult().document
    }

    static func fetchRepositoryResult() async throws -> RepositoryFetchResult {
        try await fetchRepositoryResult(
            for: activeRepository,
            fetchVerifiedRepository: { repositoryURL in
                try await fetchVerifiedRepositoryContext(from: repositoryURL).document
            },
            loadSeedRepository: loadSeedRepository
        )
    }

    static func fetchRepository(
        for activeRepository: StoredRepository,
        fetchVerifiedRepository: (URL) async throws -> BlocklistRepositoryDocument,
        loadSeedRepository: () throws -> BlocklistRepositoryDocument
    ) async throws -> BlocklistRepositoryDocument {
        try await fetchRepositoryResult(
            for: activeRepository,
            fetchVerifiedRepository: fetchVerifiedRepository,
            loadSeedRepository: loadSeedRepository
        ).document
    }

    static func fetchRepositoryResult(
        for activeRepository: StoredRepository,
        fetchVerifiedRepository: (URL) async throws -> BlocklistRepositoryDocument,
        loadSeedRepository: () throws -> BlocklistRepositoryDocument
    ) async throws -> RepositoryFetchResult {
        guard let repositoryURL = activeRepository.resolvedURL else {
            if activeRepository.isBuiltIn {
                return RepositoryFetchResult(document: try loadSeedRepository(), source: .bundledSeedFallback)
            }

            throw BlocklistSyncServiceError.invalidRepositoryURL
        }

        do {
            return RepositoryFetchResult(
                document: try await fetchVerifiedRepository(repositoryURL),
                source: .verifiedRemote
            )
        } catch let error as BlocklistSyncServiceError {
            guard activeRepository.isBuiltIn else {
                throw error
            }

            switch error {
            case .repositorySignatureUnavailable,
                    .repositorySignatureInvalid,
                    .repositoryKeyUnavailable,
                    .repositoryMetadataInvalid:
                throw error
            default:
                return RepositoryFetchResult(document: try loadSeedRepository(), source: .bundledSeedFallback)
            }
        } catch {
            guard !activeRepository.isBuiltIn else {
                return RepositoryFetchResult(document: try loadSeedRepository(), source: .bundledSeedFallback)
            }

            throw BlocklistSyncServiceError.repositoryUnavailable(activeRepository.displayName)
        }
    }

    static func validateRepository(at input: String) async throws -> RepositoryValidationResult {
        let normalizedRepositoryURL = try await resolvedRepositoryURLForValidation(from: input)
        let context = try await fetchVerifiedRepositoryContext(from: normalizedRepositoryURL, requireTrust: false)
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
            blocklistCount: entries.count,
            signingKeyFingerprint: context.publicKeyFingerprint,
            signingKeyArmoredData: context.publicKeyArmoredData
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
        activeRepository.resolvedURL ?? defaultRepositoryURL
    }
}
