import XCTest
@testable import SpamSniper

@MainActor
final class PhaseFiveSelectionPersistenceTests: XCTestCase {
    func testSwitchingRepositoriesRestoresSelectionsPerRepository() throws {
        let repositoryA = StoredRepository(
            validatedURL: URL(string: "https://example.com/repo-a/repo.json")!,
            repoName: "Repository A",
            id: "repo-a"
        )
        let repositoryB = StoredRepository(
            validatedURL: URL(string: "https://example.com/repo-b/repo.json")!,
            repoName: "Repository B",
            id: "repo-b"
        )
        let documentA = makeRepositoryDocument(
            name: "Repository A",
            defaultBlocklistID: "PH/default",
            countryCode: "PH",
            countryName: "Philippines",
            blocklists: [
                makeBlocklistEntry(id: "PH/default", title: "Alpha Default", path: "PH/default.json"),
                makeBlocklistEntry(id: "PH/secondary", title: "Zulu Secondary", path: "PH/secondary.json")
            ]
        )
        let documentB = makeRepositoryDocument(
            name: "Repository B",
            defaultBlocklistID: "US/default",
            countryCode: "US",
            countryName: "United States",
            blocklists: [
                makeBlocklistEntry(id: "US/default", title: "Bravo Default", path: "US/default.json"),
                makeBlocklistEntry(id: "US/secondary", title: "Charlie Secondary", path: "US/secondary.json")
            ]
        )
        let defaults = try XCTUnwrap(UserDefaults(suiteName: SpamBlockerShared.appGroupIdentifier))

        try withSharedSelectionState(
            defaults: defaults,
            repositories: [repositoryA, repositoryB],
            activeRepositoryID: nil
        ) {
            BlocklistSyncService.setActiveRepository(repositoryA)
            XCTAssertEqual(try BlocklistSyncService.resolveSelections(in: documentA).map(\.id), ["PH/default"])

            let repositoryAEntries = documentA.catalogEntries(relativeTo: repositoryA.resolvedURL)
            let repositoryASelections = repositoryAEntries.filter {
                Set(["PH/default", "PH/secondary"]).contains($0.id)
            }
            BlocklistSyncService.updateSelectedBlocklists(to: repositoryASelections)
            XCTAssertEqual(Set(SpamBlockerShared.selectedBlocklists.map(\.id)), Set(["PH/default", "PH/secondary"]))

            BlocklistSyncService.setActiveRepository(repositoryB)
            XCTAssertEqual(try BlocklistSyncService.resolveSelections(in: documentB).map(\.id), ["US/default"])

            let repositoryBSelection = try XCTUnwrap(
                documentB.catalogEntries(relativeTo: repositoryB.resolvedURL)
                    .first(where: { $0.id == "US/secondary" })
            )
            BlocklistSyncService.updateSelectedBlocklists(to: [repositoryBSelection])
            XCTAssertEqual(SpamBlockerShared.selectedBlocklists.map(\.id), ["US/secondary"])

            BlocklistSyncService.setActiveRepository(repositoryA)
            XCTAssertEqual(
                Set(try BlocklistSyncService.resolveSelections(in: documentA).map(\.id)),
                Set(["PH/default", "PH/secondary"])
            )

            BlocklistSyncService.setActiveRepository(repositoryB)
            XCTAssertEqual(try BlocklistSyncService.resolveSelections(in: documentB).map(\.id), ["US/secondary"])
        }
    }

    func testLegacyGlobalSelectionsMigrateToCurrentActiveRepositoryOnly() throws {
        let repositoryA = StoredRepository(
            validatedURL: URL(string: "https://example.com/repo-a/repo.json")!,
            repoName: "Repository A",
            id: "repo-a"
        )
        let repositoryB = StoredRepository(
            validatedURL: URL(string: "https://example.com/repo-b/repo.json")!,
            repoName: "Repository B",
            id: "repo-b"
        )
        let legacySelection = StoredBlocklistSelection(
            entry: BlocklistCatalogEntry(
                id: "PH/default",
                countryCode: "PH",
                countryName: "Philippines",
                title: "Alpha Default",
                description: "Default list",
                source: "Community",
                documentURL: URL(string: "https://example.com/repo-a/PH/default.json"),
                signatureURL: URL(string: "https://example.com/repo-a/PH/default.json.asc")
            )
        )
        let defaults = try XCTUnwrap(UserDefaults(suiteName: SpamBlockerShared.appGroupIdentifier))

        try withSharedSelectionState(
            defaults: defaults,
            repositories: [repositoryA, repositoryB],
            activeRepositoryID: repositoryA.id
        ) {
            defaults.removeObject(forKey: selectionMapKey)
            defaults.set(try JSONEncoder().encode([legacySelection]), forKey: legacySelectionListKey)
            defaults.set(try JSONEncoder().encode(legacySelection), forKey: legacySelectionKey)

            XCTAssertEqual(SpamBlockerShared.selectedBlocklists(forRepositoryID: repositoryA.id), [legacySelection])
            XCTAssertTrue(SpamBlockerShared.selectedBlocklists(forRepositoryID: repositoryB.id).isEmpty)
            XCTAssertNil(defaults.data(forKey: legacySelectionListKey))
            XCTAssertNil(defaults.data(forKey: legacySelectionKey))

            let migratedData = try XCTUnwrap(defaults.data(forKey: selectionMapKey))
            let migratedSelections = try JSONDecoder().decode([String: [StoredBlocklistSelection]].self, from: migratedData)
            XCTAssertEqual(migratedSelections[repositoryA.id], [legacySelection])
            XCTAssertNil(migratedSelections[repositoryB.id])
        }
    }
}

private extension PhaseFiveSelectionPersistenceTests {
    var legacySelectionKey: String { "spamBlocker.selectedBlocklist" }
    var legacySelectionListKey: String { "spamBlocker.selectedBlocklists" }
    var selectionMapKey: String { "spamBlocker.selectedBlocklistsByRepository" }

    func withSharedSelectionState(
        defaults: UserDefaults,
        repositories: [StoredRepository],
        activeRepositoryID: String?,
        perform body: () throws -> Void
    ) throws {
        let originalRepositories = SpamBlockerShared.repositories
        let originalActiveRepositoryID = SpamBlockerShared.activeRepositoryID
        let originalLegacySelection = defaults.data(forKey: legacySelectionKey)
        let originalLegacySelections = defaults.data(forKey: legacySelectionListKey)
        let originalSelectionMap = defaults.data(forKey: selectionMapKey)

        SpamBlockerShared.repositories = repositories
        SpamBlockerShared.activeRepositoryID = activeRepositoryID
        defaults.removeObject(forKey: legacySelectionKey)
        defaults.removeObject(forKey: legacySelectionListKey)
        defaults.removeObject(forKey: selectionMapKey)

        defer {
            SpamBlockerShared.repositories = originalRepositories
            SpamBlockerShared.activeRepositoryID = originalActiveRepositoryID
            restore(originalLegacySelection, to: legacySelectionKey, in: defaults)
            restore(originalLegacySelections, to: legacySelectionListKey, in: defaults)
            restore(originalSelectionMap, to: selectionMapKey, in: defaults)
        }

        try body()
    }

    func restore(_ data: Data?, to key: String, in defaults: UserDefaults) {
        if let data {
            defaults.set(data, forKey: key)
        } else {
            defaults.removeObject(forKey: key)
        }
    }

    func makeRepositoryDocument(
        name: String,
        defaultBlocklistID: String,
        countryCode: String,
        countryName: String,
        blocklists: [BlocklistRepositoryEntry]
    ) -> BlocklistRepositoryDocument {
        BlocklistRepositoryDocument(
            name: name,
            gpgKeyURL: "keys/community.asc",
            defaultBlocklistID: defaultBlocklistID,
            countries: [
                BlocklistRepositoryCountry(
                    code: countryCode,
                    name: countryName,
                    signatureURL: "\(countryCode)/default.asc",
                    blocklists: blocklists
                )
            ]
        )
    }

    func makeBlocklistEntry(id: String, title: String, path: String) -> BlocklistRepositoryEntry {
        BlocklistRepositoryEntry(
            id: id,
            title: title,
            description: "Default list",
            path: path,
            source: "Community",
            signatureURL: nil
        )
    }
}
