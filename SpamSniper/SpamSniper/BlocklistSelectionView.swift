import SwiftUI

struct BlocklistSelectionView: View {
    @Bindable var model: SpamBlockerModel

    var body: some View {
        List {
            Section {
                VStack(alignment: .leading, spacing: 6) {
                    Text("Active Blocklist")
                        .font(.caption.weight(.bold))
                        .foregroundStyle(.secondary)
                    Text(model.selectedBlocklistTitle)
                        .font(.headline)
                    Text(model.selectedBlocklistCountry)
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                    Text(model.selectedBlocklistDescription)
                        .font(.footnote)
                        .foregroundStyle(.secondary)
                }
                .padding(.vertical, 4)
            }

            ForEach(model.availableBlocklists) { country in
                Section(country.name + " (\(country.code))") {
                    ForEach(country.blocklists, id: \.id) { entry in
                        Button {
                            Task {
                                await model.selectBlocklist(catalogEntry(for: entry, country: country))
                            }
                        } label: {
                            HStack(alignment: .top, spacing: 12) {
                                VStack(alignment: .leading, spacing: 4) {
                                    Text(entry.title)
                                        .font(.headline)
                                        .foregroundStyle(.primary)
                                    Text(entry.description)
                                        .font(.footnote)
                                        .foregroundStyle(.secondary)
                                    Text(entry.source)
                                        .font(.caption)
                                        .foregroundStyle(.secondary)
                                }

                                Spacer()

                                Image(systemName: model.selectedBlocklistID == entry.id ? "checkmark.circle.fill" : "circle")
                                    .foregroundStyle(
                                        model.selectedBlocklistID == entry.id
                                            ? Color(red: 0.04, green: 0.46, blue: 0.54)
                                            : .secondary
                                    )
                            }
                            .padding(.vertical, 6)
                        }
                        .buttonStyle(.plain)
                        .disabled(model.isRefreshingBlocklists)
                    }
                }
            }
        }
        .navigationTitle("Choose Blocklist")
        .overlay {
            if model.isRefreshingBlocklists {
                ProgressView("Updating blocklist")
                    .padding(20)
                    .background(.thinMaterial, in: RoundedRectangle(cornerRadius: 18, style: .continuous))
            }
        }
    }

    private func catalogEntry(
        for entry: BlocklistRepositoryEntry,
        country: BlocklistRepositoryCountry
    ) -> BlocklistCatalogEntry {
        let documentURL = BlocklistSyncService.repositoryURL?
            .deletingLastPathComponent()
            .appending(path: entry.path)

        let signatureURL: URL? = {
            let value = entry.signatureURL ?? country.signatureURL
            guard let value else {
                return nil
            }

            if let absoluteURL = URL(string: value), absoluteURL.scheme != nil {
                return absoluteURL
            }

            return BlocklistSyncService.repositoryURL?
                .deletingLastPathComponent()
                .appending(path: value)
        }()

        return BlocklistCatalogEntry(
            id: entry.id,
            countryCode: country.code,
            countryName: country.name,
            title: entry.title,
            description: entry.description,
            source: entry.source,
            documentURL: documentURL,
            seedResource: entry.seedResource,
            signatureURL: signatureURL
        )
    }
}

#Preview {
    NavigationStack {
        BlocklistSelectionView(model: SpamBlockerModel())
    }
}
