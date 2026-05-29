import XCTest
@testable import SpamSniper

@MainActor
final class PersonalBlocklistImportExportTests: XCTestCase {
    func testExportJSONLinesIncludesOneJSONObjectPerEntry() throws {
        let store = PersonalBlocklistStore.shared
        let originalEntries = store.entries
        defer { store.entries = originalEntries }
        
        store.entries = [
            makeEntry(phoneNumber: 1_555_000_1111, displayName: "Alpha"),
            makeEntry(phoneNumber: 1_555_000_2222, displayName: "Beta")
        ]
        
        let data = try store.exportJSONLines()
        let lines = try XCTUnwrap(String(data: data, encoding: .utf8))
            .split(separator: "\n")
        
        XCTAssertEqual(lines.count, 2)
        XCTAssertTrue(lines[0].contains("\"phoneNumber\":\"+15550001111\""))
        XCTAssertTrue(lines[1].contains("\"phoneNumber\":\"+15550002222\""))
    }
    
    func testPreviewImportReportsAdditionsUpdatesAndCollapsedDuplicates() throws {
        let store = PersonalBlocklistStore.shared
        let originalEntries = store.entries
        defer { store.entries = originalEntries }
        
        store.entries = [
            makeEntry(phoneNumber: 1_555_000_1111, displayName: "Existing")
        ]
        
        let payload = """
        {"phoneNumber":"+1 (555) 000-1111","displayName":"Updated Existing"}
        {"phoneNumber":"+1 555 000 2222","displayName":"First New"}
        {"phoneNumber":"+1 555 000 2222","displayName":"Last New"}
        """
        
        let preview = try store.previewImport(from: Data(payload.utf8))
        
        XCTAssertEqual(preview.importedCount, 2)
        XCTAssertEqual(preview.updatesCount, 1)
        XCTAssertEqual(preview.additionsCount, 1)
        XCTAssertEqual(preview.duplicateCountInImport, 1)
        XCTAssertEqual(preview.currentCount, 1)
        XCTAssertEqual(preview.mergedTotalCount, 2)
        XCTAssertEqual(preview.importedEntries.last?.displayName, "Last New")
    }
    
    func testMergeImportedEntriesAppliesPreviewToStoredEntries() throws {
        let store = PersonalBlocklistStore.shared
        let originalEntries = store.entries
        defer { store.entries = originalEntries }
        
        store.entries = [
            makeEntry(phoneNumber: 1_555_000_1111, displayName: "Existing")
        ]
        
        let payload = """
        {"phoneNumber":"+15550001111","displayName":"Updated Existing","notes":"Updated note"}
        {"phoneNumber":"+15550002222","displayName":"New Entry"}
        """
        
        let preview = try store.previewImport(from: Data(payload.utf8))
        let result = store.mergeImportedEntries(using: preview)
        
        XCTAssertEqual(result.importedCount, 2)
        XCTAssertEqual(result.updatesCount, 1)
        XCTAssertEqual(result.additionsCount, 1)
        XCTAssertEqual(result.finalTotalCount, 2)
        XCTAssertEqual(store.entries.count, 2)
        XCTAssertEqual(store.entry(forDigits: "15550001111")?.displayName, "Updated Existing")
        XCTAssertEqual(store.entry(forDigits: "15550001111")?.notes, "Updated note")
        XCTAssertEqual(store.entry(forDigits: "15550002222")?.displayName, "New Entry")
    }
    
    func testPreviewImportRejectsInvalidPhoneNumbers() throws {
        let store = PersonalBlocklistStore.shared
        let originalEntries = store.entries
        defer { store.entries = originalEntries }
        
        let payload = """
        {"phoneNumber":"not-a-number","displayName":"Broken"}
        """
        
        XCTAssertThrowsError(try store.previewImport(from: Data(payload.utf8))) { error in
            XCTAssertEqual(
                (error as? PersonalBlocklistTransferError)?.errorDescription,
                PersonalBlocklistTransferError.invalidPhoneNumber(lineNumber: 1).errorDescription
            )
        }
    }

    func testPreviewImportRejectsNumbersWithoutCountryCode() throws {
        let store = PersonalBlocklistStore.shared
        let originalEntries = store.entries
        defer { store.entries = originalEntries }

        let payload = """
        {"phoneNumber":"5550003333","displayName":"Local Only"}
        """

        XCTAssertThrowsError(try store.previewImport(from: Data(payload.utf8))) { error in
            XCTAssertEqual(
                (error as? PersonalBlocklistTransferError)?.errorDescription,
                PersonalBlocklistTransferError.invalidPhoneNumber(lineNumber: 1).errorDescription
            )
        }
    }
}

private extension PersonalBlocklistImportExportTests {
    func makeEntry(phoneNumber: Int64, displayName: String, notes: String = "") -> PersonalBlocklistEntry {
        PersonalBlocklistEntry(
            id: "entry-\(phoneNumber)",
            phoneNumber: phoneNumber,
            displayName: displayName,
            notes: notes,
            tags: [],
            createdAt: Date(timeIntervalSince1970: 1_716_508_800),
            updatedAt: Date(timeIntervalSince1970: 1_716_595_200)
        )
    }
}
