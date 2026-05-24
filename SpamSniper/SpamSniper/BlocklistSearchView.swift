import SwiftUI

struct BlocklistSearchView: View {
    @Bindable var model: SpamBlockerModel
    @FocusState private var isSearchFieldFocused: Bool
    @Environment(\.verticalSizeClass) private var verticalSizeClass
    @Environment(\.dynamicTypeSize) private var dynamicTypeSize

    @State private var isAddEntryPresented = false
    @State private var editingEntry: PersonalBlocklistEntry?

    var body: some View {
        VStack(spacing: 0) {
            searchPanel
                .frame(maxWidth: .infinity, alignment: .top)
                .background(Color(uiColor: .systemBackground))

            Divider()

            resultsPanel
                .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .top)
                .background(Color(uiColor: .secondarySystemBackground))
        }
        .navigationTitle("Number Search")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .navigationBarTrailing) {
                Button {
                    isAddEntryPresented = true
                } label: {
                    Image(systemName: "plus")
                        .fontWeight(.semibold)
                }
                .accessibilityLabel("Add to personal list")
            }
        }
        .sheet(isPresented: $isAddEntryPresented) {
            AddPersonalBlocklistEntryView(model: model)
        }
        .sheet(item: $editingEntry) { entry in
            AddPersonalBlocklistEntryView(model: model, editingEntry: entry)
        }
        .task {
            if model.numberSearchMessage == nil {
                model.numberSearchMessage = "Search the numbers already synced into SpamSniper."
            }
        }
        .onReceive(NotificationCenter.default.publisher(for: .personalBlocklistStoreDidChange)) { _ in
            model.refreshPersonalEntries()
        }
    }

    private var searchPanel: some View {
        VStack(alignment: .leading, spacing: 14) {
            Text("Search the local blocklist database")
                .font(.headline)

            VStack(alignment: .leading, spacing: 12) {
                HStack(spacing: 10) {
                    Image(systemName: "magnifyingglass")
                        .foregroundStyle(.secondary)
                    TextField("Enter phone number", text: $model.numberSearchQuery)
                        .textInputAutocapitalization(.never)
                        .autocorrectionDisabled()
                        .keyboardType(.phonePad)
                        .focused($isSearchFieldFocused)
                }
                .padding(.horizontal, 14)
                .padding(.vertical, 12)
                .background(
                    Color(uiColor: .secondarySystemBackground),
                    in: RoundedRectangle(cornerRadius: 16, style: .continuous)
                )

                Button(model.isSearchingNumbers ? "Searching…" : "Search") {
                    isSearchFieldFocused = false
                    Task { await model.searchNumbers() }
                }
                .buttonStyle(.borderedProminent)
                .disabled(model.isSearchingNumbers)
                .frame(maxWidth: .infinity, alignment: .trailing)
            }

            Text(model.numberSearchMessage ?? "Search the numbers already synced into SpamSniper.")
                .font(.footnote)
                .foregroundStyle(.secondary)
                .fixedSize(horizontal: false, vertical: true)
        }
        .frame(maxWidth: .infinity, alignment: .topLeading)
        .frame(minHeight: searchPanelMinHeight, idealHeight: searchPanelIdealHeight, alignment: .top)
        .padding(.horizontal, 20)
        .padding(.vertical, searchPanelVerticalPadding)
    }

    @ViewBuilder
    private var resultsPanel: some View {
        if model.isSearchingNumbers && model.numberSearchResults.isEmpty {
            ContentUnavailableView(
                "Searching…",
                systemImage: "magnifyingglass.circle",
                description: Text("Scanning the local blocklist database.")
            )
            .frame(maxWidth: .infinity, maxHeight: .infinity)
        } else if model.numberSearchResults.isEmpty {
            emptyResultsView
        } else {
            sectionedResultsList
        }
    }

    private var emptyResultsView: some View {
        let trimmed = model.numberSearchQuery.trimmingCharacters(in: .whitespacesAndNewlines)
        return ContentUnavailableView(
            trimmed.isEmpty ? "Search a number" : "No matches",
            systemImage: "phone.badge.questionmark",
            description: Text(emptyResultsDescription)
        )
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }

    @ViewBuilder
    private var sectionedResultsList: some View {
        let personal = model.numberSearchResults.filter { $0.source == .personal || $0.source == .combined }
        let repo = model.numberSearchResults.filter { $0.source == .repo }

        List {
            // Personal / combined section (always on top)
            if !personal.isEmpty {
                Section {
                    ForEach(personal) { result in
                        NumberSearchResultRow(result: result) {
                            if let entry = result.personalEntry {
                                editingEntry = entry
                            }
                        }
                        .listRowInsets(EdgeInsets(top: 12, leading: 20, bottom: 12, trailing: 20))
                        .listRowSeparator(.visible)
                        .listRowBackground(Color.clear)
                    }
                } header: {
                    Label("My Personal List", systemImage: "person.fill")
                        .foregroundStyle(.purple)
                        .font(.footnote.weight(.semibold))
                }
            }

            // Repo section
            if !repo.isEmpty {
                Section {
                    ForEach(repo) { result in
                        NumberSearchResultRow(result: result, onEditPersonal: nil)
                            .listRowInsets(EdgeInsets(top: 12, leading: 20, bottom: 12, trailing: 20))
                            .listRowSeparator(.visible)
                            .listRowBackground(Color.clear)
                    }
                } header: {
                    Label("Synced Blocklist", systemImage: "arrow.triangle.2.circlepath")
                        .foregroundStyle(.secondary)
                        .font(.footnote.weight(.semibold))
                }
            }
        }
        .listStyle(.plain)
        .scrollContentBackground(.hidden)
    }

    // MARK: Layout helpers

    private var searchPanelMinHeight: CGFloat {
        if verticalSizeClass == .compact { return 116 }
        if dynamicTypeSize.isAccessibilitySize { return 136 }
        return 132
    }

    private var searchPanelIdealHeight: CGFloat {
        if verticalSizeClass == .compact { return 132 }
        if dynamicTypeSize.isAccessibilitySize { return 170 }
        return 156
    }

    private var searchPanelVerticalPadding: CGFloat {
        if verticalSizeClass == .compact { return 12 }
        if dynamicTypeSize.isAccessibilitySize { return 14 }
        return 18
    }

    private var emptyResultsDescription: String {
        let trimmedQuery = model.numberSearchQuery.trimmingCharacters(in: .whitespacesAndNewlines)
        if trimmedQuery.isEmpty {
            return "Enter digits, paste a formatted number, then search the synced blocklist."
        }
        return model.numberSearchMessage ?? "Try a different number or refresh your blocklists first."
    }
}

// MARK: - NumberSearchResultRow

private struct NumberSearchResultRow: View {
    let result: BlockedNumberSearchResult
    /// Callback when the user taps the edit button on a personal row.
    var onEditPersonal: (() -> Void)?

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack(alignment: .top, spacing: 12) {
                VStack(alignment: .leading, spacing: 4) {
                    Text(result.record.phoneNumberE164)
                        .font(.headline)
                        .textSelection(.enabled)
                    Text(result.record.displayName)
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                        .fixedSize(horizontal: false, vertical: true)
                }

                Spacer(minLength: 12)

                VStack(alignment: .trailing, spacing: 6) {
                    Text(result.matchKind.rawValue.capitalized)
                        .font(.caption.weight(.semibold))
                        .foregroundStyle(matchColor)
                        .padding(.horizontal, 10)
                        .padding(.vertical, 6)
                        .background(matchColor.opacity(0.12), in: Capsule())

                    if result.source == .combined {
                        sourceChip(label: "Also in your list", color: .purple)
                    }
                }
            }

            ViewThatFits(in: .horizontal) {
                HStack(spacing: 8) {
                    InfoChip(label: result.record.category, tint: result.source == .personal ? .purple : .orange)
                    InfoChip(label: result.record.confidence.capitalized, tint: .blue)
                    Spacer(minLength: 0)
                }

                VStack(alignment: .leading, spacing: 8) {
                    InfoChip(label: result.record.category, tint: result.source == .personal ? .purple : .orange)
                    InfoChip(label: result.record.confidence.capitalized, tint: .blue)
                }
            }

            if !result.record.aliases.isEmpty {
                Text("Aliases: \(result.record.aliases.joined(separator: ", "))")
                    .font(.footnote)
                    .foregroundStyle(.secondary)
                    .fixedSize(horizontal: false, vertical: true)
            }

            if !result.record.tags.isEmpty {
                Text("Tags: \(result.record.tags.joined(separator: ", "))")
                    .font(.footnote)
                    .foregroundStyle(.secondary)
                    .fixedSize(horizontal: false, vertical: true)
            }

            // Personal notes (from personalEntry for .combined, or from record.notes for .personal)
            let personalNotes: String = {
                if let entry = result.personalEntry, !entry.notes.isEmpty {
                    return entry.notes
                }
                return result.record.notes
            }()
            if !personalNotes.isEmpty {
                Text(personalNotes)
                    .font(.footnote)
                    .foregroundStyle(.secondary)
                    .fixedSize(horizontal: false, vertical: true)
            }

            // Edit button for personal/combined
            if let onEdit = onEditPersonal {
                HStack {
                    Spacer()
                    Button {
                        onEdit()
                    } label: {
                        Label("Edit personal entry", systemImage: "pencil")
                            .font(.caption.weight(.medium))
                    }
                    .buttonStyle(.bordered)
                    .controlSize(.small)
                    .tint(.purple)
                }
            }
        }
        .padding(16)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Color(uiColor: .systemBackground), in: RoundedRectangle(cornerRadius: 18, style: .continuous))
        .accessibilityElement(children: .combine)
    }

    private var matchColor: Color {
        switch result.matchKind {
        case .exact:    return .green
        case .suffix:   return .blue
        case .contains: return .orange
        }
    }

    @ViewBuilder
    private func sourceChip(label: String, color: Color) -> some View {
        Text(label)
            .font(.caption2.weight(.medium))
            .foregroundStyle(color)
            .padding(.horizontal, 8)
            .padding(.vertical, 4)
            .background(color.opacity(0.12), in: Capsule())
    }
}

// MARK: - InfoChip

private struct InfoChip: View {
    let label: String
    let tint: Color

    var body: some View {
        Text(label)
            .font(.caption.weight(.medium))
            .foregroundStyle(tint)
            .padding(.horizontal, 10)
            .padding(.vertical, 6)
            .background(tint.opacity(0.12), in: Capsule())
            .fixedSize()
    }
}

// MARK: - Preview

private struct BlocklistSearchPreviewHost: View {
    @State private var model = SpamBlockerModel()

    var body: some View {
        NavigationStack {
            BlocklistSearchView(model: model)
        }
    }
}

#Preview {
    BlocklistSearchPreviewHost()
}
