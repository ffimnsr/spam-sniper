import SwiftUI

struct BlocklistSelectionView: View {
    @Bindable var model: SpamBlockerModel
    @Environment(\.colorScheme) private var colorScheme

    private var palette: AppPalette { AppPalette(colorScheme: colorScheme) }

    var body: some View {
        List {
            Section {
                VStack(alignment: .leading, spacing: 6) {
                    Text("Selected Blocklists")
                        .font(.caption.weight(.bold))
                        .foregroundStyle(.secondary)
                    Text(model.selectedBlocklistTitle)
                        .font(.headline)
                    Text("Selections are remembered for the active repository.")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                    if !model.selectedBlocklistCountry.isEmpty {
                        Text(model.selectedBlocklistCountry)
                            .font(.subheadline)
                            .foregroundStyle(.secondary)
                    }
                    Text(model.selectedBlocklistDescription)
                        .font(.footnote)
                        .foregroundStyle(.secondary)
                }
                .padding(.vertical, 4)
            }

            ForEach(model.availableBlocklists) { country in
                Section(country.name + " (\(country.code))") {
                    ForEach(country.blocklists) { entry in
                        Button {
                            Task {
                                await model.toggleBlocklistSelection(entry)
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

                                Image(
                                    systemName: model.selectedBlocklistIDs.contains(entry.id)
                                    ? "checkmark.circle.fill"
                                    : "circle"
                                )
                                .foregroundStyle(
                                    model.selectedBlocklistIDs.contains(entry.id)
                                    ? palette.tint
                                    : palette.secondaryText
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
        .navigationTitle("Choose Blocklists")
        .overlay {
            if model.isRefreshingBlocklists {
                ProgressView("Updating blocklist")
                    .padding(20)
                    .background(.thinMaterial, in: RoundedRectangle(cornerRadius: 18, style: .continuous))
            }
        }
    }
}

#Preview {
    NavigationStack {
        BlocklistSelectionView(model: SpamBlockerModel())
    }
}
