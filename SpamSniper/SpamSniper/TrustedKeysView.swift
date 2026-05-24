import SwiftUI

// MARK: - TrustedKeysView

struct TrustedKeysView: View {
    @Bindable var model: SpamBlockerModel
    @State private var isShowingImportSheet = false
    @State private var pendingKeyDeletion: TrustedKey?
    
    var body: some View {
        List {
            Section {
                ForEach(model.trustedKeys) { key in
                    TrustedKeyRowView(
                        key: key,
                        dependentRepositories: model.repositoriesUsingTrustedKey(key)
                    )
                }
                .onDelete { indexSet in
                    for index in indexSet {
                        let key = model.trustedKeys[index]
                        guard !key.isBuiltIn else { continue }
                        let dependencies = model.repositoriesUsingTrustedKey(key)
                        if dependencies.isEmpty {
                            model.removeTrustedKey(key)
                        } else {
                            pendingKeyDeletion = key
                        }
                    }
                }
            } header: {
                Text("Trusted Public Keys")
            } footer: {
                Text(
                    """
                    Only content signed by a key in this list will be accepted. \
                    The built-in community key is always trusted and cannot be removed. \
                    Swipe left to remove a custom key.
                    """
                )
                .font(.footnote)
            }
        }
        .navigationTitle("Trusted Keys")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .navigationBarTrailing) {
                Button {
                    isShowingImportSheet = true
                } label: {
                    Label("Import Key", systemImage: "plus")
                }
            }
        }
        .sheet(isPresented: $isShowingImportSheet) {
            ImportKeySheet(model: model)
        }
        .alert(
            pendingDeletionTitle,
            isPresented: Binding(
                get: { pendingKeyDeletion != nil },
                set: { isPresented in
                    if !isPresented {
                        pendingKeyDeletion = nil
                    }
                }
            ),
            presenting: pendingKeyDeletion
        ) { key in
            Button("Delete Key", role: .destructive) {
                model.removeTrustedKey(key)
                pendingKeyDeletion = nil
            }
            Button("Cancel", role: .cancel) {
                pendingKeyDeletion = nil
            }
        } message: { key in
            Text(pendingDeletionMessage(for: key))
        }
    }
    
    private var pendingDeletionTitle: String {
        guard let pendingKeyDeletion else {
            return "Delete trusted key?"
        }
        
        let count = model.repositoriesUsingTrustedKey(pendingKeyDeletion).count
        return count == 1 ? "Delete key used by 1 repository?" : "Delete key used by \(count) repositories?"
    }
    
    private func pendingDeletionMessage(for key: TrustedKey) -> String {
        let repositories = model.repositoriesUsingTrustedKey(key)
        let repositoryNames = repositories.map(\.displayName).joined(separator: ", ")
        return "Deleting this key will clear the saved signing-key association for: \(repositoryNames). Those repositories must be revalidated or trusted again before they can sync."
    }
}

// MARK: - Row

private struct TrustedKeyRowView: View {
    let key: TrustedKey
    let dependentRepositories: [StoredRepository]
    
    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            HStack {
                Text(key.name)
                    .font(.subheadline)
                    .fontWeight(.medium)
                Spacer()
                if key.isBuiltIn {
                    Text("Built-in")
                        .font(.caption2)
                        .foregroundStyle(.secondary)
                        .padding(.horizontal, 6)
                        .padding(.vertical, 2)
                        .background(.quaternary, in: Capsule())
                }
            }
            if !key.isBuiltIn {
                Text(key.formattedFingerprint.isEmpty ? key.id : key.formattedFingerprint)
                    .font(.caption)
                    .foregroundStyle(.secondary)
                    .monospaced()
                Text(dependencySummary)
                    .font(.caption2.weight(.semibold))
                    .foregroundStyle(dependentRepositories.isEmpty ? .tertiary : .primary)
                if !dependentRepositories.isEmpty {
                    Text(dependentRepositories.map(\.displayName).joined(separator: ", "))
                        .font(.caption2)
                        .foregroundStyle(.secondary)
                }
                Text("Added \(key.addedAt.formatted(date: .abbreviated, time: .omitted))")
                    .font(.caption2)
                    .foregroundStyle(.tertiary)
            }
        }
        .padding(.vertical, 2)
        .deleteDisabled(key.isBuiltIn)
    }
    
    private var dependencySummary: String {
        switch dependentRepositories.count {
        case 0:
            return "Not assigned to any repository"
        case 1:
            return "Used by 1 repository"
        default:
            return "Used by \(dependentRepositories.count) repositories"
        }
    }
}

// MARK: - Import Sheet

struct ImportKeySheet: View {
    @Bindable var model: SpamBlockerModel
    @Environment(\.dismiss) private var dismiss
    @Environment(\.colorScheme) private var colorScheme
    
    @State private var keyName = ""
    @State private var armoredKeyText = ""
    @State private var errorMessage: String?
    @State private var isImporting = false
    
    private var palette: AppPalette { AppPalette(colorScheme: colorScheme) }
    
    var body: some View {
        NavigationStack {
            Form {
                Section {
                    TextField("Key name (optional)", text: $keyName)
                        .autocorrectionDisabled()
                } header: {
                    Text("Label")
                } footer: {
                    Text("A friendly name for the key. Leave blank to use an auto-generated label.")
                        .font(.footnote)
                }
                
                Section {
                    TextEditor(text: $armoredKeyText)
                        .monospaced()
                        .frame(minHeight: 160)
                        .autocorrectionDisabled()
                        .textInputAutocapitalization(.never)
                    
                    Button("Paste from Clipboard") {
                        if let string = UIPasteboard.general.string {
                            armoredKeyText = string
                        }
                    }
                    .font(.footnote)
                } header: {
                    Text("ASCII-Armored Public Key")
                } footer: {
                    Text("Paste the ASCII-armored OpenPGP public key block (-----BEGIN PGP PUBLIC KEY BLOCK-----).")
                        .font(.footnote)
                }
                
                if let errorMessage {
                    Section {
                        Label(errorMessage, systemImage: "exclamationmark.circle")
                            .foregroundStyle(palette.destructive)
                            .font(.footnote)
                    }
                }
            }
            .navigationTitle("Import Key")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button(isImporting ? "Importing…" : "Import") {
                        importKey()
                    }
                    .disabled(armoredKeyText.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty || isImporting)
                }
            }
        }
    }
    
    private func importKey() {
        isImporting = true
        errorMessage = nil
        let armored = armoredKeyText.trimmingCharacters(in: .whitespacesAndNewlines)
        do {
            try model.addTrustedKey(armoredData: armored, name: keyName)
            dismiss()
        } catch {
            errorMessage = "Could not read the key: \(error.localizedDescription). Make sure it is a valid ASCII-armored OpenPGP public key."
        }
        isImporting = false
    }
}
