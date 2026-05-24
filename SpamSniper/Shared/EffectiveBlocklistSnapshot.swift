import Foundation

struct EffectiveBlockedNumber: Identifiable, Equatable {
    let record: BlockedNumberRecord
    let personalEntry: PersonalBlocklistEntry?
    let source: BlockedNumberSearchResult.ResultSource

    var id: Int64 { record.id }
    var phoneNumber: Int64 { record.phoneNumber }
}

struct EffectiveBlocklistSnapshot {
    let entries: [EffectiveBlockedNumber]
    let blocklistIDs: [String]
    let repositorySource: String
    let syncedAt: Date?

    var records: [BlockedNumberRecord] {
        entries.map(\.record)
    }

    var blockedNumbers: [Int64] {
        entries.map(\.phoneNumber)
    }

    var totalEntries: Int {
        entries.count
    }

    var source: String {
        let hasRepositoryEntries = entries.contains { $0.source != .personal }
        let hasPersonalEntries = entries.contains { $0.source != .repo }
        let baseRepositorySource = repositorySource.trimmingCharacters(in: .whitespacesAndNewlines)
        let repositoryLabel = baseRepositorySource.isEmpty ? "Synced Blocklists" : baseRepositorySource

        switch (hasRepositoryEntries, hasPersonalEntries) {
        case (true, true):
            return "\(repositoryLabel) + Personal List"
        case (false, true):
            return "Personal List"
        default:
            return repositoryLabel
        }
    }
}

struct EffectiveBlocklistSearchResponse {
    let queryDigits: String
    let results: [BlockedNumberSearchResult]
}

enum EffectiveBlocklistComposer {
    static func fetchSnapshot() throws -> EffectiveBlocklistSnapshot {
        try compose(
            repositorySnapshot: BlocklistSyncService.fetchSnapshot(),
            personalEntries: PersonalBlocklistStore.shared.entries
        )
    }

    static func compose(
        repositorySnapshot: BlocklistSnapshot,
        personalEntries: [PersonalBlocklistEntry]
    ) throws -> EffectiveBlocklistSnapshot {
        var effectiveEntriesByNumber: [Int64: EffectiveBlockedNumber] = [:]
        let personalEntriesByNumber = Dictionary(
            personalEntries
                .sorted { lhs, rhs in
                    if lhs.updatedAt != rhs.updatedAt {
                        return lhs.updatedAt > rhs.updatedAt
                    }
                    return lhs.createdAt > rhs.createdAt
                }
                .map { ($0.phoneNumber, $0) },
            uniquingKeysWith: { current, _ in current }
        )

        for repositoryRecord in repositorySnapshot.records.sorted(by: { $0.phoneNumber < $1.phoneNumber }) {
            let personalEntry = personalEntriesByNumber[repositoryRecord.phoneNumber]
            effectiveEntriesByNumber[repositoryRecord.phoneNumber] = EffectiveBlockedNumber(
                record: mergedRepositoryRecord(repositoryRecord, personalEntry: personalEntry),
                personalEntry: personalEntry,
                source: personalEntry == nil ? .repo : .combined
            )
        }

        for personalEntry in personalEntriesByNumber.values where effectiveEntriesByNumber[personalEntry.phoneNumber] == nil {
            effectiveEntriesByNumber[personalEntry.phoneNumber] = EffectiveBlockedNumber(
                record: personalOnlyRecord(for: personalEntry),
                personalEntry: personalEntry,
                source: .personal
            )
        }

        return EffectiveBlocklistSnapshot(
            entries: effectiveEntriesByNumber
                .values
                .sorted { $0.phoneNumber < $1.phoneNumber },
            blocklistIDs: repositorySnapshot.blocklistIDs,
            repositorySource: repositorySnapshot.source,
            syncedAt: repositorySnapshot.syncedAt
        )
    }

    static func searchNumbers(matching rawQuery: String, limit: Int = 100) throws -> EffectiveBlocklistSearchResponse {
        let snapshot = try fetchSnapshot()
        return searchNumbers(matching: rawQuery, in: snapshot, limit: limit)
    }

    static func searchNumbers(
        matching rawQuery: String,
        in snapshot: EffectiveBlocklistSnapshot,
        limit: Int = 100
    ) -> EffectiveBlocklistSearchResponse {
        let queryDigits = BlockedNumberRecord.normalizedDigits(from: rawQuery)
        guard !queryDigits.isEmpty else {
            return EffectiveBlocklistSearchResponse(queryDigits: "", results: [])
        }

        let matchingResults: [BlockedNumberSearchResult] = snapshot.entries.compactMap { entry in
            guard entry.record.normalizedDigits.contains(queryDigits) else {
                return nil
            }

            return BlockedNumberSearchResult(
                record: entry.record,
                matchedDigits: queryDigits,
                matchKind: matchKind(for: entry.record, queryDigits: queryDigits),
                source: entry.source,
                personalEntry: entry.personalEntry
            )
        }
        let results = matchingResults
            .sorted { lhs, rhs in
                let lhsPriority = (matchPriority(lhs.matchKind), sourcePriority(lhs.source), lhs.record.phoneNumber)
                let rhsPriority = (matchPriority(rhs.matchKind), sourcePriority(rhs.source), rhs.record.phoneNumber)
                return lhsPriority < rhsPriority
            }
            .prefix(max(0, min(limit, 500)))

        return EffectiveBlocklistSearchResponse(queryDigits: queryDigits, results: Array(results))
    }
}

private extension EffectiveBlocklistComposer {
    static func mergedRepositoryRecord(
        _ repositoryRecord: BlockedNumberRecord,
        personalEntry: PersonalBlocklistEntry?
    ) -> BlockedNumberRecord {
        guard let personalEntry else {
            return repositoryRecord
        }

        let mergedDisplayName: String = {
            let repositoryName = repositoryRecord.displayName.trimmingCharacters(in: .whitespacesAndNewlines)
            guard repositoryName.isEmpty else {
                return repositoryRecord.displayName
            }

            let personalName = personalEntry.displayName.trimmingCharacters(in: .whitespacesAndNewlines)
            return personalName.isEmpty ? repositoryRecord.displayName : personalName
        }()

        let mergedNotes: String = {
            let repositoryNotes = repositoryRecord.notes.trimmingCharacters(in: .whitespacesAndNewlines)
            guard repositoryNotes.isEmpty else {
                return repositoryRecord.notes
            }
            return personalEntry.notes
        }()

        return BlockedNumberRecord(
            phoneNumber: repositoryRecord.phoneNumber,
            displayName: mergedDisplayName,
            category: repositoryRecord.category,
            confidence: repositoryRecord.confidence,
            aliases: repositoryRecord.aliases,
            tags: mergedTags(repositoryTags: repositoryRecord.tags, personalTags: personalEntry.tags),
            notes: mergedNotes
        )
    }

    static func personalOnlyRecord(for entry: PersonalBlocklistEntry) -> BlockedNumberRecord {
        let displayName = entry.displayName.trimmingCharacters(in: .whitespacesAndNewlines)
        return BlockedNumberRecord(
            phoneNumber: entry.phoneNumber,
            displayName: displayName.isEmpty ? entry.phoneNumberE164 : displayName,
            category: "Personal",
            confidence: "high",
            aliases: [],
            tags: entry.tags,
            notes: entry.notes
        )
    }

    static func mergedTags(repositoryTags: [String], personalTags: [String]) -> [String] {
        let combined = repositoryTags + personalTags
        var seen = Set<String>()
        return combined.filter { tag in
            let normalized = tag.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
            guard !normalized.isEmpty, seen.insert(normalized).inserted else {
                return false
            }
            return true
        }
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

    static func sourcePriority(_ source: BlockedNumberSearchResult.ResultSource) -> Int {
        switch source {
        case .personal:
            return 0
        case .combined:
            return 1
        case .repo:
            return 2
        }
    }

    static func matchPriority(_ matchKind: BlockedNumberSearchResult.MatchKind) -> Int {
        switch matchKind {
        case .exact:
            return 0
        case .suffix:
            return 1
        case .contains:
            return 2
        }
    }
}
