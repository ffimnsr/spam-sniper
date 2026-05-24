import SwiftUI

// MARK: - SettingsView

@MainActor
struct SettingsView: View {
    @Bindable var model: SpamBlockerModel
    @State private var isAddRepositoryPresented = false
    
    var body: some View {
        Form {
            repositoriesSection
            trustedKeysSection
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
