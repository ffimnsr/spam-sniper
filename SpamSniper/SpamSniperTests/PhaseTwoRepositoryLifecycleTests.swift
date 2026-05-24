import XCTest
@testable import SpamSniper

@MainActor
final class PhaseTwoRepositoryLifecycleTests: XCTestCase {
    func testAddActivateEditAndRemoveRepositoryFlowKeepsStableIdentity() throws {
        let repository = StoredRepository(
            validatedURL: URL(string: "https://example.com/custom/repo.json")!,
            repoName: "Custom Repo",
            trustedKeyFingerprint: "KEY-ONE",
            id: "custom-repo-id"
        )
        let updatedRepository = repository.updating(
            urlString: "https://example.com/custom-updated/repo.json",
            name: "Updated Repo",
            trustedKeyFingerprint: .some("KEY-TWO")
        )

        try withSharedRepositoryState(repositories: [], activeRepositoryID: nil) {
            SpamBlockerShared.addRepository(repository)
            XCTAssertEqual(SpamBlockerShared.repositories, [repository])

            SpamBlockerShared.setActiveRepository(repository)
            XCTAssertEqual(SpamBlockerShared.activeRepositoryID, repository.id)
            XCTAssertEqual(BlocklistSyncService.activeRepository, repository)

            SpamBlockerShared.updateRepository(updatedRepository)
            XCTAssertEqual(BlocklistSyncService.activeRepository.id, repository.id)
            XCTAssertEqual(BlocklistSyncService.activeRepository.urlString, updatedRepository.urlString)
            XCTAssertEqual(BlocklistSyncService.activeRepository.trustedKeyFingerprint, "KEY-TWO")

            SpamBlockerShared.removeRepository(id: repository.id)
            XCTAssertNil(SpamBlockerShared.activeRepositoryID)
            XCTAssertEqual(BlocklistSyncService.activeRepository, .builtIn)
            XCTAssertTrue(SpamBlockerShared.repositories.isEmpty)
        }
    }

    func testStoredRepositoryDecodingMigratesLegacyURLDerivedIdentityToStableUUID() throws {
        let legacyURL = "https://example.com/legacy/repo.json"
        let data = try JSONSerialization.data(withJSONObject: [
            "id": legacyURL,
            "urlString": legacyURL,
            "name": "Legacy Repo",
            "customName": "",
            "isBuiltIn": false,
            "trustedKeyFingerprint": "LEGACYKEY"
        ])

        let repository = try JSONDecoder().decode(StoredRepository.self, from: data)

        XCTAssertNotEqual(repository.id, legacyURL)
        XCTAssertNotNil(UUID(uuidString: repository.id))
        XCTAssertEqual(repository.urlString, legacyURL)
        XCTAssertEqual(repository.trustedKeyFingerprint, "LEGACYKEY")
    }

    func testUpdatingActiveRepositoryKeepsActiveSelectionByIDWhenURLChanges() throws {
        let original = StoredRepository(
            validatedURL: URL(string: "https://example.com/original/repo.json")!,
            repoName: "Original Repo",
            trustedKeyFingerprint: "OLDKEY",
            id: "custom-repo-id"
        )
        let updated = original.updating(
            urlString: "https://example.com/updated/repo.json",
            name: "Updated Repo",
            trustedKeyFingerprint: .some("NEWKEY")
        )

        try withSharedRepositoryState(repositories: [original], activeRepositoryID: original.id) {
            SpamBlockerShared.updateRepository(updated)

            XCTAssertEqual(SpamBlockerShared.activeRepositoryID, original.id)
            XCTAssertEqual(BlocklistSyncService.activeRepository.id, original.id)
            XCTAssertEqual(BlocklistSyncService.activeRepository.urlString, "https://example.com/updated/repo.json")
            XCTAssertEqual(BlocklistSyncService.activeRepository.trustedKeyFingerprint, "NEWKEY")
            XCTAssertEqual(
                BlocklistSyncService.repositoryURL,
                URL(string: "https://example.com/updated/repo.json")
            )
        }
    }

    func testRemovingActiveRepositoryFallsBackToBuiltInRepository() throws {
        let repository = StoredRepository(
            validatedURL: URL(string: "https://example.com/custom/repo.json")!,
            repoName: "Custom Repo",
            id: "custom-repo-id"
        )

        try withSharedRepositoryState(repositories: [repository], activeRepositoryID: repository.id) {
            SpamBlockerShared.removeRepository(id: repository.id)

            XCTAssertNil(SpamBlockerShared.activeRepositoryID)
            XCTAssertEqual(BlocklistSyncService.activeRepository, .builtIn)
            XCTAssertEqual(BlocklistSyncService.repositoryURL, BlocklistSyncService.defaultRepositoryURL)
            XCTAssertTrue(SpamBlockerShared.repositories.isEmpty)
        }
    }

    func testValidatedEditedRepositoryUsesNormalizedURLMetadataAndSigningKey() {
        let original = StoredRepository(
            validatedURL: URL(string: "https://example.com/original/repo.json")!,
            repoName: "Original Repo",
            trustedKeyFingerprint: "OLDKEY",
            id: "custom-repo-id"
        )
        let model = SpamBlockerModel()
        model.beginEditing(original)
        model.editNameInput = ""
        model.editValidatedRepositoryURL = URL(string: "https://example.com/validated/repo.json")!
        model.editValidatedRepoMetaName = "Validated Repo"
        model.editPendingKeyFingerprint = "NEWKEY"
        model.editPendingKeyArmoredData = "-----BEGIN PGP PUBLIC KEY BLOCK-----\nKEY\n-----END PGP PUBLIC KEY BLOCK-----"
        model.editPendingKeyAlreadyTrusted = true

        let updated = model.validatedEditedRepository(from: original)

        XCTAssertEqual(updated?.id, original.id)
        XCTAssertEqual(updated?.urlString, "https://example.com/validated/repo.json")
        XCTAssertEqual(updated?.name, "Validated Repo")
        XCTAssertEqual(updated?.customName, "")
        XCTAssertEqual(updated?.trustedKeyFingerprint, "NEWKEY")
    }

    func testBuiltInRepositoryUsesSeedFallbackForReachabilityFailure() async throws {
        let seed = BlocklistRepositoryDocument(
            name: "Bundled Seed",
            gpgKeyURL: nil,
            defaultBlocklistID: nil,
            countries: []
        )

        let repository = try await BlocklistSyncService.fetchRepository(
            for: .builtIn,
            fetchVerifiedRepository: { _ in throw URLError(.notConnectedToInternet) },
            loadSeedRepository: { seed }
        )

        XCTAssertEqual(repository.name, seed.name)
    }

    func testBuiltInRepositoryFetchResultReportsBundledFallbackSource() async throws {
        let seed = BlocklistRepositoryDocument(
            name: "Bundled Seed",
            gpgKeyURL: nil,
            defaultBlocklistID: nil,
            countries: []
        )

        let result = try await BlocklistSyncService.fetchRepositoryResult(
            for: .builtIn,
            fetchVerifiedRepository: { _ in throw URLError(.notConnectedToInternet) },
            loadSeedRepository: { seed }
        )

        XCTAssertEqual(result.document.name, seed.name)
        XCTAssertTrue(result.usedBundledSeedFallback)
    }

    func testCustomRepositoryDoesNotUseSeedFallbackForReachabilityFailure() async {
        let customRepository = StoredRepository(
            validatedURL: URL(string: "https://example.com/custom/repo.json")!,
            repoName: "Custom Repo",
            id: "custom-repo-id"
        )

        do {
            _ = try await BlocklistSyncService.fetchRepository(
                for: customRepository,
                fetchVerifiedRepository: { _ in throw URLError(.notConnectedToInternet) },
                loadSeedRepository: {
                    XCTFail("Custom repository fetch should not fall back to the bundled seed.")
                    return BlocklistRepositoryDocument(
                        name: "Bundled Seed",
                        gpgKeyURL: nil,
                        defaultBlocklistID: nil,
                        countries: []
                    )
                }
            )
            XCTFail("Expected the custom repository outage to surface as an error.")
        } catch let error as BlocklistSyncServiceError {
            switch error {
            case let .repositoryUnavailable(repositoryName):
                XCTAssertEqual(repositoryName, customRepository.displayName)
            default:
                XCTFail("Unexpected error: \(error)")
            }
        } catch {
            XCTFail("Unexpected error: \(error)")
        }
    }

    func testManualSyncStatusReportsSuccessForVerifiedRemoteRefresh() {
        let model = SpamBlockerModel()
        let status = model.manualSyncStatus(for: makeRefreshCoordinatorResult(source: .verifiedRemote), at: fixedDate)

        XCTAssertEqual(status.style, .success)
        XCTAssertEqual(status.title, "Sync complete")
        XCTAssertEqual(status.recordedAt, fixedDate)
    }

    func testManualSyncStatusReportsBundledFallbackWarning() {
        let model = SpamBlockerModel()
        let status = model.manualSyncStatus(for: makeRefreshCoordinatorResult(source: .bundledSeedFallback), at: fixedDate)

        XCTAssertEqual(status.style, .warning)
        XCTAssertEqual(status.title, "Bundled fallback used")
    }

    func testManualSyncStatusReportsCustomRepositoryUnavailable() {
        let model = SpamBlockerModel()
        let status = model.manualSyncStatus(
            for: BlocklistSyncServiceError.repositoryUnavailable("Custom Repo"),
            fallbackMessage: "fallback",
            at: fixedDate
        )

        XCTAssertEqual(status.style, .warning)
        XCTAssertEqual(status.title, "Repository unavailable")
        XCTAssertTrue(status.message.contains("Custom Repo"))
    }

    func testManualSyncStatusReportsSignatureVerificationFailure() {
        let model = SpamBlockerModel()
        let status = model.manualSyncStatus(
            for: BlocklistSyncServiceError.blocklistSignatureInvalid("Core List"),
            fallbackMessage: "fallback",
            at: fixedDate
        )

        XCTAssertEqual(status.style, .failure)
        XCTAssertEqual(status.title, "Signature verification failed")
    }

    func testRemoveTrustedKeyClearsRepositoryAssociationAndStatusUpdatesImmediately() throws {
        let key = TrustedKey(
            id: "AABBCCDDEEFF0011",
            name: "Custom Signing Key",
            armoredData: "-----BEGIN PGP PUBLIC KEY BLOCK-----\nKEY\n-----END PGP PUBLIC KEY BLOCK-----",
            addedAt: fixedDate,
            isBuiltIn: false
        )
        let repository = StoredRepository(
            validatedURL: URL(string: "https://example.com/custom/repo.json")!,
            repoName: "Custom Repo",
            trustedKeyFingerprint: key.id,
            id: "custom-repo-id"
        )
        let model = SpamBlockerModel()

        try withSharedRepositoryState(repositories: [repository], activeRepositoryID: nil, trustedKeys: [key]) {
            model.refreshStoredState()

            let initialStatus = model.repositoryKeyStatus(for: try XCTUnwrap(model.repositories.first(where: { $0.id == repository.id })))
            XCTAssertEqual(initialStatus.state, .trusted)
            XCTAssertEqual(model.repositoriesUsingTrustedKey(key).map(\.displayName), [repository.displayName])

            model.removeTrustedKey(key)

            let updatedRepository = try XCTUnwrap(model.repositories.first(where: { $0.id == repository.id }))
            XCTAssertNil(updatedRepository.trustedKeyFingerprint)
            XCTAssertEqual(model.repositoryKeyStatus(for: updatedRepository).state, .missing)
            XCTAssertTrue(model.repositoriesUsingTrustedKey(key).isEmpty)
        }
    }
}

private extension PhaseTwoRepositoryLifecycleTests {
    var fixedDate: Date {
        Date(timeIntervalSince1970: 1_716_508_800)
    }

    func makeRefreshCoordinatorResult(source: RepositoryFetchResult.Source) -> RefreshCoordinatorResult {
        RefreshCoordinatorResult(
            repositoryFetch: RepositoryFetchResult(
                document: BlocklistRepositoryDocument(
                    name: "Example Repo",
                    gpgKeyURL: nil,
                    defaultBlocklistID: nil,
                    countries: []
                ),
                source: source
            ),
            resolvedSelections: [],
            signatureStatus: "Good",
            databaseSummary: BlocklistDatabaseSummary(
                totalEntries: 0,
                blocklistIDs: [],
                source: "Example Repo",
                syncedAt: fixedDate
            ),
            effectiveSnapshot: EffectiveBlocklistSnapshot(
                entries: [],
                blocklistIDs: [],
                repositorySource: "Example Repo",
                syncedAt: fixedDate
            ),
            extensionStatus: .enabled
        )
    }

    func withSharedRepositoryState(
        repositories: [StoredRepository],
        activeRepositoryID: String?,
        trustedKeys: [TrustedKey]? = nil,
        perform body: () throws -> Void
    ) throws {
        let originalRepositories = SpamBlockerShared.repositories
        let originalActiveRepositoryID = SpamBlockerShared.activeRepositoryID
        let originalTrustedKeys = SpamBlockerShared.trustedKeys

        SpamBlockerShared.repositories = repositories
        SpamBlockerShared.activeRepositoryID = activeRepositoryID
        if let trustedKeys {
            SpamBlockerShared.trustedKeys = trustedKeys
        }

        defer {
            SpamBlockerShared.repositories = originalRepositories
            SpamBlockerShared.activeRepositoryID = originalActiveRepositoryID
            SpamBlockerShared.trustedKeys = originalTrustedKeys
        }

        try body()
    }
}
