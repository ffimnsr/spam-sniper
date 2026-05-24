import SwiftUI

struct AboutView: View {
    var body: some View {
        List {
            Section("App") {
                infoRow(title: "Name", value: "SpamSniper")
                infoRow(title: "Version", value: Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String ?? "Unknown")
            }

            Section("How It Works") {
                detailRow(
                    title: "Contacts-aware filtering",
                    detail: "SpamSniper requests Contacts access only to avoid blocking phone numbers that are already in your address book."
                )
                detailRow(
                    title: "Repo-driven blocklists",
                    detail: "The app reads a repository index, lets you choose country-specific lists, remembers selections per repository, and syncs their verified JSON entries into the shared on-device database."
                )
                detailRow(
                    title: "Personal blocklist entries",
                    detail: "Numbers you add manually are merged into the same final blocking feed the Call Directory extension consumes, even when they are not present in a synced repository."
                )
                detailRow(
                    title: "How blocking data is composed",
                    detail: "SpamSniper keeps repository selections per source, combines synced repository numbers with your personal entries, collapses duplicates by phone number, excludes saved contacts only from repository sync imports, and keeps personal notes and tags available in search."
                )
                detailRow(
                    title: "System-level call blocking",
                    detail: "The Call Directory extension hands the final merged blocking feed to iOS so matching calls can be blocked by the system."
                )
                detailRow(
                    title: "Daily sync-ready",
                    detail: "SpamSniper refreshes blocklist data on a daily cadence while launching or returning to the foreground so your selected country lists stay current."
                )
                detailRow(
                    title: "Signature verification boundaries",
                    detail: "SpamSniper verifies repository metadata and downloaded blocklist files before import. Personal entries stay local to your devices and are not signature-verified content."
                )
            }

            Section("License") {
                Text("SpamSniper is distributed under the MIT License.")
                    .font(.body)
                Text("Copyright (c) 2026 Edward Fitz Abucay <29743013+ffimnsr@users.noreply.github.com>")
                    .font(.footnote)
                    .foregroundStyle(.secondary)
            }

            Section("Third-Party License") {
                Text("This app depends on ObjectivePGP by Marcin Krzyżanowski.")
                    .font(.body)
                Text("ObjectivePGP is licensed separately and is not covered by SpamSniper's MIT License.")
                    .font(.body)
                Text(
                    "Review the upstream ObjectivePGP LICENSE.txt and LICENSE-third-party.txt files for the full terms."
                )
                .font(.footnote)
                .foregroundStyle(.secondary)
            }
        }
        .navigationTitle("About")
        .navigationBarTitleDisplayMode(.inline)
    }

    private func infoRow(title: String, value: String) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(title)
                .font(.caption.weight(.bold))
                .foregroundStyle(.secondary)
            Text(value)
                .font(.body)
        }
        .padding(.vertical, 2)
    }

    private func detailRow(title: String, detail: String) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(title)
                .font(.body.weight(.semibold))
            Text(detail)
                .font(.footnote)
                .foregroundStyle(.secondary)
                .fixedSize(horizontal: false, vertical: true)
        }
        .padding(.vertical, 2)
    }
}

#Preview {
    NavigationStack {
        AboutView()
    }
}
