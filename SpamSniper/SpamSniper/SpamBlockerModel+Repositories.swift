//
//  SpamBlockerModel+Repositories.swift
//  SpamSniper
//

import Foundation

extension SpamBlockerModel {
    func testRepositoryInput() async {
        let trimmed = sanitiseURL(repositoryInput)
        repositoryInput = trimmed
        repositoryTestPassed = false
        pendingValidatedRepositoryURL = nil
        pendingRepoMetaName = ""

        guard !trimmed.isEmpty else {
            repositoryTestMessage = "Enter a GitHub repository URL or a direct repo.json URL first."
            return
        }

        isTestingRepository = true
        defer { isTestingRepository = false }

        do {
            let result = try await BlocklistSyncService.validateRepository(at: trimmed)
            repositoryInput = result.normalizedRepositoryURL.absoluteString
            repositoryTestPassed = true
            pendingValidatedRepositoryURL = result.normalizedRepositoryURL
            pendingRepoMetaName = result.repositoryName
            repositoryTestMessage = [
                "Valid repo: \(result.repositoryName) with \(result.blocklistCount)",
                "fetchable signed blocklist\(result.blocklistCount == 1 ? "" : "s")."
            ].joined(separator: " ")
        } catch {
            repositoryTestMessage = error.localizedDescription
        }
    }

    func saveValidatedRepositoryToList() async {
        guard let url = pendingValidatedRepositoryURL else {
            repositoryTestMessage = "Test the repository before saving it."
            return
        }

        var repo = StoredRepository(
            validatedURL: url,
            repoName: pendingRepoMetaName.isEmpty ? url.absoluteString : pendingRepoMetaName
        )
        let trimmedCustomName = repositoryNameInput.trimmingCharacters(in: .whitespacesAndNewlines)
        if !trimmedCustomName.isEmpty {
            repo = repo.updating(customName: trimmedCustomName)
        }

        BlocklistSyncService.addRepository(repo)
        repositoryInput = ""
        repositoryNameInput = ""
        pendingRepoMetaName = ""
        repositoryTestPassed = false
        pendingValidatedRepositoryURL = nil
        repositoryTestMessage = "Repository \"\(repo.displayName)\" added."
        await refresh()
    }

    func removeRepository(_ repo: StoredRepository) async {
        guard !repo.isBuiltIn else { return }
        BlocklistSyncService.removeRepository(id: repo.id)
        await refresh()
    }

    func setActiveRepository(_ repo: StoredRepository) async {
        BlocklistSyncService.setActiveRepository(repo)
        activeRepositoryID = repo.id
        await refresh()
    }

    func beginEditing(_ repo: StoredRepository) {
        editingRepository = repo
        editNameInput = repo.customName.isEmpty ? repo.name : repo.customName
        editURLInput = repo.urlString
        editTestMessage = nil
        editTestPassed = false
    }

    func testEditRepositoryInput() async {
        let trimmed = sanitiseURL(editURLInput)
        editURLInput = trimmed
        editTestPassed = false

        guard !trimmed.isEmpty else {
            editTestMessage = "Enter a valid repo URL first."
            return
        }

        isTestingEditRepository = true
        defer { isTestingEditRepository = false }

        do {
            let result = try await BlocklistSyncService.validateRepository(at: trimmed)
            editURLInput = result.normalizedRepositoryURL.absoluteString
            editTestPassed = true
            editTestMessage = """
            Valid: \(result.repositoryName) · \(result.blocklistCount) \
            blocklist\(result.blocklistCount == 1 ? "" : "s")
            """
        } catch {
            editTestMessage = error.localizedDescription
        }
    }

    func saveEditedRepository() async {
        guard let original = editingRepository else { return }
        let trimmedURL = sanitiseURL(editURLInput)
        let trimmedName = editNameInput.trimmingCharacters(in: .whitespacesAndNewlines)

        guard !trimmedURL.isEmpty else {
            editTestMessage = "URL cannot be empty."
            return
        }

        let updated = original.updating(urlString: trimmedURL, customName: trimmedName)
        BlocklistSyncService.updateRepository(updated)
        editingRepository = nil
        await refresh()
    }

    func cancelEditing() {
        editingRepository = nil
        editTestMessage = nil
        editTestPassed = false
    }
}

extension SpamBlockerModel {
    func sanitiseURL(_ raw: String) -> String {
        raw
            .trimmingCharacters(in: .whitespacesAndNewlines)
            .filter { !$0.isNewline }
    }

    func flattenedRepositoryEntries() -> [BlocklistCatalogEntry] {
        availableBlocklists.flatMap { country in
            country.blocklists.map { repositoryEntry in
                BlocklistCatalogEntry(
                    id: repositoryEntry.id,
                    countryCode: country.code,
                    countryName: country.name,
                    title: repositoryEntry.title,
                    description: repositoryEntry.description,
                    source: repositoryEntry.source,
                    documentURL: BlocklistSyncService.repositoryURL?
                        .deletingLastPathComponent()
                        .appending(path: repositoryEntry.path),
                    signatureURL: resolvedSignatureURL(
                        entrySignatureURL: repositoryEntry.signatureURL,
                        countrySignatureURL: country.signatureURL
                    )
                )
            }
        }
    }

    func resolvedSignatureURL(entrySignatureURL: String?, countrySignatureURL: String?) -> URL? {
        let value = entrySignatureURL ?? countrySignatureURL
        guard let value else {
            return nil
        }

        if let absoluteURL = URL(string: value), absoluteURL.scheme != nil {
            return absoluteURL
        }

        return BlocklistSyncService.repositoryURL?
            .deletingLastPathComponent()
            .appending(path: value)
    }

    func syncSelections(_ selections: [BlocklistCatalogEntry]) async throws {
        let selectedEntries = selections.map(StoredBlocklistSelection.init(entry:))
        let contactNumbers = await contactNumbersForSync()

        try await BlocklistSyncService.refreshNow(
            using: selectedEntries,
            excluding: contactNumbers
        )
        let snapshot = try BlocklistSyncService.fetchSnapshot()
        applySnapshot(snapshot)
        try? await reloadExtension()
        extensionStatus = try await fetchExtensionStatus()
    }

    func contactNumbersForSync() async -> Set<Int64> {
        let shouldExcludeContacts = contactsPermissionState == .authorized || contactsPermissionState == .limited
        guard shouldExcludeContacts else {
            return []
        }

        return await ContactFilteringService.loadSnapshot().phoneNumbers
    }
}
