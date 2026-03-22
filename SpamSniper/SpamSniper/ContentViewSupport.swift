import ContactsUI
import SwiftUI

extension ContentView {
    var heroCard: some View {
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
            LinearGradient(colors: theme.heroBackground, startPoint: .topLeading, endPoint: .bottomTrailing),
            in: RoundedRectangle(cornerRadius: 28, style: .continuous)
        )
    }

    var controlsCard: some View {
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
            Button(action: handleContactsAction) {
                HStack {
                    Text(contactsActionTitle)
                    Spacer()
                    Image(systemName: contactsActionSymbol)
                }
                .font(.subheadline.weight(.semibold))
                .foregroundStyle(theme.tint)
                .padding(.horizontal, 16)
                .padding(.vertical, 14)
                .background(theme.tintSoft, in: RoundedRectangle(cornerRadius: 16, style: .continuous))
            }
            .buttonStyle(.plain)
            .modifier(ContactAccessPickerModifier(isPresented: $isContactAccessPickerPresented) {
                Task {
                    await model.refresh()
                }
            })
            Button {
                Task {
                    await model.openSettings()
                }
            } label: {
                HStack {
                    Text(callBlockingSettingsTitle)
                    Spacer()
                    Image(systemName: "arrow.up.right")
                }
                .font(.headline)
                .foregroundStyle(.white)
                .padding(.horizontal, 18)
                .padding(.vertical, 16)
                .background(
                    LinearGradient(colors: theme.warningButton, startPoint: .leading, endPoint: .trailing),
                    in: RoundedRectangle(cornerRadius: 18, style: .continuous)
                )
            }
            .buttonStyle(.plain)
        }
        .cardStyle()
    }

    var stickyProtectionBar: some View {
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
                        Text(protectionButtonTitle)
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
                        LinearGradient(colors: buttonGradientColors, startPoint: .leading, endPoint: .trailing),
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

    var statsRow: some View {
        HStack(spacing: 14) {
            statCard(title: "Blocklist", value: "\(model.blockedNumberCount)", detail: "Predefined numbers")
            statCard(title: "Extension", value: statusShortValue, detail: "Settings status")
        }
    }

    var detailsCard: some View {
        VStack(alignment: .leading, spacing: 22) {
            Text("Blocklist Intelligence")
                .font(.title3.weight(.semibold))
            VStack(alignment: .leading, spacing: 18) {
                VStack(alignment: .leading, spacing: 8) {
                    Text("Selected Blocklists")
                        .font(.caption.weight(.bold))
                        .foregroundStyle(.secondary)
                    Text(model.selectedBlocklistTitle)
                        .font(.subheadline.weight(.semibold))
                    if !model.selectedBlocklistCountry.isEmpty {
                        Text(model.selectedBlocklistCountry)
                            .font(.footnote)
                            .foregroundStyle(.secondary)
                    }
                    Text(model.selectedBlocklistDescription)
                        .font(.footnote)
                        .foregroundStyle(.secondary)
                }
                NavigationLink {
                    BlocklistSelectionView(model: model)
                } label: {
                    HStack {
                        Text("Choose Blocklists")
                        Spacer()
                        Image(systemName: "chevron.right")
                    }
                    .font(.subheadline.weight(.semibold))
                    .foregroundStyle(theme.tint)
                    .padding(.horizontal, 16)
                    .padding(.vertical, 14)
                    .background(theme.tintSoft, in: RoundedRectangle(cornerRadius: 16, style: .continuous))
                }
                .buttonStyle(.plain)
            }
            detailPanel {
                VStack(alignment: .leading, spacing: 14) {
                    sourceSummary
                    Divider()
                        .overlay(Color(uiColor: .separator).opacity(0.35))
                    signatureSummary
                }
            }
            VStack(alignment: .leading, spacing: 14) {
                infoRow(
                    symbol: "person.crop.circle.badge.checkmark",
                    title: "Contacts-aware filtering",
                    detail: contactsFilteringDescription
                )
                infoRow(
                    symbol: "list.bullet.rectangle.portrait",
                    title: "Repo-driven blocklists",
                    detail: repoDrivenDescription
                )
                infoRow(
                    symbol: "phone.arrow.up.right",
                    title: "System-level call blocking",
                    detail: "The Call Directory extension hands those numbers to iOS so matching calls can be blocked by the system."
                )
                infoRow(
                    symbol: "arrow.triangle.2.circlepath",
                    title: "Daily sync-ready",
                    detail: dailySyncDescription
                )
            }
        }
        .cardStyle()
    }

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

    var aboutEntryCard: some View {
        NavigationLink {
            AboutView()
        } label: {
            HStack(alignment: .center, spacing: 14) {
                Image(systemName: "info.circle.fill")
                    .font(.title3.weight(.semibold))
                    .foregroundStyle(theme.tint)
                    .frame(width: 42, height: 42)
                    .background(theme.tintSoft, in: RoundedRectangle(cornerRadius: 14, style: .continuous))
                VStack(alignment: .leading, spacing: 4) {
                    Text("About SpamSniper")
                        .font(.headline)
                        .foregroundStyle(.primary)
                    Text("App details, license, and third-party license information.")
                        .font(.footnote)
                        .foregroundStyle(.secondary)
                }
                Spacer()
                Image(systemName: "chevron.right")
                    .font(.footnote.weight(.bold))
                    .foregroundStyle(.secondary)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(18)
            .background(theme.secondarySurface, in: RoundedRectangle(cornerRadius: 20, style: .continuous))
            .overlay(
                RoundedRectangle(cornerRadius: 20, style: .continuous)
                    .stroke(Color(uiColor: .separator).opacity(0.25), lineWidth: 1)
            )
        }
        .buttonStyle(.plain)
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
                .foregroundStyle(theme.tint)
                .frame(width: 28, height: 28)
                .background(theme.tintSoft, in: RoundedRectangle(cornerRadius: 10, style: .continuous))
            VStack(alignment: .leading, spacing: 6) {
                Text(title)
                    .font(.headline)
                Text(detail)
                    .font(.footnote)
                    .foregroundStyle(.secondary)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(16)
        .background(theme.secondarySurface, in: RoundedRectangle(cornerRadius: 18, style: .continuous))
    }

    func setupRow(symbol: String, title: String, detail: String) -> some View {
        HStack(alignment: .top, spacing: 14) {
            Image(systemName: symbol)
                .font(.headline)
                .foregroundStyle(theme.warning)
                .frame(width: 24)
            VStack(alignment: .leading, spacing: 4) {
                Text(title)
                    .font(.headline)
                Text(detail)
                    .font(.footnote)
                    .foregroundStyle(.secondary)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(16)
        .background(theme.secondarySurface, in: RoundedRectangle(cornerRadius: 18, style: .continuous))
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
        LinearGradient(colors: theme.pageBackground, startPoint: .top, endPoint: .bottom)
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

    var callBlockingSettingsTitle: String {
        model.extensionStatus == .enabled ? "Manage Call Blocking Settings" : "Open Call Blocking Settings"
    }

    var protectionButtonTitle: String {
        model.isBlockingEnabled ? "Disable SpamSniper Protection" : "Enable SpamSniper Protection"
    }

    var stickyStatusDescription: String {
        if model.isBusy {
            return "Updating protection settings."
        }

        switch model.extensionStatus {
        case .enabled:
            return "Calls matching any synced blocklist can be blocked by iOS."
        case .disabled:
            return "Turn on the Call Blocking extension in Settings for full protection."
        case .unknown:
            return "Checking call blocking status."
        case .unavailableOnSimulator:
            return "Simulator can preview the UI, but call blocking must be tested on a real iPhone."
        }
    }

    var buttonGradientColors: [Color] {
        model.isBlockingEnabled ? theme.primaryButton : theme.neutralButton
    }

    var signatureStatusColor: Color {
        switch model.blocklistSignatureStatus {
        case "Good":
            return .green
        case "Checking":
            return .secondary
        default:
            return theme.warning
        }
    }

    var signatureStatusBackground: Color {
        switch model.blocklistSignatureStatus {
        case "Good":
            return Color.green.opacity(colorScheme == .dark ? 0.24 : 0.12)
        case "Checking":
            return Color.secondary.opacity(0.14)
        default:
            return theme.warning.opacity(colorScheme == .dark ? 0.22 : 0.12)
        }
    }

    var sourceSummary: some View {
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
    }

    var signatureSummary: some View {
        HStack(alignment: .center, spacing: 14) {
            VStack(alignment: .leading, spacing: 6) {
                Text("Signature")
                    .font(.caption.weight(.bold))
                    .foregroundStyle(.secondary)
                Text("Blocklist signature availability")
                    .font(.footnote)
                    .foregroundStyle(.secondary)
            }
            Spacer(minLength: 16)
            Text(model.blocklistSignatureStatus)
                .font(.caption.weight(.bold))
                .foregroundStyle(signatureStatusColor)
                .padding(.horizontal, 12)
                .padding(.vertical, 8)
                .background(signatureStatusBackground, in: Capsule())
        }
    }

    func detailPanel<Content: View>(@ViewBuilder content: () -> Content) -> some View {
        content()
            .padding(18)
            .background(theme.secondarySurface, in: RoundedRectangle(cornerRadius: 20, style: .continuous))
    }

    var contactsActionTitle: String {
        switch model.contactsPermissionState {
        case .notDetermined:
            return "Allow Contacts Protection"
        case .authorized, .limited:
            return "Manage Shared Contacts"
        case .denied, .restricted:
            return "Open Contacts Settings"
        }
    }

    var contactsActionSymbol: String {
        switch model.contactsPermissionState {
        case .notDetermined:
            return "person.crop.circle.badge.plus"
        case .authorized, .limited:
            return "person.crop.circle.badge.checkmark"
        case .denied, .restricted:
            return "arrow.up.right"
        }
    }

    func handleContactsAction() {
        switch model.contactsPermissionState {
        case .notDetermined:
            Task {
                await model.requestContactsAccess()
            }
        case .authorized, .limited:
            if #available(iOS 18.0, *) {
                isContactAccessPickerPresented = true
            } else {
                model.openAppSettings()
            }
        case .denied, .restricted:
            model.openAppSettings()
        }
    }

    var buttonAccentColor: Color {
        model.isBlockingEnabled ? theme.tint : theme.neutralAccent
    }

    var theme: ThemePalette {
        ThemePalette(colorScheme: colorScheme)
    }

    var contactsFilteringDescription: String {
        "SpamSniper asks for Contacts access only to avoid blocking phone numbers that already exist in your address book."
    }

    var repoDrivenDescription: String {
        """
        SpamSniper reads a repo index, lets you choose country-specific lists,
        and imports their JSON entries into the shared SQLite database.
        """
    }

    var dailySyncDescription: String {
        """
        The app refreshes blocklist data on a daily cadence while launching or returning \
        to the foreground, fetching the repo index first so your selected country lists stay current.
        """
    }
}
