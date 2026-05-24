import SwiftUI

struct AddRepositoryView: View {
    @Bindable var model: SpamBlockerModel
    @Environment(\.dismiss) private var dismiss
    @Environment(\.colorScheme) private var colorScheme
    
    private var palette: AppPalette { AppPalette(colorScheme: colorScheme) }
    
    var body: some View {
        NavigationStack {
            Form {
                Section {
                    TextField(
                        model.pendingValidatedRepositoryURL == nil
                        ? "Label (uses repo name if blank)"
                        : "Label (uses \"\(model.pendingRepoMetaName)\" if blank)",
                        text: $model.repositoryNameInput
                    )
                    .autocorrectionDisabled()
                    
                    TextField(
                        "GitHub repo URL or direct repo.json URL",
                        text: $model.repositoryInput,
                        axis: .vertical
                    )
                    .textInputAutocapitalization(.never)
                    .autocorrectionDisabled()
                    .keyboardType(.URL)
                    .onChange(of: model.repositoryInput) { _, _ in
                        model.repositoryTestPassed = false
                        model.repositoryTestMessage = nil
                        model.resetPendingRepositoryValidation()
                    }
                    
                    Text(
                        """
                        Paste a GitHub repo URL or a direct raw repo.json URL. \
                        The test verifies signatures and blocklist availability.
                        """
                    )
                    .font(.footnote)
                    .foregroundStyle(.secondary)
                    
                    Button(model.isTestingRepository ? "Testing…" : "Test Repository") {
                        Task { await model.testRepositoryInput() }
                    }
                    .disabled(
                        model.isTestingRepository ||
                        model.repositoryInput.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
                    )
                    
                    if model.repositoryTestPassed && !model.pendingKeyFingerprint.isEmpty {
                        VStack(alignment: .leading, spacing: 6) {
                            Label("Signing Key", systemImage: "key")
                                .font(.caption)
                                .foregroundStyle(.secondary)
                            
                            Text(model.pendingKeyFingerprint.formattedAsFingerprintGroups())
                                .font(.caption)
                                .monospaced()
                                .foregroundStyle(.primary)
                            
                            if model.pendingKeyAlreadyTrusted {
                                Label("Key is already trusted", systemImage: "checkmark.seal.fill")
                                    .font(.caption)
                                    .foregroundStyle(palette.success)
                            } else {
                                Button {
                                    model.trustPendingKey()
                                } label: {
                                    Label("Trust This Key", systemImage: "checkmark.seal")
                                        .font(.caption)
                                }
                                .tint(palette.warning)
                                
                                Text("You must trust this key before the repository can be added and synced.")
                                    .font(.caption2)
                                    .foregroundStyle(.secondary)
                            }
                        }
                        .padding(.vertical, 4)
                    }
                    
                    Button("Add to List") {
                        Task {
                            if await model.saveValidatedRepositoryToList() {
                                dismiss()
                            }
                        }
                    }
                    .disabled(
                        !model.repositoryTestPassed ||
                        model.isTestingRepository ||
                        (!model.pendingKeyFingerprint.isEmpty && !model.pendingKeyAlreadyTrusted)
                    )
                    
                    if let msg = model.repositoryTestMessage {
                        Label {
                            Text(msg)
                                .font(.footnote)
                        } icon: {
                            Image(systemName: model.repositoryTestPassed ? "checkmark.circle.fill" : "exclamationmark.circle")
                                .foregroundStyle(model.repositoryTestPassed ? palette.success : palette.warning)
                        }
                        .font(.footnote)
                        .foregroundStyle(model.repositoryTestPassed ? palette.success : palette.secondaryText)
                    }
                }
            }
            .navigationTitle("Add Repository")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") {
                        dismiss()
                    }
                }
            }
        }
    }
}

#Preview {
    AddRepositoryView(model: SpamBlockerModel())
}
