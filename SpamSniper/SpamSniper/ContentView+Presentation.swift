//
//  ContentView+Presentation.swift
//  SpamSniper
//

import SwiftUI

extension ContentView {
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
        """
        SpamSniper asks for Contacts access only to avoid blocking phone numbers \
        that already exist in your address book.
        """
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
