import XCTest
@testable import SpamSniper

@MainActor
final class PhaseSixEffectiveBlockingAndSearchTests: XCTestCase {
    func testComposeIncludesRepositoryOnlyNumberInEffectiveSnapshot() throws {
        let originalMode = SpamBlockerShared.protectionMode
        SpamBlockerShared.protectionMode = .block
        defer { SpamBlockerShared.protectionMode = originalMode }

        let snapshot = try composeSnapshot(
            repositoryRecords: [
                makeRepositoryRecord(phoneNumber: 1_555_000_1111, displayName: "Repo Only")
            ],
            personalEntries: []
        )
        
        XCTAssertEqual(snapshot.blockedNumbers, [1_555_000_1111])
        XCTAssertEqual(snapshot.entries.first?.source, .repo)
        XCTAssertNil(snapshot.entries.first?.personalEntry)
        XCTAssertEqual(snapshot.entries.first?.action, .block)
    }
    
    func testComposeIncludesPersonalOnlyNumberInEffectiveSnapshot() throws {
        let personalEntry = makePersonalEntry(phoneNumber: 1_555_000_2222, displayName: "Personal Only", notes: "Manual block")
        let snapshot = try composeSnapshot(repositoryRecords: [], personalEntries: [personalEntry])
        
        XCTAssertEqual(snapshot.blockedNumbers, [1_555_000_2222])
        XCTAssertEqual(snapshot.entries.first?.source, .personal)
        XCTAssertEqual(snapshot.entries.first?.record.category, "Personal")
        XCTAssertEqual(snapshot.entries.first?.record.notes, "Manual block")
    }
    
    func testComposeCollapsesDuplicateRepositoryAndPersonalNumbers() throws {
        let personalEntry = makePersonalEntry(
            phoneNumber: 1_555_000_3333,
            displayName: "Manual label",
            notes: "Personal note",
            tags: ["manual", "vip"]
        )
        let snapshot = try composeSnapshot(
            repositoryRecords: [
                makeRepositoryRecord(
                    phoneNumber: 1_555_000_3333,
                    displayName: "Repo Label",
                    tags: ["repo", "vip"],
                    notes: ""
                )
            ],
            personalEntries: [personalEntry]
        )
        
        let entry = try XCTUnwrap(snapshot.entries.first)
        XCTAssertEqual(snapshot.entries.count, 1)
        XCTAssertEqual(entry.source, .combined)
        XCTAssertEqual(entry.personalEntry, personalEntry)
        XCTAssertEqual(entry.record.displayName, "Repo Label")
        XCTAssertEqual(entry.record.notes, "Personal note")
        XCTAssertEqual(entry.record.tags, ["repo", "vip", "manual"])
    }

    func testLabelOnlyModeConvertsRepoOnlyEntriesIntoIdentificationEntries() throws {
        let originalMode = SpamBlockerShared.protectionMode
        SpamBlockerShared.protectionMode = .labelOnly
        defer { SpamBlockerShared.protectionMode = originalMode }

        let snapshot = try composeSnapshot(
            repositoryRecords: [
                makeRepositoryRecord(
                    phoneNumber: 1_555_000_4444,
                    displayName: "Label Me",
                    sourceBlocklistIDs: ["PH/core"],
                    sourceBlocklistTitles: ["Community Core"]
                )
            ],
            personalEntries: []
        )

        XCTAssertTrue(snapshot.blockedNumbers.isEmpty)
        XCTAssertEqual(snapshot.identificationEntries.map(\.phoneNumber), [1_555_000_4444])
        XCTAssertEqual(snapshot.identificationEntries.first?.label, "Label Me")
        XCTAssertEqual(snapshot.entries.first?.action, .identify)
    }

    func testLabelOnlyModeKeepsPersonalAndCombinedEntriesBlocking() throws {
        let originalMode = SpamBlockerShared.protectionMode
        SpamBlockerShared.protectionMode = .labelOnly
        defer { SpamBlockerShared.protectionMode = originalMode }

        let personalOnly = makePersonalEntry(phoneNumber: 1_555_000_5555, displayName: "Manual")
        let combined = makePersonalEntry(phoneNumber: 1_555_000_6666, displayName: "Combined")

        let snapshot = try composeSnapshot(
            repositoryRecords: [
                makeRepositoryRecord(phoneNumber: 1_555_000_6666, displayName: "Repo Combined")
            ],
            personalEntries: [personalOnly, combined]
        )

        XCTAssertEqual(snapshot.blockedNumbers, [1_555_000_5555, 1_555_000_6666])
        XCTAssertTrue(snapshot.identificationEntries.isEmpty)
        XCTAssertEqual(snapshot.entries.map(\.action), [.block, .block])
    }
    
    func testSearchNumbersRanksExactMatchesBeforeSuffixAndContains() throws {
        let snapshot = try composeSnapshot(
            repositoryRecords: [
                makeRepositoryRecord(phoneNumber: 1_234, displayName: "Exact"),
                makeRepositoryRecord(phoneNumber: 99_1234, displayName: "Suffix"),
                makeRepositoryRecord(phoneNumber: 12_345, displayName: "Contains")
            ],
            personalEntries: []
        )
        
        let response = EffectiveBlocklistComposer.searchNumbers(matching: "1234", in: snapshot)
        
        XCTAssertEqual(response.queryDigits, "1234")
        XCTAssertEqual(response.results.map(\.matchKind), [.exact, .suffix, .contains])
        XCTAssertEqual(response.results.map(\.record.phoneNumber), [1_234, 99_1234, 12_345])
    }
    
    func testSearchNumbersOrdersPersonalCombinedAndRepoResultsAcrossMergedStates() throws {
        let snapshot = try composeSnapshot(
            repositoryRecords: [
                makeRepositoryRecord(phoneNumber: 777_1234, displayName: "Repo Only"),
                makeRepositoryRecord(phoneNumber: 888_1234, displayName: "Combined")
            ],
            personalEntries: [
                makePersonalEntry(phoneNumber: 666_1234, displayName: "Personal Only"),
                makePersonalEntry(phoneNumber: 888_1234, displayName: "Personal Combined")
            ]
        )
        
        let response = EffectiveBlocklistComposer.searchNumbers(matching: "1234", in: snapshot)
        
        XCTAssertEqual(response.results.map(\.source), [.personal, .combined, .repo])
        XCTAssertEqual(response.results.map(\.record.phoneNumber), [666_1234, 888_1234, 777_1234])
        XCTAssertEqual(response.results.map(\.matchKind), [.suffix, .suffix, .suffix])
    }

    func testSearchResultsExposeEffectiveActionAndBlocklistProvenance() throws {
        let originalMode = SpamBlockerShared.protectionMode
        SpamBlockerShared.protectionMode = .labelOnly
        defer { SpamBlockerShared.protectionMode = originalMode }

        let snapshot = try composeSnapshot(
            repositoryRecords: [
                makeRepositoryRecord(
                    phoneNumber: 777_1234,
                    displayName: "Repo Only",
                    sourceBlocklistIDs: ["PH/core"],
                    sourceBlocklistTitles: ["Community Core"]
                )
            ],
            personalEntries: []
        )

        let response = EffectiveBlocklistComposer.searchNumbers(matching: "1234", in: snapshot)

        XCTAssertEqual(response.results.first?.effectiveAction, .identify)
        XCTAssertEqual(response.results.first?.record.sourceBlocklistIDs, ["PH/core"])
        XCTAssertEqual(response.results.first?.record.sourceBlocklistTitles, ["Community Core"])
    }
    
    func testSearchNumbersRanksMatchQualityBeforeSourcePriority() throws {
        let snapshot = try composeSnapshot(
            repositoryRecords: [
                makeRepositoryRecord(phoneNumber: 1234, displayName: "Repo Exact"),
                makeRepositoryRecord(phoneNumber: 12_345, displayName: "Repo Contains")
            ],
            personalEntries: [
                makePersonalEntry(phoneNumber: 99_1234, displayName: "Personal Suffix")
            ]
        )
        
        let response = EffectiveBlocklistComposer.searchNumbers(matching: "1234", in: snapshot)
        
        XCTAssertEqual(response.results.map(\.matchKind), [.exact, .suffix, .contains])
        XCTAssertEqual(response.results.map(\.source), [.repo, .personal, .repo])
        XCTAssertEqual(response.results.map(\.record.phoneNumber), [1234, 99_1234, 12_345])
    }
    
    func testSearchNumbersHonorsZeroLimit() throws {
        let snapshot = try composeSnapshot(
            repositoryRecords: [
                makeRepositoryRecord(phoneNumber: 1234, displayName: "Repo Exact")
            ],
            personalEntries: []
        )
        
        let response = EffectiveBlocklistComposer.searchNumbers(matching: "1234", in: snapshot, limit: 0)
        
        XCTAssertEqual(response.queryDigits, "1234")
        XCTAssertTrue(response.results.isEmpty)
    }
}

private extension PhaseSixEffectiveBlockingAndSearchTests {
    func composeSnapshot(
        repositoryRecords: [BlockedNumberRecord],
        personalEntries: [PersonalBlocklistEntry]
    ) throws -> EffectiveBlocklistSnapshot {
        try EffectiveBlocklistComposer.compose(
            repositorySnapshot: BlocklistSnapshot(
                records: repositoryRecords,
                blocklistIDs: ["repo/core"],
                source: "Community Repo",
                syncedAt: Date(timeIntervalSince1970: 1_716_508_800)
            ),
            personalEntries: personalEntries
        )
    }
    
    func makeRepositoryRecord(
        phoneNumber: Int64,
        displayName: String,
        tags: [String] = [],
        notes: String = "Repository note",
        sourceBlocklistIDs: [String] = [],
        sourceBlocklistTitles: [String] = []
    ) -> BlockedNumberRecord {
        BlockedNumberRecord(
            phoneNumber: phoneNumber,
            displayName: displayName,
            category: "Spam",
            confidence: "high",
            aliases: [],
            tags: tags,
            notes: notes,
            sourceBlocklistIDs: sourceBlocklistIDs,
            sourceBlocklistTitles: sourceBlocklistTitles
        )
    }
    
    func makePersonalEntry(
        phoneNumber: Int64,
        displayName: String,
        notes: String = "",
        tags: [String] = []
    ) -> PersonalBlocklistEntry {
        PersonalBlocklistEntry(
            id: "entry-\(phoneNumber)",
            phoneNumber: phoneNumber,
            displayName: displayName,
            notes: notes,
            tags: tags,
            createdAt: Date(timeIntervalSince1970: 1_716_508_800),
            updatedAt: Date(timeIntervalSince1970: 1_716_595_200)
        )
    }
}
