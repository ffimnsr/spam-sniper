import XCTest
@testable import SpamSniper

@MainActor
final class PhaseOneRegressionTests: XCTestCase {
    func testBuiltInRepositoryCatalogMatchesSharedResolverAcrossCallers() throws {
        try assertCatalogConsistency(usingActiveRepositoryURL: nil)
    }
    
    func testDirectRepositoryCatalogMatchesSharedResolverAcrossCallers() throws {
        try assertCatalogConsistency(usingActiveRepositoryURL: URL(string: "https://example.com/direct/repo.json"))
    }
    
    func testGitHubDerivedRepositoryCatalogMatchesSharedResolverAcrossCallers() throws {
        try assertCatalogConsistency(
            usingActiveRepositoryURL: BlocklistSyncService.githubRepositoryURLCandidates(owner: "example", repo: "spam-sniper").first
        )
    }
    
    func testBuiltInSelectionTogglingPreservesResolvedURLsForSignatureChecks() throws {
        try assertSelectionConsistency(usingActiveRepositoryURL: nil)
    }
    
    func testCustomRepositorySelectionTogglingPreservesResolvedURLsForSignatureChecks() throws {
        try assertSelectionConsistency(usingActiveRepositoryURL: URL(string: "https://example.com/custom/repo.json"))
    }
}

private extension PhaseOneRegressionTests {
    func assertCatalogConsistency(usingActiveRepositoryURL activeRepositoryURL: URL?) throws {
        try withSharedState(activeRepositoryURL: activeRepositoryURL, selectedBlocklists: []) {
            let repository = makeSelectionRepository()
            let expectedEntries = repository.catalogEntries(relativeTo: BlocklistSyncService.repositoryURL)
            let model = SpamBlockerModel()
            
            let resolvedSelections = model.applyRepository(repository)
            let availableEntries = model.availableBlocklists.flatMap(\.blocklists)
            let flattenedEntries = model.flattenedRepositoryEntries()
            
            XCTAssertEqual(availableEntries, expectedEntries)
            XCTAssertEqual(flattenedEntries, expectedEntries)
            XCTAssertEqual(resolvedSelections, [StoredBlocklistSelection(entry: try XCTUnwrap(expectedEntries.first))])
        }
    }
    
    func assertSelectionConsistency(usingActiveRepositoryURL activeRepositoryURL: URL?) throws {
        try withSharedState(activeRepositoryURL: activeRepositoryURL, selectedBlocklists: []) {
            let repository = makeSelectionRepository()
            let model = SpamBlockerModel()
            _ = model.applyRepository(repository)
            
            let entries = model.flattenedRepositoryEntries()
            let defaultEntry = try XCTUnwrap(entries.first(where: { $0.id == repository.defaultBlocklistID }))
            let additionalEntry = try XCTUnwrap(entries.first(where: { $0.id != defaultEntry.id }))
            
            let expandedSelections = model.selectionsAfterToggling(additionalEntry, in: entries)
            let storedExpandedSelections = model.storedSelections(for: expandedSelections)
            
            XCTAssertEqual(expandedSelections.map(\.id), [defaultEntry.id, additionalEntry.id].sorted())
            XCTAssertEqual(storedExpandedSelections.map(\.resolvedDocumentURL), expandedSelections.map(\.documentURL))
            XCTAssertEqual(storedExpandedSelections.map(\.resolvedSignatureURL), expandedSelections.map(\.signatureURL))
            
            model.applySelections(storedExpandedSelections)
            
            let reducedSelections = model.selectionsAfterToggling(defaultEntry, in: entries)
            let storedReducedSelections = model.storedSelections(for: reducedSelections)
            
            XCTAssertEqual(reducedSelections.map(\.id), [additionalEntry.id])
            XCTAssertEqual(storedReducedSelections.map(\.resolvedDocumentURL), [additionalEntry.documentURL])
            XCTAssertEqual(storedReducedSelections.map(\.resolvedSignatureURL), [additionalEntry.signatureURL])
        }
    }
    
    func withSharedState(
        activeRepositoryURL: URL?,
        selectedBlocklists: [StoredBlocklistSelection],
        perform body: () throws -> Void
    ) throws {
        let originalRepositories = SpamBlockerShared.repositories
        let originalActiveRepositoryID = SpamBlockerShared.activeRepositoryID
        let originalSelectedBlocklists = SpamBlockerShared.selectedBlocklists
        
        let customRepository = activeRepositoryURL.map {
            StoredRepository(validatedURL: $0, repoName: "Regression Repo", id: "regression-active-repo")
        }
        
        SpamBlockerShared.repositories = customRepository.map { [$0] } ?? []
        SpamBlockerShared.activeRepositoryID = customRepository?.id
        SpamBlockerShared.selectedBlocklists = selectedBlocklists
        
        defer {
            SpamBlockerShared.repositories = originalRepositories
            SpamBlockerShared.activeRepositoryID = originalActiveRepositoryID
            SpamBlockerShared.selectedBlocklists = originalSelectedBlocklists
        }
        
        try body()
    }
    
    func makeSelectionRepository() -> BlocklistRepositoryDocument {
        BlocklistRepositoryDocument(
            name: "Regression Repo",
            gpgKeyURL: "keys/community.asc",
            defaultBlocklistID: "PH/core",
            countries: [
                BlocklistRepositoryCountry(
                    code: "PH",
                    name: "Philippines",
                    signatureURL: "PH/default.asc",
                    blocklists: [
                        BlocklistRepositoryEntry(
                            id: "PH/core",
                            title: "Alpha Core",
                            description: "Default selection",
                            path: "PH/core.json",
                            source: "Community",
                            signatureURL: nil
                        ),
                        BlocklistRepositoryEntry(
                            id: "PH/secondary",
                            title: "Zulu Secondary",
                            description: "Optional selection",
                            path: "PH/secondary.json",
                            source: "Community",
                            signatureURL: "PH/secondary.json.asc"
                        )
                    ]
                )
            ]
        )
    }
}
