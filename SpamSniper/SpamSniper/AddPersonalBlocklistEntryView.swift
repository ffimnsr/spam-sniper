import SwiftUI

struct AddPersonalBlocklistEntryView: View {
    @Environment(\.dismiss) private var dismiss
    @Environment(\.colorScheme) private var colorScheme
    var model: SpamBlockerModel
    /// When non-nil, we are editing an existing entry.
    var editingEntry: PersonalBlocklistEntry?

    @State private var phoneInput = ""
    @State private var displayNameInput = ""
    @State private var notesInput = ""
    @State private var tagsInput = ""
    @State private var errorMessage: String?
    @State private var showDeleteConfirm = false
    @State private var isSubmitting = false
    @FocusState private var phoneFieldFocused: Bool

    private var isEditing: Bool { editingEntry != nil }
    private var palette: AppPalette { AppPalette(colorScheme: colorScheme) }

    // MARK: Body

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    phoneField
                } header: {
                    Text("Phone Number")
                } footer: {
                    Text("Enter with country code, e.g. +1 555 000 1234. Saved personal entries are merged into the final blocking feed the extension reloads.")
                        .font(.footnote)
                }

                Section("Details (optional)") {
                    TextField("Display name", text: $displayNameInput)
                    TextField("Notes", text: $notesInput, axis: .vertical)
                        .lineLimit(3, reservesSpace: true)
                    TextField("Tags (comma-separated)", text: $tagsInput)
                }

                if let errorMessage {
                    Section {
                        Text(errorMessage)
                            .foregroundStyle(palette.destructive)
                            .font(.footnote)
                    }
                }

                if isEditing {
                    Section {
                        Button("Delete from Personal List", role: .destructive) {
                            showDeleteConfirm = true
                        }
                    }
                }
            }
            .navigationTitle(isEditing ? "Edit Entry" : "Add to Personal List")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                        .disabled(isSubmitting)
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button(isEditing ? "Save" : "Add") { save() }
                        .fontWeight(.semibold)
                        .disabled(isSubmitting)
                }
            }
            .confirmationDialog(
                "Delete \(editingEntry?.phoneNumberE164 ?? "this entry") from your personal list?",
                isPresented: $showDeleteConfirm,
                titleVisibility: .visible
            ) {
                Button("Delete", role: .destructive) { delete() }
                Button("Cancel", role: .cancel) {}
            }
        }
        .onAppear { populateForEditing() }
        .interactiveDismissDisabled(isSubmitting)
    }

    // MARK: Phone field

    private var phoneField: some View {
        HStack {
            Image(systemName: "phone")
                .foregroundStyle(palette.secondaryText)
            TextField("+1 555 000 1234", text: $phoneInput)
                .keyboardType(.phonePad)
                .textInputAutocapitalization(.never)
                .autocorrectionDisabled()
                .focused($phoneFieldFocused)
                .disabled(isEditing) // phone number is immutable once saved
                .foregroundStyle(isEditing ? palette.secondaryText : palette.primaryText)
        }
    }

    // MARK: Helpers

    private func populateForEditing() {
        guard let entry = editingEntry else {
            phoneFieldFocused = true
            return
        }
        phoneInput = entry.phoneNumberE164
        displayNameInput = entry.displayName
        notesInput = entry.notes
        tagsInput = entry.tags.joined(separator: ", ")
    }

    private func save() {
        let digits = phoneInput.filter(\.isNumber)
        guard !digits.isEmpty, let number = Int64(digits), number > 0 else {
            errorMessage = "Enter a valid phone number."
            return
        }

        let tags = tagsInput
            .split(separator: ",")
            .map { $0.trimmingCharacters(in: .whitespacesAndNewlines) }
            .filter { !$0.isEmpty }

        errorMessage = nil
        isSubmitting = true

        Task { @MainActor in
            defer { isSubmitting = false }

            if let existing = editingEntry {
                let updated = PersonalBlocklistEntry(
                    id: existing.id,
                    phoneNumber: existing.phoneNumber,
                    displayName: displayNameInput,
                    notes: notesInput,
                    tags: tags,
                    createdAt: existing.createdAt,
                    updatedAt: Date()
                )
                model.personalBlocklistStore.update(updated)
            } else {
                let entry = PersonalBlocklistEntry(
                    phoneNumber: number,
                    displayName: displayNameInput,
                    notes: notesInput,
                    tags: tags
                )
                let added = model.personalBlocklistStore.add(entry)
                if !added {
                    errorMessage = "\(entry.phoneNumberE164) is already in your personal list."
                    return
                }
            }

            await model.processPersonalBlocklistChange()
            dismiss()
        }
    }

    private func delete() {
        guard let entry = editingEntry else { return }
        errorMessage = nil
        isSubmitting = true

        Task { @MainActor in
            defer { isSubmitting = false }
            model.personalBlocklistStore.delete(ids: [entry.id])
            await model.processPersonalBlocklistChange()
            dismiss()
        }
    }
}

// MARK: - Preview

#Preview {
    AddPersonalBlocklistEntryView(model: SpamBlockerModel())
}
