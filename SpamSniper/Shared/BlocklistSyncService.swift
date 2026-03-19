//
//  BlocklistSyncService.swift
//  SpamSniper
//
//  Created by Codex on 3/19/26.
//

import Foundation

enum BlocklistSyncService {
    static func refreshIfNeeded() async throws -> BlocklistDatabaseSummary {
        try BlocklistDatabase.initializeIfNeeded()

        let currentSummary = try BlocklistDatabase.fetchSummary()
        if shouldRefresh(summary: currentSummary) {
            try await refreshNow()
        }

        return try BlocklistDatabase.fetchSummary()
    }

    static func refreshNow() async throws {
        try BlocklistDatabase.initializeIfNeeded()

        let document = try await loadDocument()
        let records = document.entries.compactMap(BlockedNumberRecord.from(document:))
        try BlocklistDatabase.replaceEntries(records, source: document.source, syncedAt: Date())
    }

    static func fetchSnapshot() throws -> BlocklistSnapshot {
        try BlocklistDatabase.initializeIfNeeded()
        let snapshot = try BlocklistDatabase.fetchSnapshot()

        if snapshot.records.isEmpty {
            let document = try loadSeedDocument()
            let records = document.entries.compactMap(BlockedNumberRecord.from(document:))
            try BlocklistDatabase.replaceEntries(records, source: document.source, syncedAt: Date())
            return try BlocklistDatabase.fetchSnapshot()
        }

        return snapshot
    }

    private static func shouldRefresh(summary: BlocklistDatabaseSummary) -> Bool {
        guard let syncedAt = summary.syncedAt else {
            return true
        }

        return Date().timeIntervalSince(syncedAt) >= 60 * 60 * 24
    }

    private static func loadDocument() async throws -> BlocklistDocument {
        if let remoteURL = remoteURL {
            do {
                let (data, _) = try await URLSession.shared.data(from: remoteURL)
                return try decoder.decode(BlocklistDocument.self, from: data)
            } catch {
                return try loadSeedDocument()
            }
        }

        return try loadSeedDocument()
    }

    private static func loadSeedDocument() throws -> BlocklistDocument {
        guard let url = Bundle.main.url(forResource: "spam-blocklist-seed", withExtension: "json") else {
            throw CocoaError(.fileNoSuchFile)
        }

        let data = try Data(contentsOf: url)
        return try decoder.decode(BlocklistDocument.self, from: data)
    }

    private static let decoder = JSONDecoder()

    // Replace with the raw URL of the committed blocklist file when the repo is ready.
    private static let remoteURL: URL? = nil
}
