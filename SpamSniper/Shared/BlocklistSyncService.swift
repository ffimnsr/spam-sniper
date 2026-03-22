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
    case remoteBlocklistUnavailable(String)

    var errorDescription: String? {
        switch self {
        case let .bundledSeedMissing(resourceName):
            return """
            The bundled seed blocklist resource \(resourceName) is missing from the app build. \
            Clean the build folder, delete the app from Simulator, and run it again.
            """
        case .repositoryEmpty:
            return "The blocklist repository did not publish any blocklists."
        case let .remoteBlocklistUnavailable(title):
            return """
            SpamSniper could not download the blocklist "\(title)". Connect to the internet and try syncing again.
            """
        }
    }
}

enum BlocklistSyncService {
    static func signatureStatus(for selections: [StoredBlocklistSelection]) async -> Bool {
        let signatureURLs = Array(Set(selections.compactMap(\.resolvedSignatureURL)))
        guard !signatureURLs.isEmpty else {
            return false
        }

        for url in signatureURLs {
            if await !isReachable(url: url) {
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

    static func refreshNow(excluding contactNumbers: Set<Int64> = []) async throws {
        let repository = try await fetchRepository()
        let selections = try resolveSelections(in: repository)
        try await refreshNow(using: selections, excluding: contactNumbers)
    }

    static func refreshNow(using selections: [StoredBlocklistSelection], excluding contactNumbers: Set<Int64> = []) async throws {
        try BlocklistDatabase.initializeIfNeeded()

        var deduplicatedRecords: [Int64: BlockedNumberRecord] = [:]
        var sourceLabels: [String] = []

        for selection in selections {
            let document = try await loadDocument(for: selection)
            sourceLabels.append(document.source)

            for record in document.entries.compactMap(BlockedNumberRecord.from(document:)) where !contactNumbers.contains(record.phoneNumber) {
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
        if let repositoryURL {
            do {
                let (data, response) = try await session.data(from: repositoryURL)
                guard let httpResponse = response as? HTTPURLResponse,
                      200..<300 ~= httpResponse.statusCode else {
                    throw URLError(.badServerResponse)
                }
                return try decoder.decode(BlocklistRepositoryDocument.self, from: data)
            } catch {
                return try loadSeedRepository()
            }
        }

        return try loadSeedRepository()
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

    private static func shouldRefresh(summary: BlocklistDatabaseSummary, selectedBlocklistIDs: [String]) -> Bool {
        guard summary.blocklistIDs == selectedBlocklistIDs else {
            return true
        }

        guard let syncedAt = summary.syncedAt else {
            return true
        }

        return Date().timeIntervalSince(syncedAt) >= 60 * 60 * 24
    }

    private static func loadDocument(for selection: StoredBlocklistSelection) async throws -> BlocklistDocument {
        if let remoteURL = selection.resolvedDocumentURL {
            do {
                let (data, response) = try await session.data(from: remoteURL)
                guard let httpResponse = response as? HTTPURLResponse,
                      200..<300 ~= httpResponse.statusCode else {
                    throw URLError(.badServerResponse)
                }
                return try decoder.decode(BlocklistDocument.self, from: data)
            } catch {
                throw BlocklistSyncServiceError.remoteBlocklistUnavailable(selection.title)
            }
        }

        throw BlocklistSyncServiceError.remoteBlocklistUnavailable(selection.title)
    }

    private static func loadSeedRepository() throws -> BlocklistRepositoryDocument {
        let data = try loadBundledData(resourceName: "spam-blocklist-repo-seed")
        return try decoder.decode(BlocklistRepositoryDocument.self, from: data)
    }

    private static func loadBundledData(resourceName: String) throws -> Data {
        let bundles = [Bundle.main] + Bundle.allBundles + Bundle.allFrameworks
        for bundle in bundles {
            if let url = bundle.url(forResource: resourceName, withExtension: "json") {
                return try Data(contentsOf: url)
            }
        }

        throw BlocklistSyncServiceError.bundledSeedMissing(resourceName)
    }

    private static func firstAvailableEntry(
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

    private static func combinedSourceLabel(from sources: [String]) -> String {
        let uniqueSources = Array(NSOrderedSet(array: sources)) as? [String] ?? sources
        guard uniqueSources.count > 2 else {
            return uniqueSources.joined(separator: " + ")
        }

        return uniqueSources.prefix(2).joined(separator: " + ") + " + etc."
    }

    private static let decoder = JSONDecoder()

    private static let session: URLSession = {
        let configuration = URLSessionConfiguration.ephemeral
        configuration.timeoutIntervalForRequest = 8
        configuration.timeoutIntervalForResource = 12
        configuration.waitsForConnectivity = false
        return URLSession(configuration: configuration)
    }()

    private static func isReachable(url: URL) async -> Bool {
        var request = URLRequest(url: url)
        request.httpMethod = "HEAD"

        do {
            let (_, response) = try await session.data(for: request)
            if let httpResponse = response as? HTTPURLResponse, 200..<300 ~= httpResponse.statusCode {
                return true
            }
        } catch {}

        do {
            let (_, response) = try await session.data(from: url)
            if let httpResponse = response as? HTTPURLResponse {
                return 200..<300 ~= httpResponse.statusCode
            }
        } catch {}

        return false
    }

    static let repositoryURL = URL(
        string: "https://raw.githubusercontent.com/ffimnsr/spam-sniper/master/blocklist/repo.json"
    )
}
