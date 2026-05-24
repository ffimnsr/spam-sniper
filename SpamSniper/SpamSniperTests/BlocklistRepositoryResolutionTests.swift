import XCTest
@testable import SpamSniper

final class BlocklistRepositoryResolutionTests: XCTestCase {
    func testNormalizedRepositoryURLReturnsDirectRepoJSONURLUnchanged() throws {
        let directURL = "https://example.com/catalog/repo.json"

        XCTAssertEqual(
            try BlocklistSyncService.normalizedRepositoryURL(from: directURL),
            URL(string: directURL)
        )
    }

    func testNormalizedRepositoryURLConvertsGitHubRepositoryURLToRawRepoJSON() throws {
        XCTAssertEqual(
            try BlocklistSyncService.normalizedRepositoryURL(from: "https://github.com/example/spam-sniper"),
            URL(string: "https://raw.githubusercontent.com/example/spam-sniper/main/blocklist/repo.json")
        )
    }

    func testResolvedCountriesUseRepositoryRelativeURLs() {
        let repository = makeRepository(
            gpgKeyURL: "keys/community.asc",
            countries: [
                BlocklistRepositoryCountry(
                    code: "PH",
                    name: "Philippines",
                    signatureURL: "signatures/ph.asc",
                    blocklists: [
                        BlocklistRepositoryEntry(
                            id: "PH/core",
                            title: "PH Core",
                            description: "Core numbers",
                            path: "PH/core.json",
                            source: "Community",
                            signatureURL: nil
                        )
                    ]
                )
            ]
        )

        let sections = repository.resolvedCountries(relativeTo: repositoryURL)

        XCTAssertEqual(sections.count, 1)
        XCTAssertEqual(sections[0].code, "PH")
        XCTAssertEqual(sections[0].name, "Philippines")
        XCTAssertEqual(sections[0].blocklists.count, 1)
        XCTAssertEqual(sections[0].blocklists[0].documentURL, URL(string: "https://example.com/catalog/PH/core.json"))
        XCTAssertEqual(sections[0].blocklists[0].signatureURL, URL(string: "https://example.com/catalog/signatures/ph.asc"))
    }

    func testCatalogEntriesPreserveAbsoluteDocumentAndSignatureURLs() throws {
        let repository = makeRepository(
            gpgKeyURL: "keys/community.asc",
            countries: [
                BlocklistRepositoryCountry(
                    code: "US",
                    name: "United States",
                    signatureURL: "country/default.asc",
                    blocklists: [
                        BlocklistRepositoryEntry(
                            id: "US/core",
                            title: "US Core",
                            description: "Core numbers",
                            path: "https://cdn.example.com/blocklists/us-core.json",
                            source: "Community",
                            signatureURL: "https://cdn.example.com/signatures/us-core.json.asc"
                        )
                    ]
                )
            ]
        )

        let entry = try XCTUnwrap(repository.catalogEntries(relativeTo: repositoryURL).first)

        XCTAssertEqual(entry.documentURL, URL(string: "https://cdn.example.com/blocklists/us-core.json"))
        XCTAssertEqual(entry.signatureURL, URL(string: "https://cdn.example.com/signatures/us-core.json.asc"))
    }

    func testBlocklistSignatureResolutionNeverFallsBackToRepositoryKeyURL() throws {
        let repository = makeRepository(
            gpgKeyURL: "keys/community.asc",
            countries: [
                BlocklistRepositoryCountry(
                    code: "UK",
                    name: "United Kingdom",
                    signatureURL: nil,
                    blocklists: [
                        BlocklistRepositoryEntry(
                            id: "UK/core",
                            title: "UK Core",
                            description: "Core numbers",
                            path: "UK/core.json",
                            source: "Community",
                            signatureURL: nil
                        )
                    ]
                )
            ]
        )

        let entry = try XCTUnwrap(repository.catalogEntries(relativeTo: repositoryURL).first)

        XCTAssertEqual(entry.documentURL, URL(string: "https://example.com/catalog/UK/core.json"))
        XCTAssertNil(entry.signatureURL)
    }

    func testResolvedRepositoryPublicKeyURLSupportsRelativeAndAbsoluteValues() {
        let relativeRepository = makeRepository(gpgKeyURL: "keys/community.asc")
        XCTAssertEqual(
            relativeRepository.resolvedRepositoryPublicKeyURL(relativeTo: repositoryURL),
            URL(string: "https://example.com/catalog/keys/community.asc")
        )

        let absoluteRepository = makeRepository(gpgKeyURL: "https://keys.example.com/community.asc")
        XCTAssertEqual(
            absoluteRepository.resolvedRepositoryPublicKeyURL(relativeTo: repositoryURL),
            URL(string: "https://keys.example.com/community.asc")
        )
    }

    func testFlattenedCatalogMatchesResolvedSections() {
        let repository = makeRepository(
            gpgKeyURL: "keys/community.asc",
            countries: [
                BlocklistRepositoryCountry(
                    code: "PH",
                    name: "Philippines",
                    signatureURL: "PH/default.asc",
                    blocklists: [
                        BlocklistRepositoryEntry(
                            id: "PH/core",
                            title: "PH Core",
                            description: "Core numbers",
                            path: "PH/core.json",
                            source: "Community",
                            signatureURL: nil
                        )
                    ]
                ),
                BlocklistRepositoryCountry(
                    code: "US",
                    name: "United States",
                    signatureURL: nil,
                    blocklists: [
                        BlocklistRepositoryEntry(
                            id: "US/core",
                            title: "US Core",
                            description: "Core numbers",
                            path: "US/core.json",
                            source: "Community",
                            signatureURL: "US/core.json.asc"
                        )
                    ]
                )
            ]
        )

        let flattenedFromSections = repository.resolvedCountries(relativeTo: repositoryURL).flatMap(\.blocklists)
        let flattenedCatalog = repository.catalogEntries(relativeTo: repositoryURL)

        XCTAssertEqual(flattenedCatalog, flattenedFromSections)
    }
}

private extension BlocklistRepositoryResolutionTests {
    var repositoryURL: URL {
        URL(string: "https://example.com/catalog/repo.json")!
    }

    func makeRepository(
        gpgKeyURL: String?,
        countries: [BlocklistRepositoryCountry] = []
    ) -> BlocklistRepositoryDocument {
        BlocklistRepositoryDocument(
            name: "Example Repo",
            gpgKeyURL: gpgKeyURL,
            defaultBlocklistID: countries.first?.blocklists.first?.id,
            countries: countries
        )
    }
}
