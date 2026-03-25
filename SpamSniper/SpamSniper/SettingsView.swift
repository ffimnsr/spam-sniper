import SwiftUI

// MARK: - SettingsView

struct SettingsView: View {
    @Bindable var model: SpamBlockerModel

    var body: some View {
        Form {
            repositoriesSection
            addRepositorySection
        }
        .navigationTitle("Settings")
        .navigationBarTitleDisplayMode(.inline)
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
            Text("Tap a repository to make it active. Tap ••• to edit. Swipe left to delete custom repositories.")
                .font(.footnote)
        }
    }

    // MARK: Add new repository

    private var addRepositorySection: some View {
        Section("Add Repository") {
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
                // Reset test state whenever the user edits the URL
                model.repositoryTestPassed = false
                model.pendingValidatedRepositoryURL = nil
                model.pendingRepoMetaName = ""
                model.repositoryTestMessage = nil
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

            Button("Add to List") {
                Task { await model.saveValidatedRepositoryToList() }
            }
            .disabled(!model.repositoryTestPassed || model.isTestingRepository)

            if let msg = model.repositoryTestMessage {
                Label {
                    Text(msg)
                        .font(.footnote)
                } icon: {
                    Image(systemName: model.repositoryTestPassed ? "checkmark.circle.fill" : "exclamationmark.circle")
                        .foregroundStyle(model.repositoryTestPassed ? .green : .orange)
                }
                .font(.footnote)
                .foregroundStyle(model.repositoryTestPassed ? .green : .secondary)
            }
        }
    }
}

// MARK: - Repository Row

private struct RepositoryRowView: View {
    let repo: StoredRepository
    let isActive: Bool
    let onActivate: () -> Void
    let onEdit: () -> Void

    var body: some View {
        HStack(spacing: 12) {
            Image(systemName: isActive ? "checkmark.circle.fill" : "circle")
                .foregroundStyle(isActive ? Color.accentColor : Color.secondary)
                .onTapGesture(perform: onActivate)

            VStack(alignment: .leading, spacing: 2) {
                Text(repo.displayName)
                    .font(.subheadline)
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
                        .foregroundStyle(Color.secondary)
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
                            }
                    }
                } footer: {
                    Text("Test the URL before saving to confirm it hosts a valid signed repository.")
                        .font(.footnote)
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
                                .foregroundStyle(model.editTestPassed ? .green : .orange)
                        }
                        .font(.footnote)
                        .foregroundStyle(model.editTestPassed ? .green : .secondary)
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
                            await model.saveEditedRepository()
                            dismiss()
                        }
                    }
                    .disabled(
                        model.editURLInput.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty ||
                        !model.editTestPassed
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
