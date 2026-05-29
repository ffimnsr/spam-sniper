import SwiftUI

// MARK: - SettingsView

@MainActor
struct SettingsView: View {
    @Bindable var model: SpamBlockerModel
    @State private var isAddRepositoryPresented = false
    @Environment(\.colorScheme) private var colorScheme
    
    var body: some View {
        Form {
            protectionModeSection
            repositoriesSection
            trustedKeysSection
            diagnosticsSection
        }
        .navigationTitle("Settings")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .primaryAction) {
                Button {
                    isAddRepositoryPresented = true
                } label: {
                    Image(systemName: "plus")
                }
                .accessibilityLabel("Add Repository")
            }
        }
        .sheet(isPresented: $isAddRepositoryPresented) {
            AddRepositoryView(model: model)
        }
        .sheet(item: $model.editingRepository) { _ in
            EditRepositorySheet(model: model)
        }
    }

    private var protectionModeSection: some View {
        Section {
            VStack(alignment: .leading, spacing: 12) {
                HStack(spacing: 10) {
                    protectionModeButton(.block)
                    protectionModeButton(.labelOnly)
                }

                Text(model.protectionMode.detail)
                    .font(.footnote)
                    .foregroundStyle(.secondary)
                    .fixedSize(horizontal: false, vertical: true)
            }
            .padding(.vertical, 4)
        } header: {
            Text("Repo Protection Mode")
        } footer: {
            Text("Choose whether synced repository entries should block calls or only label them in iOS. Personal entries continue blocking in either mode.")
                .font(.footnote)
        }
    }

    // MARK: Repositories list
    
    private var repositoriesSection: some View {
        Section {
            ForEach(model.repositories) { repo in
                RepositoryRowView(
                    repo: repo,
                    isActive: repo.id == model.activeRepositoryID,
                    hasTrustedKey: repo.isBuiltIn || (repo.trustedKeyFingerprint.map(SpamBlockerShared.isTrusted(fingerprint:)) ?? false),
                    onActivate: {
                        Task { await model.setActiveRepository(repo) }
                    },
                    onEdit: {
                        model.beginEditing(repo)
                    }
                )
            }
            .onDelete { indexSet in
                for index in indexSet {
                    let repo = model.repositories[index]
                    guard !repo.isBuiltIn else { continue }
                    Task { await model.removeRepository(repo) }
                }
            }
        } header: {
            Text("Repositories")
        } footer: {
            Text("Tap a repository to make it active. SpamSniper restores that repository’s saved blocklist selections when you switch. Tap ••• to edit. Swipe left to delete custom repositories.")
                .font(.footnote)
        }
    }
    
    // MARK: Trusted Keys
    
    private var trustedKeysSection: some View {
        Section {
            NavigationLink {
                TrustedKeysView(model: model)
            } label: {
                HStack {
                    Label("Trusted Keys", systemImage: "key.fill")
                    Spacer()
                    Text("\(model.trustedKeys.count)")
                        .foregroundStyle(.secondary)
                        .font(.subheadline)
                }
            }
        } footer: {
            Text("Manage the OpenPGP public keys used to verify repository metadata and downloaded blocklist signatures before sync.")
                .font(.footnote)
        }
    }

    private var diagnosticsSection: some View {
        Section {
            NavigationLink {
                SyncDiagnosticsView(model: model)
            } label: {
                HStack {
                    Label("Sync Diagnostics", systemImage: "stethoscope")
                    Spacer()
                    Text(diagnosticsBadgeText)
                        .foregroundStyle(diagnosticsBadgeColor)
                        .font(.subheadline.weight(.semibold))
                }
            }
        } footer: {
            Text("Review the last successful sync, fallback usage, imported counts, contacts exclusions, signing-key fingerprint, and extension reload state.")
                .font(.footnote)
        }
    }

    private var diagnosticsBadgeText: String {
        switch model.syncDiagnostics.health {
        case .healthy:
            return "Healthy"
        case .stale:
            return "Stale"
        case .neverSynced:
            return "Never"
        }
    }

    private var diagnosticsBadgeColor: Color {
        switch model.syncDiagnostics.health {
        case .healthy:
            return .green
        case .stale, .neverSynced:
            return .orange
        }
    }

    private var buttonGradientColors: [Color] {
        AppPalette(colorScheme: colorScheme).primaryButton
    }

    private func protectionModeButton(_ mode: ProtectionMode) -> some View {
        Button {
            Task {
                await model.setProtectionMode(mode)
            }
        } label: {
            HStack(spacing: 8) {
                Image(systemName: mode == .block ? "hand.raised.fill" : "tag.fill")
                    .font(.caption.weight(.bold))
                Text(mode.title)
                    .font(.caption.weight(.bold))
            }
            .foregroundStyle(model.protectionMode == mode ? .white : .primary)
            .padding(.horizontal, 12)
            .padding(.vertical, 10)
            .frame(maxWidth: .infinity)
            .background(
                model.protectionMode == mode
                ? AnyShapeStyle(LinearGradient(colors: buttonGradientColors, startPoint: .leading, endPoint: .trailing))
                : AnyShapeStyle(.regularMaterial),
                in: RoundedRectangle(cornerRadius: 16, style: .continuous)
            )
        }
        .buttonStyle(.plain)
        .disabled(model.isBusy)
        .opacity(model.isBusy ? 0.72 : 1)
    }
}

// MARK: - Repository Row

private struct RepositoryRowView: View {
    let repo: StoredRepository
    let isActive: Bool
    let hasTrustedKey: Bool
    let onActivate: () -> Void
    let onEdit: () -> Void
    
    @Environment(\.colorScheme) private var colorScheme
    
    private var palette: AppPalette { AppPalette(colorScheme: colorScheme) }
    
    var body: some View {
        HStack(spacing: 12) {
            Image(systemName: isActive ? "checkmark.circle.fill" : "circle")
                .foregroundStyle(isActive ? palette.tint : palette.secondaryText)
                .onTapGesture(perform: onActivate)
            
            VStack(alignment: .leading, spacing: 2) {
                HStack(spacing: 4) {
                    Text(repo.displayName)
                        .font(.subheadline)
                    if !hasTrustedKey {
                        Image(systemName: "exclamationmark.triangle.fill")
                            .foregroundStyle(palette.warning)
                            .imageScale(.small)
                            .help("No trusted key associated. Syncing will fail until you trust the signing key.")
                    }
                }
                if repo.isBuiltIn {
                    Text("Built-in")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                } else {
                    Text(repo.urlString)
                        .font(.caption)
                        .foregroundStyle(.secondary)
                        .lineLimit(1)
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .contentShape(Rectangle())
            .onTapGesture(perform: onActivate)
            
            if !repo.isBuiltIn {
                Button(action: onEdit) {
                    Image(systemName: "pencil")
                        .foregroundStyle(palette.secondaryText)
                        .imageScale(.small)
                }
                .buttonStyle(.plain)
            }
        }
        .deleteDisabled(repo.isBuiltIn)
    }
}

struct SyncDiagnosticsView: View {
    @Bindable var model: SpamBlockerModel

    var body: some View {
        List {
            Section("Sync Health") {
                LabeledContent("Status", value: syncHealthTitle)
                LabeledContent("Last successful sync", value: lastSuccessfulSyncValue)
                if let syncDate = model.syncDiagnostics.lastSuccessfulSyncAt {
                    LabeledContent("Synced on", value: syncDate.formatted(date: .abbreviated, time: .shortened))
                }
                if !model.syncDiagnostics.lastAttemptMessage.isEmpty {
                    LabeledContent("Last attempt", value: model.syncDiagnostics.lastAttemptMessage)
                }
            }

            Section("Repository") {
                LabeledContent("Repository", value: model.syncDiagnostics.repositoryDisplayName.ifEmpty("Unknown"))
                LabeledContent("Resolved source", value: model.syncDiagnostics.repositorySourceLabel.ifEmpty("Unknown"))
                LabeledContent("Bundled fallback", value: model.syncDiagnostics.usedBundledFallback ? "Used" : "Not used")
                LabeledContent("Signing key", value: model.syncDiagnostics.repositoryKeyFingerprint.ifEmpty("Unknown"))
            }

            Section("Counts") {
                LabeledContent("Imported repo entries", value: "\(model.syncDiagnostics.importedRepoEntryCount)")
                LabeledContent("Excluded contacts", value: "\(model.syncDiagnostics.excludedContactCount)")
                LabeledContent("Effective feed size", value: "\(model.blockedNumberCount)")
            }

            Section("Extension") {
                LabeledContent("Last reload", value: extensionReloadTitle)
                if let reloadDate = model.syncDiagnostics.lastExtensionReloadAt {
                    LabeledContent("Reloaded on", value: reloadDate.formatted(date: .abbreviated, time: .shortened))
                }
                if !model.syncDiagnostics.lastExtensionReloadMessage.isEmpty {
                    Text(model.syncDiagnostics.lastExtensionReloadMessage)
                        .font(.footnote)
                        .foregroundStyle(.secondary)
                }
            }
        }
        .navigationTitle("Sync Diagnostics")
        .navigationBarTitleDisplayMode(.inline)
    }

    private var syncHealthTitle: String {
        switch model.syncDiagnostics.health {
        case .healthy:
            return "Healthy"
        case .stale:
            return "Stale"
        case .neverSynced:
            return "Never synced"
        }
    }

    private var lastSuccessfulSyncValue: String {
        guard let date = model.syncDiagnostics.lastSuccessfulSyncAt else {
            return "No successful sync yet"
        }

        return SpamBlockerModel.syncFormatter.localizedString(for: date, relativeTo: Date())
    }

    private var extensionReloadTitle: String {
        switch model.syncDiagnostics.lastExtensionReloadSucceeded {
        case true:
            return "Succeeded"
        case false:
            return "Failed"
        case nil:
            return "No reload recorded"
        }
    }
}

private extension String {
    func ifEmpty(_ fallback: String) -> String {
        trimmingCharacters(in: .whitespacesAndNewlines).isEmpty ? fallback : self
    }
}

// MARK: - Edit Repository Sheet

struct EditRepositorySheet: View {
    @Bindable var model: SpamBlockerModel
    @Environment(\.dismiss) private var dismiss
    @Environment(\.colorScheme) private var colorScheme
    
    private var palette: AppPalette { AppPalette(colorScheme: colorScheme) }
    
    var body: some View {
        NavigationStack {
            Form {
                Section {
                    LabeledContent("Name") {
                        TextField("Display name", text: $model.editNameInput)
                            .multilineTextAlignment(.trailing)
                            .autocorrectionDisabled()
                    }
                } footer: {
                    Text("Optional. Overrides the repository's own name in the UI.")
                        .font(.footnote)
                }
                
                Section {
                    LabeledContent("URL") {
                        TextField("repo.json URL", text: $model.editURLInput)
                            .multilineTextAlignment(.trailing)
                            .textInputAutocapitalization(.never)
                            .autocorrectionDisabled()
                            .keyboardType(.URL)
                            .onChange(of: model.editURLInput) { _, _ in
                                if model.editTestPassed { model.editTestPassed = false }
                                model.editTestMessage = nil
                                model.resetEditRepositoryValidation()
                            }
                    }
                } footer: {
                    Text("Test the URL before saving to confirm it hosts a valid signed repository.")
                        .font(.footnote)
                }
                
                if model.editTestPassed && !model.editPendingKeyFingerprint.isEmpty {
                    Section {
                        VStack(alignment: .leading, spacing: 6) {
                            Label("Signing Key", systemImage: "key")
                                .font(.caption)
                                .foregroundStyle(.secondary)
                            
                            Text(model.editPendingKeyFingerprint.formattedAsFingerprintGroups())
                                .font(.caption)
                                .monospaced()
                                .foregroundStyle(.primary)
                            
                            if model.editPendingKeyAlreadyTrusted {
                                Label("Key is already trusted", systemImage: "checkmark.seal.fill")
                                    .font(.caption)
                                    .foregroundStyle(palette.success)
                            } else {
                                Button {
                                    model.trustEditPendingKey()
                                } label: {
                                    Label("Trust This Key", systemImage: "checkmark.seal")
                                        .font(.caption)
                                }
                                .tint(palette.warning)
                                
                                Text("You must trust this key before the repository edit can be saved and synced.")
                                    .font(.caption2)
                                    .foregroundStyle(.secondary)
                            }
                        }
                        .padding(.vertical, 4)
                    }
                }
                
                Section {
                    Button(model.isTestingEditRepository ? "Testing…" : "Test URL") {
                        Task { await model.testEditRepositoryInput() }
                    }
                    .disabled(
                        model.isTestingEditRepository ||
                        model.editURLInput.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
                    )
                    
                    if let msg = model.editTestMessage {
                        Label {
                            Text(msg).font(.footnote)
                        } icon: {
                            Image(systemName: model.editTestPassed ? "checkmark.circle.fill" : "exclamationmark.circle")
                                .foregroundStyle(model.editTestPassed ? palette.success : palette.warning)
                        }
                        .font(.footnote)
                        .foregroundStyle(model.editTestPassed ? palette.success : palette.secondaryText)
                    }
                }
            }
            .navigationTitle("Edit Repository")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") {
                        model.cancelEditing()
                        dismiss()
                    }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Save") {
                        Task {
                            if await model.saveEditedRepository() {
                                dismiss()
                            }
                        }
                    }
                    .disabled(
                        model.editURLInput.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty ||
                        !model.editTestPassed ||
                        (!model.editPendingKeyFingerprint.isEmpty && !model.editPendingKeyAlreadyTrusted)
                    )
                }
            }
        }
    }
}

// MARK: - Preview

#Preview {
    NavigationStack {
        SettingsView(model: SpamBlockerModel())
    }
}
