import SwiftUI

struct BlocklistSearchView: View {
    @Bindable var model: SpamBlockerModel
    @FocusState private var isSearchFieldFocused: Bool
    @Environment(\.verticalSizeClass) private var verticalSizeClass
    @Environment(\.dynamicTypeSize) private var dynamicTypeSize
    @Environment(\.colorScheme) private var colorScheme

    @State private var isAddEntryPresented = false
    @State private var editingEntry: PersonalBlocklistEntry?
    @State private var deletingEntry: PersonalBlocklistEntry?

    private var palette: AppPalette { AppPalette(colorScheme: colorScheme) }
    private var trimmedQuery: String { model.numberSearchQuery.trimmingCharacters(in: .whitespacesAndNewlines) }

    var body: some View {
        GeometryReader { proxy in
            ZStack {
                LinearGradient(colors: palette.pageBackground, startPoint: .topLeading, endPoint: .bottomTrailing)
                    .ignoresSafeArea()

                decorativeBackground

                ScrollView {
                    VStack(spacing: 16) {
                        searchPanel

                        if showsCenteredResultsPanel {
                            Spacer(minLength: 0)
                            resultsPanel
                            Spacer(minLength: 0)
                        } else {
                            resultsPanel
                        }
                    }
                    .padding(.horizontal, 20)
                    .padding(.top, contentTopPadding)
                    .padding(.bottom, 28)
                    .frame(maxWidth: 760)
                    .frame(maxWidth: .infinity)
                    .frame(minHeight: proxy.size.height - contentTopPadding - 28, alignment: .top)
                }
                .scrollDismissesKeyboard(.interactively)
            }
        }
        .navigationTitle("Number Search")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .navigationBarTrailing) {
                Button {
                    isAddEntryPresented = true
                } label: {
                    Image(systemName: "plus")
                        .font(.headline.weight(.semibold))
                        .foregroundStyle(palette.tint)
                        .frame(width: 36, height: 36)
                        .background(.ultraThinMaterial, in: Circle())
                        .overlay {
                            Circle()
                                .strokeBorder(.white.opacity(0.22), lineWidth: 1)
                        }
                }
                .buttonStyle(.plain)
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
                model.numberSearchMessage = SpamBlockerModel.defaultNumberSearchMessage
            }
        }
        .onChange(of: model.numberSearchQuery) { oldValue, newValue in
            let trimmedNewValue = newValue.trimmingCharacters(in: .whitespacesAndNewlines)
            let hadSearchText = !oldValue.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
            guard trimmedNewValue.isEmpty, hadSearchText || !model.numberSearchResults.isEmpty else { return }
            resetSearch()
        }
        .onReceive(NotificationCenter.default.publisher(for: .personalBlocklistStoreDidChange)) { _ in
            model.refreshPersonalEntries()
            guard !trimmedQuery.isEmpty, !model.isSearchingNumbers else { return }
            Task { await model.searchNumbers() }
        }
        .confirmationDialog(
            "Delete \(deletingEntry?.phoneNumberE164 ?? "this entry") from your personal list?",
            isPresented: Binding(
                get: { deletingEntry != nil },
                set: { if !$0 { deletingEntry = nil } }
            ),
            titleVisibility: .visible
        ) {
            Button("Delete", role: .destructive, action: deleteSelectedPersonalEntry)
            Button("Cancel", role: .cancel) {
                deletingEntry = nil
            }
        }
    }

    private var decorativeBackground: some View {
        GeometryReader { proxy in
            ZStack {
                Circle()
                    .fill(palette.ambientGlow[0])
                    .frame(width: min(proxy.size.width * 0.78, 420), height: min(proxy.size.width * 0.78, 420))
                    .blur(radius: 70)
                    .offset(x: -proxy.size.width * 0.34, y: -120)

                Circle()
                    .fill(palette.ambientGlow[1])
                    .frame(width: min(proxy.size.width * 0.60, 320), height: min(proxy.size.width * 0.60, 320))
                    .blur(radius: 80)
                    .offset(x: proxy.size.width * 0.36, y: 120)
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            .allowsHitTesting(false)
        }
    }

    private var searchPanel: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack(alignment: .center, spacing: 12) {
                ZStack {
                    RoundedRectangle(cornerRadius: 14, style: .continuous)
                        .fill(LinearGradient(colors: palette.primaryButton, startPoint: .topLeading, endPoint: .bottomTrailing))
                    Image(systemName: "magnifyingglass")
                        .font(.system(size: 16, weight: .bold))
                        .foregroundStyle(palette.onTint)
                }
                .frame(width: 40, height: 40)
                .shadow(color: palette.tint.opacity(0.18), radius: 10, x: 0, y: 6)

                VStack(alignment: .leading, spacing: 2) {
                    Text("Search blocklists")
                        .font(.headline.weight(.bold))

                    if showsSearchSubtitle {
                        Text("Check the final blocking feed built from synced repositories and your personal list.")
                            .font(.footnote)
                            .foregroundStyle(palette.secondaryText)
                            .lineLimit(dynamicTypeSize.isAccessibilitySize ? nil : 2)
                            .fixedSize(horizontal: false, vertical: true)
                    }
                }

                Spacer(minLength: 0)
            }

            ViewThatFits(in: .horizontal) {
                HStack(spacing: 12) {
                    searchField
                    HStack(spacing: 12) {
                        searchButton
                            .frame(width: 152)
                        if showsResetAction {
                            resetButton
                                .frame(width: 116)
                        }
                    }
                }

                VStack(spacing: 12) {
                    searchField
                    HStack(spacing: 12) {
                        searchButton
                        if showsResetAction {
                            resetButton
                        }
                    }
                }
            }

            if shouldShowStatusBanner {
                statusBanner
            }
        }
        .padding(16)
        .background(.ultraThinMaterial, in: RoundedRectangle(cornerRadius: 30, style: .continuous))
        .overlay {
            RoundedRectangle(cornerRadius: 30, style: .continuous)
                .strokeBorder(.white.opacity(colorScheme == .dark ? 0.14 : 0.40), lineWidth: 1)
        }
        .shadow(color: Color.black.opacity(colorScheme == .dark ? 0.22 : 0.08), radius: 22, x: 0, y: 12)
    }

    private var searchField: some View {
        HStack(spacing: 12) {
            Image(systemName: "magnifyingglass")
                .font(.headline.weight(.semibold))
                .foregroundStyle(isSearchFieldFocused ? palette.tint : palette.secondaryText)

            TextField("Enter phone number", text: $model.numberSearchQuery)
                .font(.body.weight(.medium))
                .textInputAutocapitalization(.never)
                .autocorrectionDisabled()
                .keyboardType(.phonePad)
                .submitLabel(.search)
                .focused($isSearchFieldFocused)
                .onSubmit(performSearch)

            if !model.numberSearchQuery.isEmpty {
                Button {
                    resetSearch()
                } label: {
                    Image(systemName: "xmark.circle.fill")
                        .font(.body.weight(.semibold))
                        .foregroundStyle(palette.secondaryText)
                }
                .buttonStyle(.plain)
                .accessibilityLabel("Clear phone number")
            }
        }
        .padding(.horizontal, 14)
        .frame(minHeight: 50)
        .background(.regularMaterial, in: RoundedRectangle(cornerRadius: 18, style: .continuous))
        .overlay {
            RoundedRectangle(cornerRadius: 18, style: .continuous)
                .strokeBorder(isSearchFieldFocused ? palette.tint.opacity(0.70) : .white.opacity(colorScheme == .dark ? 0.12 : 0.34), lineWidth: isSearchFieldFocused ? 1.5 : 1)
        }
    }

    private var searchButton: some View {
        Button(action: performSearch) {
            HStack(spacing: 8) {
                if model.isSearchingNumbers {
                    ProgressView()
                        .tint(palette.onTint)
                } else {
                    Image(systemName: "magnifyingglass")
                        .font(.body.weight(.bold))
                }
                Text(model.isSearchingNumbers ? "Searching" : "Search")
                    .font(.body.weight(.bold))
            }
            .foregroundStyle(palette.onTint)
            .frame(maxWidth: .infinity)
            .frame(height: 50)
            .background(
                LinearGradient(colors: palette.primaryButton, startPoint: .topLeading, endPoint: .bottomTrailing),
                in: RoundedRectangle(cornerRadius: 18, style: .continuous)
            )
        }
        .buttonStyle(.plain)
        .disabled(model.isSearchingNumbers || trimmedQuery.isEmpty)
        .opacity(model.isSearchingNumbers || !trimmedQuery.isEmpty ? 1 : 0.45)
    }

    private var resetButton: some View {
        Button(action: resetSearch) {
            Label("Reset", systemImage: "arrow.counterclockwise")
                .font(.body.weight(.semibold))
                .foregroundStyle(palette.tint)
                .frame(maxWidth: .infinity)
                .frame(height: 50)
                .background(.regularMaterial, in: RoundedRectangle(cornerRadius: 18, style: .continuous))
                .overlay {
                    RoundedRectangle(cornerRadius: 18, style: .continuous)
                        .strokeBorder(palette.tint.opacity(colorScheme == .dark ? 0.32 : 0.20), lineWidth: 1)
                }
        }
        .buttonStyle(.plain)
        .accessibilityLabel("Reset search")
    }

    private var statusBanner: some View {
        HStack(alignment: .top, spacing: 10) {
            Image(systemName: model.isSearchingNumbers ? "clock.arrow.circlepath" : "checkmark.shield.fill")
                .font(.footnote.weight(.semibold))
                .foregroundStyle(palette.tint)
                .padding(.top, 1)

            Text(model.numberSearchMessage ?? SpamBlockerModel.defaultNumberSearchMessage)
                .font(.footnote)
                .foregroundStyle(palette.secondaryText)
                .fixedSize(horizontal: false, vertical: true)

            Spacer(minLength: 0)
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 9)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(palette.tintSoft, in: RoundedRectangle(cornerRadius: 16, style: .continuous))
    }

    @ViewBuilder
    private var resultsPanel: some View {
        if model.isSearchingNumbers && model.numberSearchResults.isEmpty {
            SearchStateCard(
                title: "Searching…",
                subtitle: "Scanning the final on-device blocking feed used by the app and extension.",
                systemImage: "magnifyingglass.circle.fill",
                tint: palette.tint,
                showsProgress: true
            )
            .frame(minHeight: resultsMinHeight)
        } else if model.numberSearchResults.isEmpty {
            SearchStateCard(
                title: trimmedQuery.isEmpty ? "Search a number" : "No matches found",
                subtitle: emptyResultsDescription,
                systemImage: trimmedQuery.isEmpty ? "phone.circle.fill" : "xmark.circle.fill",
                tint: trimmedQuery.isEmpty ? palette.tint : palette.warning,
                showsProgress: false
            )
            .frame(minHeight: resultsMinHeight)
        } else {
            sectionedResultsList
        }
    }

    private var sectionedResultsList: some View {
        let personal = model.numberSearchResults.filter { $0.source == .personal || $0.source == .combined }
        let repo = model.numberSearchResults.filter { $0.source == .repo }

        return VStack(alignment: .leading, spacing: 14) {
            HStack(alignment: .center) {
                VStack(alignment: .leading, spacing: 4) {
                    Text("Results")
                        .font(.title3.weight(.bold))
                    Text("Matches are grouped by source for quick review.")
                        .font(.footnote)
                        .foregroundStyle(palette.secondaryText)
                }

                Spacer()

                Text("\(model.numberSearchResults.count)")
                    .font(.headline.weight(.bold))
                    .foregroundStyle(palette.tint)
                    .padding(.horizontal, 13)
                    .padding(.vertical, 8)
                    .background(palette.tintSoft, in: Capsule())
            }

            if !personal.isEmpty {
                resultsSection(
                    title: "My Personal List",
                    symbol: "person.fill",
                    tint: palette.tint,
                    results: personal,
                    allowsEditing: true
                )
            }

            if !repo.isEmpty {
                resultsSection(
                    title: "Synced Blocklist",
                    symbol: "arrow.triangle.2.circlepath",
                    tint: palette.tint,
                    results: repo,
                    allowsEditing: false
                )
            }
        }
    }

    private func resultsSection(
        title: String,
        symbol: String,
        tint: Color,
        results: [BlockedNumberSearchResult],
        allowsEditing: Bool
    ) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack(spacing: 8) {
                Image(systemName: symbol)
                    .font(.caption.weight(.bold))
                Text(title)
                    .font(.footnote.weight(.bold))
                    .textCase(.uppercase)
                    .tracking(0.4)
                Text("\(results.count)")
                    .font(.caption.weight(.bold))
                    .padding(.horizontal, 7)
                    .padding(.vertical, 3)
                    .background(tint.opacity(0.14), in: Capsule())
            }
            .foregroundStyle(tint)

            VStack(spacing: 10) {
                ForEach(results) { result in
                    if allowsEditing {
                        NumberSearchResultRow(
                            result: result,
                            onEditPersonal: {
                                if let entry = result.personalEntry {
                                    editingEntry = entry
                                }
                            },
                            onDeletePersonal: {
                                if let entry = result.personalEntry {
                                    deletingEntry = entry
                                }
                            }
                        )
                    } else {
                        NumberSearchResultRow(result: result, onEditPersonal: nil, onDeletePersonal: nil)
                    }
                }
            }
        }
    }

    private var resultsMinHeight: CGFloat {
        if verticalSizeClass == .compact { return 220 }
        if dynamicTypeSize.isAccessibilitySize { return 360 }
        return 420
    }

    private var emptyResultsDescription: String {
        if trimmedQuery.isEmpty {
            return "Enter digits or paste a formatted number to search the final blocking feed, including synced blocklists and personal entries."
        }
        return model.numberSearchMessage ?? "Try a different number or refresh your blocklists first."
    }

    private var contentTopPadding: CGFloat {
        verticalSizeClass == .compact ? 12 : 18
    }

    private var showsCenteredResultsPanel: Bool {
        model.numberSearchResults.isEmpty
    }

    private func performSearch() {
        guard !model.isSearchingNumbers, !trimmedQuery.isEmpty else { return }
        isSearchFieldFocused = false
        Task { await model.searchNumbers() }
    }

    private func resetSearch() {
        isSearchFieldFocused = false
        model.resetNumberSearch()
    }

    private func deleteSelectedPersonalEntry() {
        guard let entry = deletingEntry else { return }
        deletingEntry = nil

        Task { @MainActor in
            model.personalBlocklistStore.delete(ids: [entry.id])
            await model.processPersonalBlocklistChange()
        }
    }

    private var showsResetAction: Bool {
        !model.numberSearchQuery.isEmpty ||
        !model.numberSearchResults.isEmpty ||
        (model.numberSearchMessage != nil && model.numberSearchMessage != SpamBlockerModel.defaultNumberSearchMessage)
    }

    private var shouldShowStatusBanner: Bool {
        model.isSearchingNumbers
    }

    private var showsSearchSubtitle: Bool {
        verticalSizeClass != .compact || dynamicTypeSize.isAccessibilitySize
    }
}

// MARK: - SearchStateCard

private struct SearchStateCard: View {
    let title: String
    let subtitle: String
    let systemImage: String
    let tint: Color
    let showsProgress: Bool

    @Environment(\.colorScheme) private var colorScheme

    private var palette: AppPalette { AppPalette(colorScheme: colorScheme) }

    var body: some View {
        VStack(spacing: 16) {
            ZStack {
                Circle()
                    .fill(tint.opacity(colorScheme == .dark ? 0.18 : 0.12))
                    .frame(width: 92, height: 92)

                Image(systemName: systemImage)
                    .font(.system(size: 48, weight: .semibold))
                    .foregroundStyle(tint)
            }
            .overlay(alignment: .bottomTrailing) {
                if showsProgress {
                    ProgressView()
                        .tint(tint)
                        .padding(8)
                        .background(.regularMaterial, in: Circle())
                        .offset(x: 4, y: 4)
                }
            }

            VStack(spacing: 8) {
                Text(title)
                    .font(.title2.weight(.bold))
                    .multilineTextAlignment(.center)
                Text(subtitle)
                    .font(.body)
                    .foregroundStyle(palette.secondaryText)
                    .multilineTextAlignment(.center)
                    .fixedSize(horizontal: false, vertical: true)
            }
            .frame(maxWidth: 420)
        }
        .padding(.horizontal, 24)
        .padding(.vertical, 32)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(.ultraThinMaterial, in: RoundedRectangle(cornerRadius: 30, style: .continuous))
        .overlay {
            RoundedRectangle(cornerRadius: 30, style: .continuous)
                .strokeBorder(.white.opacity(colorScheme == .dark ? 0.14 : 0.36), lineWidth: 1)
        }
    }
}

// MARK: - NumberSearchResultRow

private struct NumberSearchResultRow: View {
    let result: BlockedNumberSearchResult
    var onEditPersonal: (() -> Void)?
    var onDeletePersonal: (() -> Void)?

    @Environment(\.colorScheme) private var colorScheme

    private var palette: AppPalette { AppPalette(colorScheme: colorScheme) }

    var body: some View {
        HStack(alignment: .top, spacing: 12) {
            if showsSourceIcon {
                sourceIcon
            }

            VStack(alignment: .leading, spacing: 10) {
                HStack(alignment: .firstTextBaseline, spacing: 10) {
                    VStack(alignment: .leading, spacing: 3) {
                        Text(result.record.phoneNumberE164)
                            .font(.headline.weight(.bold))
                            .textSelection(.enabled)

                        if !trimmedDisplayName.isEmpty {
                            Text(trimmedDisplayName)
                                .font(.subheadline)
                                .foregroundStyle(palette.secondaryText)
                                .lineLimit(2)
                                .fixedSize(horizontal: false, vertical: true)
                        }
                    }

                    Spacer(minLength: 8)
                    MatchChip(label: result.matchKind.rawValue.capitalized, tint: matchColor)
                    if showsPersonalActions {
                        personalActionsMenu
                    }
                }

                ViewThatFits(in: .horizontal) {
                    HStack(spacing: 8) {
                        InfoChip(label: result.record.category, tint: sourceColor)
                        NeutralInfoChip(label: result.record.confidence.capitalized)
                        if result.source == .combined {
                            InfoChip(label: "Personal + Repo", tint: sourceColor)
                        }
                        Spacer(minLength: 0)
                    }

                    VStack(alignment: .leading, spacing: 8) {
                        InfoChip(label: result.record.category, tint: sourceColor)
                        NeutralInfoChip(label: result.record.confidence.capitalized)
                        if result.source == .combined {
                            InfoChip(label: "Personal + Repo", tint: sourceColor)
                        }
                    }
                }

                if let detailSummary {
                    Text(detailSummary)
                        .font(.subheadline)
                        .foregroundStyle(palette.secondaryText)
                        .lineLimit(3)
                        .fixedSize(horizontal: false, vertical: true)
                }

            }
        }
        .padding(14)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(.ultraThinMaterial, in: RoundedRectangle(cornerRadius: 24, style: .continuous))
        .overlay {
            RoundedRectangle(cornerRadius: 24, style: .continuous)
                .strokeBorder(.white.opacity(colorScheme == .dark ? 0.14 : 0.34), lineWidth: 1)
        }
        .shadow(color: Color.black.opacity(colorScheme == .dark ? 0.16 : 0.05), radius: 14, x: 0, y: 8)
        .accessibilityElement(children: showsPersonalActions ? .contain : .combine)
    }

    private var sourceIcon: some View {
        ZStack {
            Circle()
                .fill(sourceColor.opacity(colorScheme == .dark ? 0.20 : 0.12))
            Image(systemName: sourceSymbol)
                .font(.system(size: 16, weight: .bold))
                .foregroundStyle(sourceColor)
        }
        .frame(width: 38, height: 38)
    }

    private var personalActionsMenu: some View {
        Menu {
            if let onEditPersonal {
                Button("Edit", systemImage: "pencil", action: onEditPersonal)
            }
            if let onDeletePersonal {
                Button("Delete", systemImage: "trash", role: .destructive, action: onDeletePersonal)
            }
        } label: {
            Image(systemName: "ellipsis.circle")
                .font(.title3.weight(.semibold))
                .foregroundStyle(palette.tint)
                .frame(width: 30, height: 30)
                .background(.regularMaterial, in: Circle())
        }
        .menuStyle(.button)
        .buttonStyle(.plain)
        .accessibilityLabel("Personal entry actions")
        .fixedSize()
    }

    private var trimmedDisplayName: String {
        result.record.displayName.trimmingCharacters(in: .whitespacesAndNewlines)
    }

    private var detailSummary: String? {
        var details: [String] = []
        var seen = Set<String>()
        let excluded = Set([trimmedDisplayName.lowercased(), result.record.phoneNumberE164.lowercased()])

        func appendUnique(_ value: String) {
            let trimmed = value.trimmingCharacters(in: .whitespacesAndNewlines)
            let normalized = trimmed.lowercased()
            guard !trimmed.isEmpty, !excluded.contains(normalized), seen.insert(normalized).inserted else { return }
            details.append(trimmed)
        }

        if !result.record.aliases.isEmpty {
            appendUnique("Aliases: \(result.record.aliases.joined(separator: ", "))")
        }
        if !result.record.tags.isEmpty {
            appendUnique("Tags: \(result.record.tags.joined(separator: ", "))")
        }
        let personalNotes: String = {
            if let entry = result.personalEntry, !entry.notes.isEmpty {
                return entry.notes
            }
            return result.record.notes
        }()
        appendUnique(personalNotes)

        return details.isEmpty ? nil : details.joined(separator: " • ")
    }

    private var sourceSymbol: String {
        switch result.source {
        case .personal: return "person.fill"
        case .combined: return "person.2.fill"
        case .repo: return "shield.lefthalf.filled"
        }
    }

    private var sourceColor: Color {
        switch result.source {
        case .personal, .combined: return palette.tint
        case .repo: return palette.warning
        }
    }

    private var matchColor: Color {
        switch result.matchKind {
        case .exact: return palette.success
        case .suffix: return palette.tint
        case .contains: return palette.warning
        }
    }

    private var showsSourceIcon: Bool {
        !showsPersonalActions
    }

    private var showsPersonalActions: Bool {
        onEditPersonal != nil || onDeletePersonal != nil
    }
}

// MARK: - Chips

private struct MatchChip: View {
    let label: String
    let tint: Color

    var body: some View {
        Text(label)
            .font(.caption.weight(.bold))
            .foregroundStyle(tint)
            .padding(.horizontal, 10)
            .padding(.vertical, 6)
            .background(tint.opacity(0.13), in: Capsule())
            .fixedSize()
    }
}

private struct InfoChip: View {
    let label: String
    let tint: Color

    var body: some View {
        Text(label)
            .font(.caption.weight(.semibold))
            .foregroundStyle(tint)
            .padding(.horizontal, 10)
            .padding(.vertical, 6)
            .background(tint.opacity(0.12), in: Capsule())
            .fixedSize()
    }
}

private struct NeutralInfoChip: View {
    let label: String

    var body: some View {
        Text(label)
            .font(.caption.weight(.semibold))
            .foregroundStyle(.secondary)
            .padding(.horizontal, 10)
            .padding(.vertical, 6)
            .background(.regularMaterial, in: Capsule())
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
