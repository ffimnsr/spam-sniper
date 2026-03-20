import SwiftUI

struct ContentView: View {
    @State private var model = SpamBlockerModel()
    @Environment(\.scenePhase) private var scenePhase

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 20) {
                    heroCard
                    controlsCard
                    statsRow
                    detailsCard

                    if let errorMessage = model.errorMessage {
                        errorCard(message: errorMessage)
                    }
                }
                .padding(20)
                .padding(.bottom, 104)
            }
            .background(backgroundGradient)
            .navigationBarTitleDisplayMode(.inline)
            .safeAreaInset(edge: .bottom) {
                stickyProtectionBar
            }
            .task {
                await model.refresh()
            }
            .onChange(of: scenePhase) { _, newPhase in
                guard newPhase == .active else { return }

                Task {
                    await model.refresh()
                }
            }
        }
    }

    private var heroCard: some View {
        VStack(alignment: .leading, spacing: 18) {
            HStack(alignment: .top) {
                VStack(alignment: .leading, spacing: 10) {
                    Text("SpamSniper")
                        .font(.system(size: 34, weight: .black, design: .rounded))
                        .foregroundStyle(.white)

                    Text("A focused call blocker that keeps known spam numbers out of your way.")
                        .font(.subheadline)
                        .foregroundStyle(.white.opacity(0.82))
                }

                Spacer()

                Image(systemName: "shield.lefthalf.filled.badge.checkmark")
                    .font(.system(size: 34, weight: .bold))
                    .foregroundStyle(.white)
                    .padding(14)
                    .background(.white.opacity(0.14), in: RoundedRectangle(cornerRadius: 18, style: .continuous))
            }

            HStack(spacing: 12) {
                statusPill(title: model.isBlockingEnabled ? "Blocking On" : "Blocking Off")
                statusPill(title: statusTitle)
            }

            Text(model.extensionStatus.message)
                .font(.footnote)
                .foregroundStyle(.white.opacity(0.8))
        }
        .padding(24)
        .background(
            LinearGradient(
                colors: [
                    Color(red: 0.06, green: 0.14, blue: 0.34),
                    Color(red: 0.04, green: 0.44, blue: 0.55)
                ],
                startPoint: .topLeading,
                endPoint: .bottomTrailing
            ),
            in: RoundedRectangle(cornerRadius: 28, style: .continuous)
        )
    }

    private var controlsCard: some View {
        VStack(alignment: .leading, spacing: 18) {
            HStack {
                Text("Setup & Safety")
                    .font(.title3.weight(.semibold))
                Spacer()
                Circle()
                    .fill(model.isBlockingEnabled ? Color.green : Color.gray.opacity(0.35))
                    .frame(width: 10, height: 10)
            }

            setupRow(
                symbol: "phone.connection.fill",
                title: "Protection switch stays pinned",
                detail: "Use the bottom bar at any time to enable or disable SpamSniper without losing your place."
            )

            VStack(alignment: .leading, spacing: 6) {
                Text("Contacts Safety")
                    .font(.caption.weight(.bold))
                    .foregroundStyle(.secondary)
                Text(model.contactsStatusDescription)
                    .font(.footnote)
                    .foregroundStyle(.secondary)
            }

            if model.contactsPermissionState == .notDetermined {
                Button {
                    Task {
                        await model.requestContactsAccess()
                    }
                } label: {
                    HStack {
                        Text("Allow Contacts Protection")
                        Spacer()
                        Image(systemName: "person.crop.circle.badge.plus")
                    }
                    .font(.subheadline.weight(.semibold))
                    .foregroundStyle(Color(red: 0.04, green: 0.46, blue: 0.54))
                    .padding(.horizontal, 16)
                    .padding(.vertical, 14)
                    .background(
                        Color(red: 0.04, green: 0.46, blue: 0.54).opacity(0.08),
                        in: RoundedRectangle(cornerRadius: 16, style: .continuous)
                    )
                }
                .buttonStyle(.plain)
            }

            if model.extensionStatus != .enabled {
                Button {
                    Task {
                        await model.openSettings()
                    }
                } label: {
                    HStack {
                        Text("Open Call Blocking Settings")
                        Spacer()
                        Image(systemName: "arrow.up.right")
                    }
                    .font(.headline)
                    .foregroundStyle(.white)
                    .padding(.horizontal, 18)
                    .padding(.vertical, 16)
                    .background(
                        LinearGradient(
                            colors: [
                                Color(red: 0.98, green: 0.45, blue: 0.19),
                                Color(red: 0.84, green: 0.24, blue: 0.19)
                            ],
                            startPoint: .leading,
                            endPoint: .trailing
                        ),
                        in: RoundedRectangle(cornerRadius: 18, style: .continuous)
                    )
                }
                .buttonStyle(.plain)
            }
        }
        .cardStyle()
    }

    private var stickyProtectionBar: some View {
        VStack(spacing: 0) {
            Divider()
                .opacity(0.2)

            VStack(alignment: .leading, spacing: 12) {
                Text(stickyStatusDescription)
                    .font(.footnote)
                    .foregroundStyle(.secondary)
                    .lineLimit(2)

                Button {
                    Task {
                        await model.setBlockingEnabled(!model.isBlockingEnabled)
                    }
                } label: {
                    HStack(spacing: 12) {
                        Image(systemName: model.isBlockingEnabled ? "shield.fill" : "shield.slash.fill")
                            .font(.headline)

                        Text(model.isBlockingEnabled ? "Disable SpamSniper Protection" : "Enable SpamSniper Protection")
                            .font(.headline.weight(.semibold))

                        Spacer()

                        Circle()
                            .fill(.white.opacity(0.92))
                            .frame(width: 28, height: 28)
                            .overlay(
                                Image(systemName: model.isBlockingEnabled ? "checkmark" : "power")
                                    .font(.caption.weight(.bold))
                                    .foregroundStyle(buttonAccentColor)
                            )
                    }
                    .foregroundStyle(.white)
                    .padding(.horizontal, 18)
                    .padding(.vertical, 18)
                    .frame(maxWidth: .infinity)
                    .background(
                        LinearGradient(
                            colors: buttonGradientColors,
                            startPoint: .leading,
                            endPoint: .trailing
                        ),
                        in: RoundedRectangle(cornerRadius: 22, style: .continuous)
                    )
                }
                .buttonStyle(.plain)
                .disabled(model.isBusy)
                .opacity(model.isBusy ? 0.7 : 1)
            }
            .padding(.horizontal, 20)
            .padding(.top, 14)
            .padding(.bottom, 18)
            .background(.ultraThinMaterial)
        }
    }

    private var statsRow: some View {
        HStack(spacing: 14) {
            statCard(
                title: "Blocklist",
                value: "\(model.blockedNumberCount)",
                detail: "Predefined numbers"
            )

            statCard(
                title: "Extension",
                value: statusShortValue,
                detail: "Settings status"
            )
        }
    }

    private var detailsCard: some View {
        VStack(alignment: .leading, spacing: 16) {
            Text("Blocklist Intelligence")
                .font(.title3.weight(.semibold))

            VStack(alignment: .leading, spacing: 8) {
                Text("Selected Blocklist")
                    .font(.caption.weight(.bold))
                    .foregroundStyle(.secondary)
                Text(model.selectedBlocklistTitle)
                    .font(.subheadline.weight(.semibold))
                Text(model.selectedBlocklistCountry)
                    .font(.footnote)
                    .foregroundStyle(.secondary)
                Text(model.selectedBlocklistDescription)
                    .font(.footnote)
                    .foregroundStyle(.secondary)
            }

            NavigationLink {
                BlocklistSelectionView(model: model)
            } label: {
                HStack {
                    Text("Choose Blocklist")
                    Spacer()
                    Image(systemName: "chevron.right")
                }
                .font(.subheadline.weight(.semibold))
                .foregroundStyle(Color(red: 0.04, green: 0.46, blue: 0.54))
                .padding(.horizontal, 16)
                .padding(.vertical, 14)
                .background(
                    Color(red: 0.04, green: 0.46, blue: 0.54).opacity(0.08),
                    in: RoundedRectangle(cornerRadius: 16, style: .continuous)
                )
            }
            .buttonStyle(.plain)

            VStack(alignment: .leading, spacing: 8) {
                Text("Source")
                    .font(.caption.weight(.bold))
                    .foregroundStyle(.secondary)
                Text(model.blocklistSource)
                    .font(.subheadline.weight(.semibold))
                Text("Last synced \(model.lastSyncDescription).")
                    .font(.footnote)
                    .foregroundStyle(.secondary)
            }

            VStack(alignment: .leading, spacing: 8) {
                Text("Signature")
                    .font(.caption.weight(.bold))
                    .foregroundStyle(.secondary)
                Text(model.blocklistSignatureLocation)
                    .font(.footnote.monospaced())
                    .textSelection(.enabled)
            }

            if !model.sampleEntries.isEmpty {
                VStack(alignment: .leading, spacing: 12) {
                    Text("Sample Entries")
                        .font(.headline)

                    ForEach(model.sampleEntries) { entry in
                        VStack(alignment: .leading, spacing: 6) {
                            HStack {
                                Text(entry.displayName)
                                    .font(.subheadline.weight(.semibold))
                                Spacer()
                                Text(entry.confidence.uppercased())
                                    .font(.caption2.weight(.bold))
                                    .foregroundStyle(Color(red: 0.84, green: 0.24, blue: 0.19))
                            }

                            Text(entry.phoneNumberE164)
                                .font(.caption.monospaced())
                                .foregroundStyle(.secondary)

                            Text("\(entry.category.capitalized) • \(entry.aliases.joined(separator: ", "))")
                                .font(.footnote)
                                .foregroundStyle(.secondary)
                        }
                        .padding(14)
                        .background(Color.black.opacity(0.03), in: RoundedRectangle(cornerRadius: 16, style: .continuous))
                    }
                }
            }

            infoRow(
                symbol: "person.crop.circle.badge.checkmark",
                title: "Contacts-aware filtering",
                detail: "SpamSniper asks for Contacts access only to avoid blocking phone numbers that already exist in your address book."
            )

            infoRow(
                symbol: "list.bullet.rectangle.portrait",
                title: "Repo-driven blocklists",
                detail: "SpamSniper reads a repo index, lets you choose a country-specific list, and imports that JSON blocklist into the shared SQLite database."
            )

            infoRow(
                symbol: "phone.arrow.up.right",
                title: "System-level call blocking",
                detail: "The Call Directory extension hands those numbers to iOS so matching calls can be blocked by the system."
            )

            infoRow(
                symbol: "arrow.triangle.2.circlepath",
                title: "Daily sync-ready",
                detail: """
                The app refreshes blocklist data on a daily cadence while launching or returning \
                to the foreground, fetching the repo index first so your selected country list stays current.
                """
            )
        }
        .cardStyle()
    }
}

private extension View {
    func cardStyle() -> some View {
        self
            .padding(20)
            .background(.white, in: RoundedRectangle(cornerRadius: 24, style: .continuous))
            .overlay(
                RoundedRectangle(cornerRadius: 24, style: .continuous)
                    .stroke(Color.black.opacity(0.05), lineWidth: 1)
            )
            .shadow(color: Color.black.opacity(0.06), radius: 18, x: 0, y: 10)
    }
}

#Preview {
    ContentView()
}

private extension ContentView {
    func errorCard(message: String) -> some View {
        HStack(alignment: .top, spacing: 12) {
            Image(systemName: "exclamationmark.triangle.fill")
                .foregroundStyle(.orange)

            Text(message)
                .font(.footnote)
                .foregroundStyle(.primary)
        }
        .padding(18)
        .background(Color.orange.opacity(0.12), in: RoundedRectangle(cornerRadius: 20, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: 20, style: .continuous)
                .stroke(Color.orange.opacity(0.18), lineWidth: 1)
        )
    }

    func statCard(title: String, value: String, detail: String) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(title.uppercased())
                .font(.caption.weight(.bold))
                .foregroundStyle(.secondary)

            Text(value)
                .font(.system(size: 28, weight: .black, design: .rounded))
                .foregroundStyle(.primary)

            Text(detail)
                .font(.footnote)
                .foregroundStyle(.secondary)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .cardStyle()
    }

    func infoRow(symbol: String, title: String, detail: String) -> some View {
        HStack(alignment: .top, spacing: 14) {
            Image(systemName: symbol)
                .font(.headline)
                .foregroundStyle(Color(red: 0.04, green: 0.46, blue: 0.54))
                .frame(width: 24)

            VStack(alignment: .leading, spacing: 4) {
                Text(title)
                    .font(.headline)
                Text(detail)
                    .font(.footnote)
                    .foregroundStyle(.secondary)
            }
        }
    }

    func setupRow(symbol: String, title: String, detail: String) -> some View {
        HStack(alignment: .top, spacing: 14) {
            Image(systemName: symbol)
                .font(.headline)
                .foregroundStyle(Color(red: 0.84, green: 0.24, blue: 0.19))
                .frame(width: 24)

            VStack(alignment: .leading, spacing: 4) {
                Text(title)
                    .font(.headline)
                Text(detail)
                    .font(.footnote)
                    .foregroundStyle(.secondary)
            }
        }
        .padding(16)
        .background(Color.black.opacity(0.03), in: RoundedRectangle(cornerRadius: 18, style: .continuous))
    }

    func statusPill(title: String) -> some View {
        Text(title)
            .font(.caption.weight(.bold))
            .foregroundStyle(.white)
            .padding(.horizontal, 12)
            .padding(.vertical, 8)
            .background(.white.opacity(0.15), in: Capsule())
    }

    var backgroundGradient: some View {
        LinearGradient(
            colors: [
                Color(red: 0.95, green: 0.97, blue: 0.99),
                Color(red: 0.90, green: 0.95, blue: 0.96)
            ],
            startPoint: .top,
            endPoint: .bottom
        )
        .ignoresSafeArea()
    }

    var statusTitle: String {
        switch model.extensionStatus {
        case .enabled:
            return "Extension Ready"
        case .disabled:
            return "Needs Setup"
        case .unknown:
            return "Checking"
        case .unavailableOnSimulator:
            return "Simulator"
        }
    }

    var statusShortValue: String {
        switch model.extensionStatus {
        case .enabled:
            return "Ready"
        case .disabled:
            return "Off"
        case .unknown:
            return "..."
        case .unavailableOnSimulator:
            return "Sim"
        }
    }

    var bindingForToggle: Binding<Bool> {
        Binding(
            get: { model.isBlockingEnabled },
            set: { newValue in
                Task {
                    await model.setBlockingEnabled(newValue)
                }
            }
        )
    }

    var stickyStatusDescription: String {
        if model.isBusy {
            return "Updating protection settings."
        }

        switch model.extensionStatus {
        case .enabled:
            return "Calls matching the synced blocklist can be blocked by iOS."
        case .disabled:
            return "Turn on the Call Blocking extension in Settings for full protection."
        case .unknown:
            return "Checking call blocking status."
        case .unavailableOnSimulator:
            return "Simulator can preview the UI, but call blocking must be tested on a real iPhone."
        }
    }

    var buttonGradientColors: [Color] {
        if model.isBlockingEnabled {
            return [
                Color(red: 0.04, green: 0.46, blue: 0.54),
                Color(red: 0.07, green: 0.63, blue: 0.67)
            ]
        }

        return [
            Color(red: 0.34, green: 0.39, blue: 0.45),
            Color(red: 0.23, green: 0.27, blue: 0.33)
        ]
    }

    var buttonAccentColor: Color {
        model.isBlockingEnabled
            ? Color(red: 0.04, green: 0.46, blue: 0.54)
            : Color(red: 0.23, green: 0.27, blue: 0.33)
    }
}
