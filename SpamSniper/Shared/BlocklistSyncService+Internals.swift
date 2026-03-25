//
//  BlocklistSyncService+Internals.swift
//  SpamSniper
//

import Foundation

extension BlocklistSyncService {
    static var repositories: [StoredRepository] {
        SpamBlockerShared.repositories
    }

    static var activeRepository: StoredRepository {
        if let activeURL = SpamBlockerShared.activeRepositoryURL {
            return SpamBlockerShared.repositories.first(where: { $0.urlString == activeURL.absoluteString })
                ?? StoredRepository(validatedURL: activeURL, repoName: activeURL.absoluteString)
        }
        return StoredRepository.builtIn
    }

    static func addRepository(_ repo: StoredRepository) {
        SpamBlockerShared.addRepository(repo)
    }

    static func removeRepository(id: String) {
        SpamBlockerShared.removeRepository(id: id)
    }

    static func updateRepository(_ updated: StoredRepository) {
        SpamBlockerShared.updateRepository(updated)
    }

    static func setActiveRepository(_ repo: StoredRepository) {
        SpamBlockerShared.setActiveRepository(repo.isBuiltIn ? nil : repo)
        SpamBlockerShared.selectedBlocklists = []
    }

    static func resolveSelections(in repository: BlocklistRepositoryDocument) throws -> [StoredBlocklistSelection] {
        let catalog = repository.catalogEntries(relativeTo: repositoryURL)

        let storedSelections = SpamBlockerShared.selectedBlocklists
        let refreshedSelections = storedSelections.compactMap { storedSelection in
            catalog.first(where: { $0.id == storedSelection.id }).map(StoredBlocklistSelection.init(entry:))
        }

        if !refreshedSelections.isEmpty {
            SpamBlockerShared.selectedBlocklists = refreshedSelections
            return refreshedSelections
        }

        let defaultEntry: BlocklistCatalogEntry? = if let defaultBlocklistID = repository.defaultBlocklistID {
            catalog.first(where: { $0.id == defaultBlocklistID })
        } else {
            nil
        }

        let selection = StoredBlocklistSelection(entry: try firstAvailableEntry(defaultEntry, catalog: catalog))
        SpamBlockerShared.selectedBlocklists = [selection]
        return [selection]
    }

    static func updateSelectedBlocklists(to entries: [BlocklistCatalogEntry]) {
        SpamBlockerShared.selectedBlocklists = entries.map(StoredBlocklistSelection.init(entry:))
    }

    static func githubRepositoryURL(owner: String, repo: String) throws -> URL {
        guard let url = githubRepositoryURLCandidates(owner: owner, repo: repo).first else {
            throw BlocklistSyncServiceError.invalidRepositoryURL
        }

        return url
    }

    static func githubRepositoryURLCandidates(owner: String, repo: String) -> [URL] {
        [
            URL(string: "https://raw.githubusercontent.com/\(owner)/\(repo)/main/blocklist/repo.json"),
            URL(string: "https://raw.githubusercontent.com/\(owner)/\(repo)/master/blocklist/repo.json")
        ]
        .compactMap { $0 }
    }

    static func resolvedRepositoryURLForValidation(from input: String) async throws -> URL {
        let trimmed = input.trimmingCharacters(in: .whitespacesAndNewlines)
        let githubCandidates: [URL]

        if let directURL = URL(string: trimmed), directURL.host?.contains("github.com") == true {
            let components = directURL.path.split(separator: "/").map(String.init)
            guard components.count >= 2 else {
                throw BlocklistSyncServiceError.invalidRepositoryURL
            }
            githubCandidates = githubRepositoryURLCandidates(owner: components[0], repo: components[1])
        } else if !trimmed.contains("://"), trimmed.split(separator: "/").count == 2 {
            let parts = trimmed.split(separator: "/").map(String.init)
            githubCandidates = githubRepositoryURLCandidates(owner: parts[0], repo: parts[1])
        } else {
            githubCandidates = []
        }

        if !githubCandidates.isEmpty {
            for candidate in githubCandidates {
                do {
                    _ = try await fetchVerifiedRepositoryContext(from: candidate)
                    return candidate
                } catch {
                    continue
                }
            }
            throw BlocklistSyncServiceError.invalidRepositoryURL
        }

        return try normalizedRepositoryURL(from: input)
    }

    static func currentPublicKeyData() async throws -> Data {
        if let repositoryURL {
            return try await fetchVerifiedRepositoryContext(from: repositoryURL).publicKeyData
        }

        return try bundledTrustedPublicKeyData()
    }

    static func loadDocument(for selection: StoredBlocklistSelection) async throws -> BlocklistDocument {
        guard let remoteURL = selection.resolvedDocumentURL else {
            throw BlocklistSyncServiceError.remoteBlocklistUnavailable(selection.title)
        }

        do {
            let data = try await fetchRemoteData(from: remoteURL)
            guard let signatureURL = selection.resolvedSignatureURL else {
                throw BlocklistSyncServiceError.blocklistSignatureUnavailable(selection.title)
            }

            let signatureData = try await fetchRemoteData(from: signatureURL)
            try BlocklistSignatureVerifier.verifyDetachedSignature(
                signedData: data,
                signatureData: signatureData,
                publicKeyData: try await currentPublicKeyData()
            )
            return try decoder.decode(BlocklistDocument.self, from: data)
        } catch let error as BlocklistSyncServiceError {
            throw error
        } catch is BlocklistSignatureVerifierError {
            throw BlocklistSyncServiceError.blocklistSignatureInvalid(selection.title)
        } catch {
            throw BlocklistSyncServiceError.remoteBlocklistUnavailable(selection.title)
        }
    }

    static func fetchVerifiedRepositoryContext(from repositoryURL: URL) async throws -> RepositoryContext {
        let data = try await fetchRemoteData(from: repositoryURL)
        let signatureData = try await fetchRemoteData(from: repositoryURL.appendingPathExtension("asc"))

        let untrustedDocument: BlocklistRepositoryDocument
        do {
            untrustedDocument = try decoder.decode(BlocklistRepositoryDocument.self, from: data)
        } catch {
            throw BlocklistSyncServiceError.repositoryMetadataInvalid
        }

        guard let publicKeyURL = resolvedRepositoryKeyURL(from: untrustedDocument, repositoryURL: repositoryURL) else {
            throw BlocklistSyncServiceError.repositoryKeyUnavailable
        }

        let publicKeyData = try await fetchRemoteData(from: publicKeyURL)

        do {
            try BlocklistSignatureVerifier.verifyDetachedSignature(
                signedData: data,
                signatureData: signatureData,
                publicKeyData: publicKeyData
            )
        } catch {
            throw BlocklistSyncServiceError.repositorySignatureInvalid
        }

        return RepositoryContext(document: untrustedDocument, publicKeyData: publicKeyData)
    }

    static func resolvedRepositoryKeyURL(
        from repository: BlocklistRepositoryDocument,
        repositoryURL: URL
    ) -> URL? {
        guard let value = repository.gpgKeyURL?.trimmingCharacters(in: .whitespacesAndNewlines),
              !value.isEmpty else {
            return nil
        }

        if let absoluteURL = URL(string: value), absoluteURL.scheme != nil {
            return absoluteURL
        }

        return repositoryURL.deletingLastPathComponent().appending(path: value)
    }

    static func shouldRefresh(summary: BlocklistDatabaseSummary, selectedBlocklistIDs: [String]) -> Bool {
        guard summary.blocklistIDs == selectedBlocklistIDs else {
            return true
        }

        guard let syncedAt = summary.syncedAt else {
            return true
        }

        return Date().timeIntervalSince(syncedAt) >= 60 * 60 * 24
    }

    static func loadSeedRepository() throws -> BlocklistRepositoryDocument {
        let data = try loadBundledData(resourceName: "spam-blocklist-repo-seed")
        let signatureData = try loadBundledData(resourceName: "spam-blocklist-repo-seed", withExtension: "asc")
        try BlocklistSignatureVerifier.verifyDetachedSignature(signedData: data, signatureData: signatureData)
        return try decoder.decode(BlocklistRepositoryDocument.self, from: data)
    }

    static func bundledTrustedPublicKeyData() throws -> Data {
        let bundles = [Bundle.main] + Bundle.allBundles + Bundle.allFrameworks
        for bundle in bundles {
            if let url = bundle.url(forResource: "spam-blocklist-trusted-public-key", withExtension: "asc") {
                return try Data(contentsOf: url)
            }
        }

        throw BlocklistSyncServiceError.repositoryKeyUnavailable
    }

    static func loadBundledData(resourceName: String) throws -> Data {
        try loadBundledData(resourceName: resourceName, withExtension: "json")
    }

    static func loadBundledData(resourceName: String, withExtension fileExtension: String) throws -> Data {
        let bundles = [Bundle.main] + Bundle.allBundles + Bundle.allFrameworks
        for bundle in bundles {
            if let url = bundle.url(forResource: resourceName, withExtension: fileExtension) {
                return try Data(contentsOf: url)
            }
        }

        throw BlocklistSyncServiceError.bundledSeedMissing("\(resourceName).\(fileExtension)")
    }

    static func firstAvailableEntry(
        _ preferredEntry: BlocklistCatalogEntry?,
        catalog: [BlocklistCatalogEntry]
    ) throws -> BlocklistCatalogEntry {
        if let preferredEntry {
            return preferredEntry
        }

        guard let firstEntry = catalog.first else {
            throw BlocklistSyncServiceError.repositoryEmpty
        }

        return firstEntry
    }

    static func combinedSourceLabel(from sources: [String]) -> String {
        let uniqueSources = Array(NSOrderedSet(array: sources)) as? [String] ?? sources
        guard uniqueSources.count > 2 else {
            return uniqueSources.joined(separator: " + ")
        }

        return uniqueSources.prefix(2).joined(separator: " + ") + " + etc."
    }

    static let decoder = JSONDecoder()

    static let session: URLSession = {
        let configuration = URLSessionConfiguration.ephemeral
        configuration.timeoutIntervalForRequest = 8
        configuration.timeoutIntervalForResource = 12
        configuration.waitsForConnectivity = false
        return URLSession(configuration: configuration)
    }()

    static func fetchRemoteData(from url: URL) async throws -> Data {
        let (data, response) = try await session.data(from: url)
        guard let httpResponse = response as? HTTPURLResponse,
              200..<300 ~= httpResponse.statusCode else {
            if url.pathExtension == "asc" {
                if url.lastPathComponent == "repo.json.asc" {
                    throw BlocklistSyncServiceError.repositorySignatureUnavailable
                }

                throw BlocklistSyncServiceError.blocklistSignatureUnavailable(
                    url.deletingPathExtension().lastPathComponent
                )
            }

            throw URLError(.badServerResponse)
        }

        return data
    }

    static let defaultRepositoryURL = URL(
        string: "https://raw.githubusercontent.com/ffimnsr/spam-sniper/master/blocklist/repo.json"
    )
}

struct RepositoryContext {
    let document: BlocklistRepositoryDocument
    let publicKeyData: Data
}
