//
//  ContentView+Presentation.swift
//  SpamSniper
//

import SwiftUI

extension ContentView {
    var backgroundGradient: some View {
        ZStack {
            LinearGradient(colors: theme.pageBackground, startPoint: .topLeading, endPoint: .bottomTrailing)
            Circle()
                .fill(theme.ambientGlow.first ?? .clear)
                .frame(width: 280, height: 280)
                .blur(radius: 52)
                .offset(x: -150, y: -250)
            Circle()
                .fill(theme.ambientGlow.dropFirst().first ?? .clear)
                .frame(width: 260, height: 260)
                .blur(radius: 58)
                .offset(x: 180, y: 160)
        }
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
        model.extensionStatus == .enabled ? "Call Blocking" : "Call Blocking Setup"
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
            return model.protectionMode == .labelOnly
            ? "Repo entries are labeled by iOS, while personal entries continue blocking."
            : "Calls matching synced blocklists or your personal list can be blocked by iOS."
        case .disabled:
            return "Turn on the Call Blocking extension in Settings for full protection."
        case .unknown:
            return "Checking call blocking status."
        case .unavailableOnSimulator:
            return "Simulator can preview the UI, but call blocking must be tested on a real iPhone."
        }
    }

    var staleWarningTitle: String? {
        switch model.syncDiagnostics.health {
        case .healthy:
            return nil
        case .stale:
            return "Sync data is stale"
        case .neverSynced:
            return "No successful sync yet"
        }
    }

    var staleWarningDetail: String? {
        switch model.syncDiagnostics.health {
        case .healthy:
            return nil
        case .stale:
            if let syncDate = model.syncDiagnostics.lastSuccessfulSyncAt {
                return "The last successful sync was \(SpamBlockerModel.syncFormatter.localizedString(for: syncDate, relativeTo: Date())). Open Sync Diagnostics or run Sync Now."
            }
            return "Open Sync Diagnostics or run Sync Now."
        case .neverSynced:
            return "SpamSniper has not completed a successful sync on this device yet. Run Sync Now after setup."
        }
    }

    var buttonGradientColors: [Color] {
        model.isBlockingEnabled ? theme.primaryButton : theme.neutralButton
    }

    var signatureStatusColor: Color {
        switch model.blocklistSignatureStatus {
        case "Good":
            return theme.success
        case "Checking":
            return .secondary
        default:
            return theme.warning
        }
    }

    var signatureStatusBackground: Color {
        switch model.blocklistSignatureStatus {
        case "Good":
            return theme.success.opacity(colorScheme == .dark ? 0.22 : 0.12)
        case "Checking":
            return Color.secondary.opacity(0.14)
        default:
            return theme.warning.opacity(colorScheme == .dark ? 0.22 : 0.12)
        }
    }

    var sourceSummary: some View {
        HStack(alignment: .top, spacing: 12) {
            Image(systemName: "externaldrive.connected.to.line.below.fill")
                .font(.headline.weight(.bold))
                .foregroundStyle(theme.tint)
                .frame(width: 36, height: 36)
                .background(theme.tintSoft, in: RoundedRectangle(cornerRadius: 13, style: .continuous))
            VStack(alignment: .leading, spacing: 5) {
                Text("Source")
                    .font(.caption.weight(.black))
                    .foregroundStyle(.secondary)
                Text(model.blocklistSource)
                    .font(.subheadline.weight(.bold))
                    .foregroundStyle(.primary)
                    .lineLimit(2)
                Text("Last synced \(model.lastSyncDescription).")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
        }
    }

    var signatureSummary: some View {
        HStack(alignment: .center, spacing: 12) {
            Image(systemName: "signature")
                .font(.headline.weight(.bold))
                .foregroundStyle(signatureStatusColor)
                .frame(width: 36, height: 36)
                .background(signatureStatusBackground, in: RoundedRectangle(cornerRadius: 13, style: .continuous))
            VStack(alignment: .leading, spacing: 5) {
                Text("Signature")
                    .font(.caption.weight(.black))
                    .foregroundStyle(.secondary)
                Text("Blocklist trust verification")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
            Spacer(minLength: 12)
            Text(model.blocklistSignatureStatus)
                .font(.caption.weight(.black))
                .foregroundStyle(signatureStatusColor)
                .padding(.horizontal, 12)
                .padding(.vertical, 8)
                .background(signatureStatusBackground, in: Capsule())
        }
    }

    func detailPanel<Content: View>(@ViewBuilder content: () -> Content) -> some View {
        content()
            .panelStyle(cornerRadius: 24)
    }

    var contactsActionTitle: String {
        switch model.contactsPermissionState {
        case .notDetermined:
            return "Contacts Protection"
        case .limited:
            return "Shared Contacts"
        case .authorized:
            return "Contacts Settings"
        case .denied, .restricted:
            return "Contacts Settings"
        }
    }

    var contactsActionSymbol: String {
        switch model.contactsPermissionState {
        case .notDetermined:
            return "person.crop.circle.badge.plus"
        case .limited:
            return "person.crop.circle.badge.checkmark"
        case .authorized:
            return "person.crop.circle"
        case .denied, .restricted:
            return "arrow.up.right"
        }
    }

    var contactsActionAccessory: String {
        switch model.contactsPermissionState {
        case .limited:
            return "chevron.right"
        case .notDetermined, .authorized, .denied, .restricted:
            return "arrow.up.right"
        }
    }

    func handleContactsAction() {
        switch model.contactsPermissionState {
        case .notDetermined:
            Task {
                await model.requestContactsAccess()
            }
        case .limited:
            isContactAccessPickerPresented = true
        case .authorized:
            model.openAppSettings()
        case .denied, .restricted:
            model.openAppSettings()
        }
    }

    var buttonAccentColor: Color {
        model.isBlockingEnabled ? theme.tint : theme.neutralAccent
    }

    var syncNowDetail: String {
        if model.isManualSyncInProgress {
            return "Refreshing repository data and reloading the extension."
        }

        return model.lastManualSyncStatus?.message
        ?? "Fetch repository metadata, rebuild the protection feed, and reload Call Blocking."
    }

    var syncResultTint: Color {
        guard let status = model.lastManualSyncStatus else {
            return theme.tint
        }

        switch status.style {
        case .success:
            return theme.success
        case .warning:
            return theme.warning
        case .failure:
            return theme.destructive
        }
    }

    var syncResultBackground: Color {
        syncResultTint.opacity(colorScheme == .dark ? 0.22 : 0.12)
    }

    var syncResultSymbol: String {
        guard let status = model.lastManualSyncStatus else {
            return "arrow.triangle.2.circlepath.circle.fill"
        }

        switch status.style {
        case .success:
            return "checkmark.circle.fill"
        case .warning:
            return "exclamationmark.triangle.fill"
        case .failure:
            return "xmark.octagon.fill"
        }
    }

    var theme: AppPalette {
        AppPalette(colorScheme: colorScheme)
    }

    var contactsFilteringDescription: String {
        """
        SpamSniper asks for Contacts access only to avoid blocking phone numbers \
        that already exist in your address book.
        """
    }

    var repoDrivenDescription: String {
        """
        SpamSniper reads a repo index, lets you choose country-specific lists,
        and merges synced entries with your personal list before building the final protection feed.
        """
    }

    var dailySyncDescription: String {
        """
        The app refreshes blocklist data on a daily cadence while launching or returning \
        to the foreground, fetching the repo index first so your selected country lists stay current.
        """
    }
}
