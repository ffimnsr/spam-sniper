import SwiftUI

struct AboutView: View {
    var body: some View {
        List {
            Section("App") {
                infoRow(title: "Name", value: "SpamSniper")
                infoRow(title: "Author", value: "Edward Fitz Abucay")
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
                Text("Review the upstream ObjectivePGP LICENSE.txt and LICENSE-third-party.txt files for the full terms.")
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
}

#Preview {
    NavigationStack {
        AboutView()
    }
}
