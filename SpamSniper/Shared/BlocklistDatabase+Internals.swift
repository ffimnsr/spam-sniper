//
//  BlocklistDatabase+Internals.swift
//  SpamSniper
//

import Foundation
import SQLite3

extension BlocklistDatabase {
    static func withDatabase<T>(_ operation: (OpaquePointer?) throws -> T) throws -> T {
        try initializeFileSystemIfNeeded()
        let url = try databaseURL

        var database: OpaquePointer?
        let flags = SQLITE_OPEN_CREATE | SQLITE_OPEN_READWRITE | SQLITE_OPEN_FULLMUTEX
        guard sqlite3_open_v2(url.path, &database, flags, nil) == SQLITE_OK else {
            throw BlocklistDatabaseError.openDatabaseFailed
        }
        defer { sqlite3_close(database) }

        try execute("PRAGMA journal_mode=WAL;", database: database)
        try execute("PRAGMA synchronous=NORMAL;", database: database)

        return try operation(database)
    }

    static func initializeFileSystemIfNeeded() throws {
        let directoryURL = try databaseURL.deletingLastPathComponent()
        try FileManager.default.createDirectory(at: directoryURL, withIntermediateDirectories: true)
    }

    static var databaseURL: URL {
        get throws {
            guard let containerURL = FileManager.default.containerURL(
                forSecurityApplicationGroupIdentifier: SpamBlockerShared.appGroupIdentifier
            ) else {
                throw BlocklistDatabaseError.sharedContainerUnavailable
            }

            return containerURL.appendingPathComponent("Database/spam-sniper.sqlite")
        }
    }

    static func execute(_ sql: String, database: OpaquePointer?) throws {
        guard sqlite3_exec(database, sql, nil, nil, nil) == SQLITE_OK else {
            throw BlocklistDatabaseError.executionFailed(lastErrorMessage(from: database))
        }
    }

    static func setMetadataValue(_ value: String, forKey key: String, database: OpaquePointer?) throws {
        let sql =
        """
        INSERT INTO metadata(key, value)
        VALUES(?, ?)
        ON CONFLICT(key) DO UPDATE SET value = excluded.value;
        """

        var statement: OpaquePointer?
        guard sqlite3_prepare_v2(database, sql, -1, &statement, nil) == SQLITE_OK else {
            throw BlocklistDatabaseError.prepareFailed(lastErrorMessage(from: database))
        }
        defer { sqlite3_finalize(statement) }

        sqlite3_bind_text(statement, 1, key, -1, transientDestructor)
        sqlite3_bind_text(statement, 2, value, -1, transientDestructor)

        guard sqlite3_step(statement) == SQLITE_DONE else {
            throw BlocklistDatabaseError.executionFailed(lastErrorMessage(from: database))
        }
    }

    static func addColumnIfNeeded(
        _ columnName: String,
        definition: String,
        to tableName: String,
        database: OpaquePointer?
    ) throws {
        guard !columnExists(columnName, in: tableName, database: database) else {
            return
        }

        try execute(
            "ALTER TABLE \(tableName) ADD COLUMN \(columnName) \(definition);",
            database: database
        )
    }

    static func columnExists(_ columnName: String, in tableName: String, database: OpaquePointer?) -> Bool {
        let sql = "PRAGMA table_info(\(tableName));"
        var statement: OpaquePointer?
        guard sqlite3_prepare_v2(database, sql, -1, &statement, nil) == SQLITE_OK else {
            return false
        }
        defer { sqlite3_finalize(statement) }

        while sqlite3_step(statement) == SQLITE_ROW {
            if sqliteString(from: statement, column: 1) == columnName {
                return true
            }
        }

        return false
    }

    static func metadataValue(forKey key: String, database: OpaquePointer?) -> String? {
        let sql = "SELECT value FROM metadata WHERE key = ? LIMIT 1;"
        var statement: OpaquePointer?
        guard sqlite3_prepare_v2(database, sql, -1, &statement, nil) == SQLITE_OK else {
            return nil
        }
        defer { sqlite3_finalize(statement) }

        sqlite3_bind_text(statement, 1, key, -1, transientDestructor)
        guard sqlite3_step(statement) == SQLITE_ROW else {
            return nil
        }

        return sqliteString(from: statement, column: 0)
    }

    static func metadataValues(forKeys keys: [String], database: OpaquePointer?) -> [String] {
        for key in keys {
            guard let rawValue = metadataValue(forKey: key, database: database), !rawValue.isEmpty else {
                continue
            }

            return rawValue
                .split(separator: ",")
                .map { String($0).trimmingCharacters(in: .whitespacesAndNewlines) }
                .filter { !$0.isEmpty }
        }

        return []
    }

    static func decodeRecord(from statement: OpaquePointer?, decoder: JSONDecoder) throws -> BlockedNumberRecord {
        let phoneNumber = sqlite3_column_int64(statement, 0)
        let displayName = sqliteString(from: statement, column: 1)
        let category = sqliteString(from: statement, column: 2)
        let confidence = sqliteString(from: statement, column: 3)
        let aliases = try decoder.decode([String].self, from: Data(sqliteString(from: statement, column: 4).utf8))
        let tags = try decoder.decode([String].self, from: Data(sqliteString(from: statement, column: 5).utf8))
        let notes = sqliteString(from: statement, column: 6)
        let sourceBlocklistIDs = try decoder.decode([String].self, from: Data(sqliteString(from: statement, column: 7).utf8))
        let sourceBlocklistTitles = try decoder.decode([String].self, from: Data(sqliteString(from: statement, column: 8).utf8))

        return BlockedNumberRecord(
            phoneNumber: phoneNumber,
            displayName: displayName,
            category: category,
            confidence: confidence,
            aliases: aliases,
            tags: tags,
            notes: notes,
            sourceBlocklistIDs: sourceBlocklistIDs,
            sourceBlocklistTitles: sourceBlocklistTitles
        )
    }

    static func preparedSearchStatement(
        for queryDigits: String,
        limit: Int,
        database: OpaquePointer?
    ) throws -> OpaquePointer? {
        let query =
        """
        SELECT phone_number, display_name, category, confidence, aliases_json, tags_json, notes,
               source_blocklist_ids_json, source_blocklist_titles_json
        FROM blocked_numbers
        WHERE CAST(phone_number AS TEXT) LIKE ?
        ORDER BY
            CASE
                WHEN CAST(phone_number AS TEXT) = ? THEN 0
                WHEN CAST(phone_number AS TEXT) LIKE ? THEN 1
                ELSE 2
            END,
            phone_number ASC
        LIMIT ?;
        """

        var statement: OpaquePointer?
        guard sqlite3_prepare_v2(database, query, -1, &statement, nil) == SQLITE_OK else {
            throw BlocklistDatabaseError.prepareFailed(lastErrorMessage(from: database))
        }

        let containsPattern = "%\(queryDigits)%"
        let suffixPattern = "%\(queryDigits)"
        sqlite3_bind_text(statement, 1, containsPattern, -1, transientDestructor)
        sqlite3_bind_text(statement, 2, queryDigits, -1, transientDestructor)
        sqlite3_bind_text(statement, 3, suffixPattern, -1, transientDestructor)
        sqlite3_bind_int(statement, 4, Int32(max(1, min(limit, 500))))
        return statement
    }

    static func searchResults(
        from statement: OpaquePointer?,
        queryDigits: String
    ) throws -> [BlockedNumberSearchResult] {
        let decoder = JSONDecoder()
        var results: [BlockedNumberSearchResult] = []

        while sqlite3_step(statement) == SQLITE_ROW {
            let record = try decodeRecord(from: statement, decoder: decoder)
            results.append(
                BlockedNumberSearchResult(
                    record: record,
                    matchedDigits: queryDigits,
                    matchKind: matchKind(for: record, queryDigits: queryDigits)
                )
            )
        }

        return results
    }

    static func matchKind(
        for record: BlockedNumberRecord,
        queryDigits: String
    ) -> BlockedNumberSearchResult.MatchKind {
        if record.normalizedDigits == queryDigits {
            return .exact
        }

        return record.normalizedDigits.hasSuffix(queryDigits) ? .suffix : .contains
    }

    static func sqliteString(from statement: OpaquePointer?, column: Int32) -> String {
        guard let raw = sqlite3_column_text(statement, column) else {
            return ""
        }

        return String(cString: raw)
    }

    static func lastErrorMessage(from database: OpaquePointer?) -> String {
        guard let database else {
            return "Unknown SQLite error"
        }

        return String(cString: sqlite3_errmsg(database))
    }

    static let transientDestructor = unsafeBitCast(-1, to: sqlite3_destructor_type.self)
    static let iso8601Formatter = ISO8601DateFormatter()
}

extension Optional {
    func unwrap() throws -> Wrapped {
        guard let self else {
            throw BlocklistDatabaseError.executionFailed("Unexpected nil while encoding blocklist data")
        }

        return self
    }
}
