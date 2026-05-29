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
        resetPendingRepositoryValidation()

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
            applyPendingRepositoryValidation(result)
            repositoryTestMessage = [
                "Valid repo: \(result.repositoryName) with \(result.blocklistCount)",
                "fetchable signed blocklist\(result.blocklistCount == 1 ? "" : "s")."
            ].joined(separator: " ")
        } catch {
            resetPendingRepositoryValidation()
            repositoryTestMessage = error.localizedDescription
        }
    }

    @discardableResult
    func saveValidatedRepositoryToList() async -> Bool {
        guard let url = pendingValidatedRepositoryURL else {
            repositoryTestMessage = "Test the repository before saving it."
            return false
        }

        guard !pendingKeyFingerprint.isEmpty && pendingKeyAlreadyTrusted else {
            repositoryTestMessage = "Trust the repository signing key before adding the repository."
            return false
        }

        var repo = StoredRepository(
            validatedURL: url,
            repoName: pendingRepoMetaName.isEmpty ? url.absoluteString : pendingRepoMetaName,
            trustedKeyFingerprint: pendingKeyFingerprint
        )
        let trimmedCustomName = repositoryNameInput.trimmingCharacters(in: .whitespacesAndNewlines)
        if !trimmedCustomName.isEmpty {
            repo = repo.updating(customName: trimmedCustomName)
        }

        BlocklistSyncService.addRepository(repo)
        repositoryInput = ""
        repositoryNameInput = ""
        repositoryTestPassed = false
        resetPendingRepositoryValidation()
        repositoryTestMessage = "Repository \"\(repo.displayName)\" added."
        await refresh()
        return true
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
        resetEditRepositoryValidation()
    }

    func testEditRepositoryInput() async {
        let trimmed = sanitiseURL(editURLInput)
        editURLInput = trimmed
        editTestPassed = false
        resetEditRepositoryValidation()

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
            applyEditRepositoryValidation(result)
            editTestMessage = """
            Valid: \(result.repositoryName) · \(result.blocklistCount) \
            blocklist\(result.blocklistCount == 1 ? "" : "s")
            """
        } catch {
            resetEditRepositoryValidation()
            editTestMessage = error.localizedDescription
        }
    }

    @discardableResult
    func saveEditedRepository() async -> Bool {
        guard let original = editingRepository else { return false }
        guard let updated = validatedEditedRepository(from: original) else {
            return false
        }

        BlocklistSyncService.updateRepository(updated)
        editingRepository = nil
        resetEditRepositoryValidation()
        await refresh()
        return true
    }

    func cancelEditing() {
        editingRepository = nil
        editTestMessage = nil
        editTestPassed = false
        resetEditRepositoryValidation()
    }
}

// MARK: - Trusted Keys

extension SpamBlockerModel {
    func trustPendingKey(name: String? = nil) {
        trustKey(
            fingerprint: pendingKeyFingerprint,
            armoredData: pendingKeyArmoredData,
            name: name
        ) {
            pendingKeyAlreadyTrusted = true
        }
    }

    func trustEditPendingKey(name: String? = nil) {
        trustKey(
            fingerprint: editPendingKeyFingerprint,
            armoredData: editPendingKeyArmoredData,
            name: name
        ) {
            editPendingKeyAlreadyTrusted = true
        }
    }

    func addTrustedKey(armoredData: String, name: String) throws {
        let data = armoredData.data(using: .utf8) ?? Data()
        let fingerprint = try BlocklistSignatureVerifier.fingerprint(of: data)
        let key = TrustedKey(
            id: fingerprint,
            name: name.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
            ? "Imported Key (\(String(fingerprint.suffix(8))))"
            : name,
            armoredData: armoredData,
            addedAt: Date(),
            isBuiltIn: false
        )
        SpamBlockerShared.addTrustedKey(key)
        trustedKeys = SpamBlockerShared.trustedKeys
    }

    func removeTrustedKey(_ key: TrustedKey) {
        guard !key.isBuiltIn else { return }
        SpamBlockerShared.removeTrustedKey(id: key.id)
        trustedKeys = SpamBlockerShared.trustedKeys
        repositories = [.builtIn] + BlocklistSyncService.repositories
    }
}

extension SpamBlockerModel {
    private func trustKey(
        fingerprint: String,
        armoredData: String,
        name: String?,
        onTrust: () -> Void
    ) {
        guard !fingerprint.isEmpty else { return }
        let keyName = (name?.trimmingCharacters(in: .whitespacesAndNewlines)).flatMap { $0.isEmpty ? nil : $0 }
        ?? "Imported Key (\(String(fingerprint.suffix(8))))"
        let key = TrustedKey(
            id: fingerprint,
            name: keyName,
            armoredData: armoredData,
            addedAt: Date(),
            isBuiltIn: false
        )
        SpamBlockerShared.addTrustedKey(key)
        trustedKeys = SpamBlockerShared.trustedKeys
        onTrust()
    }

    func resetPendingRepositoryValidation() {
        pendingValidatedRepositoryURL = nil
        pendingRepoMetaName = ""
        pendingKeyFingerprint = ""
        pendingKeyArmoredData = ""
        pendingKeyAlreadyTrusted = false
    }

    func applyPendingRepositoryValidation(_ result: RepositoryValidationResult) {
        pendingValidatedRepositoryURL = result.normalizedRepositoryURL
        pendingRepoMetaName = result.repositoryName
        pendingKeyFingerprint = result.signingKeyFingerprint
        pendingKeyArmoredData = result.signingKeyArmoredData
        pendingKeyAlreadyTrusted = result.isKeyAlreadyTrusted
    }

    func resetEditRepositoryValidation() {
        editValidatedRepositoryURL = nil
        editValidatedRepoMetaName = ""
        editPendingKeyFingerprint = ""
        editPendingKeyArmoredData = ""
        editPendingKeyAlreadyTrusted = false
    }

    func applyEditRepositoryValidation(_ result: RepositoryValidationResult) {
        editValidatedRepositoryURL = result.normalizedRepositoryURL
        editValidatedRepoMetaName = result.repositoryName
        editPendingKeyFingerprint = result.signingKeyFingerprint
        editPendingKeyArmoredData = result.signingKeyArmoredData
        editPendingKeyAlreadyTrusted = result.isKeyAlreadyTrusted
    }

    func validatedEditedRepository(from original: StoredRepository) -> StoredRepository? {
        let trimmedName = editNameInput.trimmingCharacters(in: .whitespacesAndNewlines)
        guard let validatedURL = editValidatedRepositoryURL else {
            editTestMessage = "Test the URL before saving."
            return nil
        }

        guard !editPendingKeyFingerprint.isEmpty && editPendingKeyAlreadyTrusted else {
            editTestMessage = "Trust the repository signing key before saving the edit."
            return nil
        }

        return original.updating(
            urlString: validatedURL.absoluteString,
            name: editValidatedRepoMetaName.isEmpty ? validatedURL.absoluteString : editValidatedRepoMetaName,
            customName: trimmedName,
            trustedKeyFingerprint: .some(editPendingKeyFingerprint)
        )
    }

    func sanitiseURL(_ raw: String) -> String {
        raw
            .trimmingCharacters(in: .whitespacesAndNewlines)
            .filter { !$0.isNewline }
    }

    func flattenedRepositoryEntries() -> [BlocklistCatalogEntry] {
        availableBlocklists.flatMap(\.blocklists)
    }

    func storedSelections(for entries: [BlocklistCatalogEntry]) -> [StoredBlocklistSelection] {
        entries.map(StoredBlocklistSelection.init(entry:))
    }

    func selectionsAfterToggling(
        _ entry: BlocklistCatalogEntry,
        in repositoryEntries: [BlocklistCatalogEntry]? = nil
    ) -> [BlocklistCatalogEntry] {
        let repositoryEntries = repositoryEntries ?? flattenedRepositoryEntries()
        var nextSelections = repositoryEntries.filter { selectedBlocklistIDs.contains($0.id) }

        if selectedBlocklistIDs.contains(entry.id) {
            if nextSelections.count > 1 {
                nextSelections.removeAll { $0.id == entry.id }
            }
        } else {
            nextSelections.append(entry)
        }

        nextSelections.sort { $0.title.localizedCaseInsensitiveCompare($1.title) == .orderedAscending }
        return nextSelections
    }

    func syncSelections(_ selections: [BlocklistCatalogEntry]) async throws {
        let selectedEntries = storedSelections(for: selections)
        let contactNumbers = await contactNumbersForSync()

        try await BlocklistSyncService.refreshNow(
            using: selectedEntries,
            excluding: contactNumbers
        )
        let snapshot = try BlocklistSyncService.fetchEffectiveSnapshot()
        let summary = try BlocklistDatabase.fetchSummary()
        applyEffectiveSnapshot(snapshot)
        var diagnostics = SpamBlockerShared.syncDiagnostics
        diagnostics.lastSuccessfulSyncAt = summary.syncedAt
        diagnostics.repositoryDisplayName = BlocklistSyncService.activeRepository.displayName
        diagnostics.repositorySourceLabel = summary.source ?? snapshot.repositorySource
        diagnostics.importedRepoEntryCount = summary.importedRepoEntryCount
        diagnostics.excludedContactCount = summary.excludedContactCount
        diagnostics.repositoryKeyFingerprint = currentRepositoryKeyFingerprint()
        diagnostics.lastAttemptAt = Date()
        diagnostics.lastAttemptSucceeded = true
        diagnostics.lastAttemptMessage = "Blocklist selections updated successfully."
        SpamBlockerShared.syncDiagnostics = diagnostics
        syncDiagnostics = diagnostics
        try await reloadExtensionAndRecordResult()
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
