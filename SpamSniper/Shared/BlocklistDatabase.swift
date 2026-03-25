//
//  BlocklistDatabase.swift
//  SpamSniper
//
//  Created by Codex on 3/19/26.
//

import Foundation
import SQLite3

enum BlocklistDatabaseError: Error {
    case sharedContainerUnavailable
    case openDatabaseFailed
    case prepareFailed(String)
    case executionFailed(String)
}

struct BlocklistDatabaseSummary {
    let totalEntries: Int
    let blocklistIDs: [String]
    let source: String?
    let syncedAt: Date?
}

struct BlocklistSearchResponse {
    let queryDigits: String
    let results: [BlockedNumberSearchResult]
}

enum BlocklistDatabase {
    static func initializeIfNeeded() throws {
        try withDatabase { database in
            try execute(
                """
                CREATE TABLE IF NOT EXISTS blocked_numbers (
                    phone_number INTEGER PRIMARY KEY,
                    display_name TEXT NOT NULL,
                    category TEXT NOT NULL,
                    confidence TEXT NOT NULL,
                    aliases_json TEXT NOT NULL,
                    tags_json TEXT NOT NULL,
                    notes TEXT NOT NULL
                );
                """,
                database: database
            )

            try execute(
                """
                CREATE TABLE IF NOT EXISTS metadata (
                    key TEXT PRIMARY KEY,
                    value TEXT NOT NULL
                );
                """,
                database: database
            )
        }
    }

    static func replaceEntries(
        _ records: [BlockedNumberRecord],
        blocklistIDs: [String],
        source: String,
        syncedAt: Date
    ) throws {
        try withDatabase { database in
            try execute("BEGIN IMMEDIATE TRANSACTION;", database: database)

            do {
                try execute("DELETE FROM blocked_numbers;", database: database)

                let insertSQL =
                """
                INSERT INTO blocked_numbers (
                    phone_number,
                    display_name,
                    category,
                    confidence,
                    aliases_json,
                    tags_json,
                    notes
                ) VALUES (?, ?, ?, ?, ?, ?, ?);
                """

                var statement: OpaquePointer?
                guard sqlite3_prepare_v2(database, insertSQL, -1, &statement, nil) == SQLITE_OK else {
                    throw BlocklistDatabaseError.prepareFailed(lastErrorMessage(from: database))
                }
                defer { sqlite3_finalize(statement) }

                let encoder = JSONEncoder()

                for record in records.sorted(by: { $0.phoneNumber < $1.phoneNumber }) {
                    sqlite3_reset(statement)
                    sqlite3_clear_bindings(statement)

                    let aliasesJSON = try String(data: encoder.encode(record.aliases), encoding: .utf8).unwrap()
                    let tagsJSON = try String(data: encoder.encode(record.tags), encoding: .utf8).unwrap()

                    sqlite3_bind_int64(statement, 1, record.phoneNumber)
                    sqlite3_bind_text(statement, 2, record.displayName, -1, transientDestructor)
                    sqlite3_bind_text(statement, 3, record.category, -1, transientDestructor)
                    sqlite3_bind_text(statement, 4, record.confidence, -1, transientDestructor)
                    sqlite3_bind_text(statement, 5, aliasesJSON, -1, transientDestructor)
                    sqlite3_bind_text(statement, 6, tagsJSON, -1, transientDestructor)
                    sqlite3_bind_text(statement, 7, record.notes, -1, transientDestructor)

                    guard sqlite3_step(statement) == SQLITE_DONE else {
                        throw BlocklistDatabaseError.executionFailed(lastErrorMessage(from: database))
                    }
                }

                try setMetadataValue(blocklistIDs.joined(separator: ","), forKey: "blocklist_ids", database: database)
                if let firstBlocklistID = blocklistIDs.first {
                    try setMetadataValue(firstBlocklistID, forKey: "blocklist_id", database: database)
                }
                try setMetadataValue(source, forKey: "source", database: database)
                try setMetadataValue(iso8601Formatter.string(from: syncedAt), forKey: "synced_at", database: database)
                try execute("COMMIT;", database: database)
            } catch {
                try? execute("ROLLBACK;", database: database)
                throw error
            }
        }
    }

    static func fetchSnapshot() throws -> BlocklistSnapshot {
        try withDatabase { database in
            let query =
            """
            SELECT phone_number, display_name, category, confidence, aliases_json, tags_json, notes
            FROM blocked_numbers
            ORDER BY phone_number ASC;
            """

            var statement: OpaquePointer?
            guard sqlite3_prepare_v2(database, query, -1, &statement, nil) == SQLITE_OK else {
                throw BlocklistDatabaseError.prepareFailed(lastErrorMessage(from: database))
            }
            defer { sqlite3_finalize(statement) }

            let decoder = JSONDecoder()
            var records: [BlockedNumberRecord] = []

            while sqlite3_step(statement) == SQLITE_ROW {
                let phoneNumber = sqlite3_column_int64(statement, 0)
                let displayName = sqliteString(from: statement, column: 1)
                let category = sqliteString(from: statement, column: 2)
                let confidence = sqliteString(from: statement, column: 3)
                let aliases = try decoder.decode(
                    [String].self,
                    from: Data(sqliteString(from: statement, column: 4).utf8)
                )
                let tags = try decoder.decode(
                    [String].self,
                    from: Data(sqliteString(from: statement, column: 5).utf8)
                )
                let notes = sqliteString(from: statement, column: 6)

                records.append(
                    BlockedNumberRecord(
                        phoneNumber: phoneNumber,
                        displayName: displayName,
                        category: category,
                        confidence: confidence,
                        aliases: aliases,
                        tags: tags,
                        notes: notes
                    )
                )
            }

            return BlocklistSnapshot(
                records: records,
                blocklistIDs: metadataValues(forKeys: ["blocklist_ids", "blocklist_id"], database: database),
                source: metadataValue(forKey: "source", database: database) ?? "Unknown source",
                syncedAt: metadataValue(forKey: "synced_at", database: database)
                    .flatMap { iso8601Formatter.date(from: $0) }
            )
        }
    }

    static func fetchSummary() throws -> BlocklistDatabaseSummary {
        try withDatabase { database in
            let countSQL = "SELECT COUNT(*) FROM blocked_numbers;"
            var statement: OpaquePointer?
            guard sqlite3_prepare_v2(database, countSQL, -1, &statement, nil) == SQLITE_OK else {
                throw BlocklistDatabaseError.prepareFailed(lastErrorMessage(from: database))
            }
            defer { sqlite3_finalize(statement) }

            let totalEntries: Int
            if sqlite3_step(statement) == SQLITE_ROW {
                totalEntries = Int(sqlite3_column_int(statement, 0))
            } else {
                totalEntries = 0
            }

            return BlocklistDatabaseSummary(
                totalEntries: totalEntries,
                blocklistIDs: metadataValues(forKeys: ["blocklist_ids", "blocklist_id"], database: database),
                source: metadataValue(forKey: "source", database: database),
                syncedAt: metadataValue(forKey: "synced_at", database: database)
                    .flatMap { iso8601Formatter.date(from: $0) }
            )
        }
    }

    static func searchNumbers(matching rawQuery: String, limit: Int = 100) throws -> BlocklistSearchResponse {
        let queryDigits = BlockedNumberRecord.normalizedDigits(from: rawQuery)
        guard !queryDigits.isEmpty else {
            return BlocklistSearchResponse(queryDigits: "", results: [])
        }

        return try withDatabase { database in
            let statement = try preparedSearchStatement(
                for: queryDigits,
                limit: limit,
                database: database
            )
            defer { sqlite3_finalize(statement) }

            return BlocklistSearchResponse(
                queryDigits: queryDigits,
                results: try searchResults(
                    from: statement,
                    queryDigits: queryDigits
                )
            )
        }
    }
}
