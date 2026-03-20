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

    var errorDescription: String? {
        switch self {
        case let .bundledSeedMissing(resourceName):
            return """
            The bundled seed blocklist resource \(resourceName) is missing from the app build. \
            Clean the build folder, delete the app from Simulator, and run it again.
            """
        case .repositoryEmpty:
            return "The blocklist repository did not publish any blocklists."
        }
    }
}

enum BlocklistSyncService {
    static func refreshIfNeeded(excluding contactNumbers: Set<Int64> = []) async throws -> BlocklistDatabaseSummary {
        try BlocklistDatabase.initializeIfNeeded()

        let repository = try await fetchRepository()
        let selection = try resolveSelection(in: repository)
        let currentSummary = try BlocklistDatabase.fetchSummary()
        if shouldRefresh(summary: currentSummary, selectedBlocklistID: selection.id) {
            try await refreshNow(using: selection, excluding: contactNumbers)
        }

        return try BlocklistDatabase.fetchSummary()
    }

    static func refreshNow(excluding contactNumbers: Set<Int64> = []) async throws {
        let repository = try await fetchRepository()
        let selection = try resolveSelection(in: repository)
        try await refreshNow(using: selection, excluding: contactNumbers)
    }

    static func refreshNow(using selection: StoredBlocklistSelection, excluding contactNumbers: Set<Int64> = []) async throws {
        try BlocklistDatabase.initializeIfNeeded()

        let document = try await loadDocument(for: selection)
        let records = document.entries
            .compactMap(BlockedNumberRecord.from(document:))
            .filter { !contactNumbers.contains($0.phoneNumber) }
        try BlocklistDatabase.replaceEntries(
            records,
            blocklistID: selection.id,
            source: document.source,
            syncedAt: Date()
        )
    }

    static func fetchSnapshot() throws -> BlocklistSnapshot {
        try BlocklistDatabase.initializeIfNeeded()
        let snapshot = try BlocklistDatabase.fetchSnapshot()

        if snapshot.records.isEmpty {
            let repository = try loadSeedRepository()
            let selection = try resolveSelection(in: repository)
            let document = try loadSeedDocument(resourceName: selection.seedResource)
            let records = document.entries.compactMap(BlockedNumberRecord.from(document:))
            try BlocklistDatabase.replaceEntries(
                records,
                blocklistID: selection.id,
                source: document.source,
                syncedAt: Date()
            )
            return try BlocklistDatabase.fetchSnapshot()
        }

        return snapshot
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

    static func resolveSelection(in repository: BlocklistRepositoryDocument) throws -> StoredBlocklistSelection {
        let catalog = repository.catalogEntries(relativeTo: repositoryURL)

        if let storedSelection = SpamBlockerShared.selectedBlocklist,
           let matchingEntry = catalog.first(where: { $0.id == storedSelection.id }) {
            let refreshedSelection = StoredBlocklistSelection(entry: matchingEntry)
            SpamBlockerShared.selectedBlocklist = refreshedSelection
            return refreshedSelection
        }

        let defaultEntry: BlocklistCatalogEntry? = if let defaultBlocklistID = repository.defaultBlocklistID {
            catalog.first(where: { $0.id == defaultBlocklistID })
        } else {
            nil
        }

        let selection = StoredBlocklistSelection(entry: try firstAvailableEntry(defaultEntry, catalog: catalog))
        SpamBlockerShared.selectedBlocklist = selection
        return selection
    }

    static func updateSelectedBlocklist(to entry: BlocklistCatalogEntry) {
        SpamBlockerShared.selectedBlocklist = StoredBlocklistSelection(entry: entry)
    }

    private static func shouldRefresh(summary: BlocklistDatabaseSummary, selectedBlocklistID: String) -> Bool {
        guard summary.blocklistID == selectedBlocklistID else {
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
                return try loadSeedDocument(resourceName: selection.seedResource)
            }
        }

        return try loadSeedDocument(resourceName: selection.seedResource)
    }

    private static func loadSeedRepository() throws -> BlocklistRepositoryDocument {
        let data = try loadBundledData(resourceName: "spam-blocklist-repo-seed")
        return try decoder.decode(BlocklistRepositoryDocument.self, from: data)
    }

    private static func loadSeedDocument(resourceName: String) throws -> BlocklistDocument {
        let data = try loadBundledData(resourceName: resourceName)
        return try decoder.decode(BlocklistDocument.self, from: data)
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

    private static let decoder = JSONDecoder()

    private static let session: URLSession = {
        let configuration = URLSessionConfiguration.ephemeral
        configuration.timeoutIntervalForRequest = 8
        configuration.timeoutIntervalForResource = 12
        configuration.waitsForConnectivity = false
        return URLSession(configuration: configuration)
    }()

    static let repositoryURL = URL(
        string: "https://raw.githubusercontent.com/ffimnsr/spam-sniper/master/blocklist/repo.json"
    )
}
