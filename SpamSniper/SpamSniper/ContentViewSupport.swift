import SwiftUI

extension ContentView {
    var heroCard: some View {
        ZStack(alignment: .topTrailing) {
            LinearGradient(colors: theme.heroBackground, startPoint: .topLeading, endPoint: .bottomTrailing)
            
            Circle()
                .fill(theme.ambientGlow.first ?? .clear)
                .frame(width: 180, height: 180)
                .blur(radius: 18)
                .offset(x: 62, y: -70)
            
            Circle()
                .fill(theme.ambientGlow.dropFirst().first ?? .clear)
                .frame(width: 150, height: 150)
                .blur(radius: 22)
                .offset(x: -190, y: 140)
            
            VStack(alignment: .leading, spacing: 22) {
                if model.extensionStatus == .unavailableOnSimulator {
                    heroStatusCopy
                        .frame(maxWidth: .infinity, alignment: .leading)
                } else {
                    HStack(alignment: .top, spacing: 18) {
                        heroStatusCopy
                        
                        Spacer(minLength: 8)
                        protectionOrb
                    }
                }
                
                heroMetric(symbol: "clock.arrow.circlepath", title: "Synced", value: model.lastSyncDescription)
            }
            .padding(24)
        }
        .clipShape(RoundedRectangle(cornerRadius: 34, style: .continuous))
        .overlay {
            RoundedRectangle(cornerRadius: 34, style: .continuous)
                .strokeBorder(.white.opacity(colorScheme == .dark ? 0.18 : 0.44), lineWidth: 1)
        }
        .shadow(color: theme.tint.opacity(colorScheme == .dark ? 0.18 : 0.14), radius: 30, x: 0, y: 18)
        .accessibilityElement(children: .combine)
    }
    
    var protectionOrb: some View {
        ZStack {
            Circle()
                .fill(.ultraThinMaterial)
                .frame(width: 82, height: 82)
                .overlay {
                    Circle()
                        .strokeBorder(.white.opacity(0.32), lineWidth: 1)
                }
            Image(systemName: model.isBlockingEnabled ? "shield.checkered" : "shield.slash")
                .font(.system(size: 34, weight: .bold))
                .foregroundStyle(model.isBlockingEnabled ? theme.success : theme.warning)
        }
        .shadow(color: Color.black.opacity(0.16), radius: 18, x: 0, y: 10)
    }
    
    var heroStatusCopy: some View {
        VStack(alignment: .leading, spacing: 10) {
            statusPill(title: model.isBlockingEnabled ? "Live Protection" : "Protection Paused", tint: model.isBlockingEnabled ? theme.success : theme.warning)
            Text(statusTitle)
                .font(.system(size: 38, weight: .black, design: .rounded))
                .foregroundStyle(theme.heroForeground)
                .lineLimit(2)
                .minimumScaleFactor(0.78)
            Text(model.extensionStatus.message)
                .font(.callout)
                .foregroundStyle(theme.heroSecondaryForeground)
                .frame(maxWidth: .infinity, alignment: .leading)
                .fixedSize(horizontal: false, vertical: true)
        }
    }
    
    var quickActionsSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            sectionHeader("Command Center", subtitle: "Fast access to protection, sources, and search.")
            
            VStack(spacing: 0) {
                syncNowTile
                actionRowDivider
                callBlockingSettingsTile
                actionRowDivider
                contactsTile
                actionRowDivider
                repositorySettingsTile
                actionRowDivider
                blocklistSelectionTile
                actionRowDivider
                searchNumbersTile
            }
            .padding(.horizontal, 14)
            .padding(.vertical, 4)
            .background(theme.secondarySurface, in: RoundedRectangle(cornerRadius: 22, style: .continuous))
            .overlay {
                RoundedRectangle(cornerRadius: 22, style: .continuous)
                    .strokeBorder(.white.opacity(colorScheme == .dark ? 0.12 : 0.24), lineWidth: 1)
            }
        }
        .cardStyle(cornerRadius: 28)
    }
    
    var syncNowTile: some View {
        Button {
            Task {
                await model.syncNow()
            }
        } label: {
            actionTileContent(
                symbol: model.isManualSyncInProgress ? "arrow.triangle.2.circlepath.circle.fill" : "arrow.clockwise.circle.fill",
                title: model.isManualSyncInProgress ? "Syncing…" : "Sync Now",
                detail: syncNowDetail,
                tint: theme.tint,
                accessory: model.isManualSyncInProgress ? "ellipsis" : "arrow.clockwise"
            )
        }
        .buttonStyle(.plain)
        .disabled(model.isManualSyncInProgress)
    }
    
    var callBlockingSettingsTile: some View {
        Button {
            Task {
                await model.openSettings()
            }
        } label: {
            actionTileContent(
                symbol: "phone.connection.fill",
                title: callBlockingSettingsTitle,
                detail: "Finish the system Call Blocking handoff in Settings.",
                tint: theme.warning,
                accessory: "arrow.up.right"
            )
        }
        .buttonStyle(.plain)
    }
    
    var contactsTile: some View {
        Button(action: handleContactsAction) {
            actionTileContent(
                symbol: contactsActionSymbol,
                title: contactsActionTitle,
                detail: model.contactsStatusDescription,
                tint: theme.tint,
                accessory: contactsActionAccessory
            )
        }
        .buttonStyle(.plain)
        .modifier(ContactAccessPickerModifier(isPresented: $isContactAccessPickerPresented) {
            Task { @MainActor in
                await model.refresh()
            }
        })
    }
    
    var repositorySettingsTile: some View {
        NavigationLink {
            SettingsView(model: model)
        } label: {
            actionTileContent(
                symbol: "gearshape.2.fill",
                title: "Settings",
                detail: "Repositories, protection mode, trust, and diagnostics.",
                tint: theme.tint,
                accessory: "chevron.right"
            )
        }
        .buttonStyle(.plain)
    }
    
    var blocklistSelectionTile: some View {
        NavigationLink {
            BlocklistSelectionView(model: model)
        } label: {
            actionTileContent(
                symbol: "checklist.checked",
                title: "Blocklists",
                detail: model.selectedBlocklistTitle,
                tint: theme.success,
                accessory: "chevron.right"
            )
        }
        .buttonStyle(.plain)
    }
    
    var searchNumbersTile: some View {
        NavigationLink {
            BlocklistSearchView(model: model)
        } label: {
            actionTileContent(
                symbol: "magnifyingglass.circle.fill",
                title: "Search",
                detail: "Look up numbers in the final protection feed.",
                tint: theme.tint,
                accessory: "chevron.right"
            )
        }
        .buttonStyle(.plain)
    }
    
    var stickyProtectionBar: some View {
        VStack(spacing: 0) {
            VStack(alignment: .leading, spacing: 12) {
                HStack(alignment: .center, spacing: 12) {
                    Image(systemName: model.isBlockingEnabled ? "shield.fill" : "shield.slash.fill")
                        .font(.headline.weight(.bold))
                        .foregroundStyle(model.isBlockingEnabled ? theme.success : theme.warning)
                        .frame(width: 34, height: 34)
                        .background(theme.tintSoft, in: Circle())
                    
                    VStack(alignment: .leading, spacing: 3) {
                        Text(model.isBlockingEnabled ? "Protection is active" : "Protection is paused")
                            .font(.subheadline.weight(.bold))
                        Text(stickyStatusDescription)
                            .font(.caption)
                            .foregroundStyle(.secondary)
                            .lineLimit(2)
                    }
                    
                    Spacer(minLength: 8)
                    
                    if model.isBusy {
                        ProgressView()
                            .controlSize(.small)
                    }
                }
                
                Button {
                    Task {
                        await model.setBlockingEnabled(!model.isBlockingEnabled)
                    }
                } label: {
                    HStack(spacing: 12) {
                        Text(protectionButtonTitle)
                            .font(.headline.weight(.bold))
                        Spacer()
                        Image(systemName: model.isBlockingEnabled ? "pause.fill" : "power")
                            .font(.subheadline.weight(.black))
                            .frame(width: 30, height: 30)
                            .background(.white.opacity(0.92), in: Circle())
                            .foregroundStyle(buttonAccentColor)
                    }
                    .foregroundStyle(.white)
                    .padding(.horizontal, 18)
                    .padding(.vertical, 16)
                    .frame(maxWidth: .infinity)
                    .background(
                        LinearGradient(colors: buttonGradientColors, startPoint: .leading, endPoint: .trailing),
                        in: RoundedRectangle(cornerRadius: 24, style: .continuous)
                    )
                }
                .buttonStyle(.plain)
                .disabled(model.isBusy)
                .opacity(model.isBusy ? 0.72 : 1)
            }
            .padding(.horizontal, 18)
            .padding(.top, 14)
            .padding(.bottom, 16)
            .background(.ultraThinMaterial)
            .overlay(alignment: .top) {
                Rectangle()
                    .fill(.white.opacity(0.16))
                    .frame(height: 1)
            }
        }
    }

    var staleSyncCard: some View {
        Group {
            if let staleWarningTitle, let staleWarningDetail {
                HStack(alignment: .top, spacing: 14) {
                    Image(systemName: "clock.badge.exclamationmark.fill")
                        .font(.title3.weight(.bold))
                        .foregroundStyle(theme.warning)
                        .frame(width: 42, height: 42)
                        .background(theme.warning.opacity(0.14), in: RoundedRectangle(cornerRadius: 15, style: .continuous))
                    VStack(alignment: .leading, spacing: 5) {
                        Text(staleWarningTitle)
                            .font(.headline.weight(.bold))
                        Text(staleWarningDetail)
                            .font(.footnote)
                            .foregroundStyle(.secondary)
                            .fixedSize(horizontal: false, vertical: true)
                    }
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                .cardStyle(cornerRadius: 26)
            }
        }
    }
    
    var statsRow: some View {
        VStack(spacing: 12) {
            numberSummaryCard
            
            ViewThatFits(in: .horizontal) {
                HStack(spacing: 12) {
                    compactStatusCard(
                        title: "Extension",
                        value: statusShortValue,
                        detail: "iOS status",
                        symbol: "antenna.radiowaves.left.and.right",
                        tint: model.extensionStatus == .enabled ? theme.success : theme.warning
                    )
                    compactStatusCard(
                        title: "Trust",
                        value: model.blocklistSignatureStatus,
                        detail: "Signature",
                        symbol: "checkmark.seal.fill",
                        tint: signatureStatusColor
                    )
                }
                
                VStack(spacing: 12) {
                    compactStatusCard(
                        title: "Extension",
                        value: statusShortValue,
                        detail: "iOS status",
                        symbol: "antenna.radiowaves.left.and.right",
                        tint: model.extensionStatus == .enabled ? theme.success : theme.warning
                    )
                    compactStatusCard(
                        title: "Trust",
                        value: model.blocklistSignatureStatus,
                        detail: "Signature",
                        symbol: "checkmark.seal.fill",
                        tint: signatureStatusColor
                    )
                }
            }
        }
    }
    
    var numberSummaryCard: some View {
        HStack(alignment: .center, spacing: 16) {
            Image(systemName: "number.circle.fill")
                .font(.title3.weight(.bold))
                .foregroundStyle(theme.tint)
                .frame(width: 44, height: 44)
                .background(theme.tint.opacity(colorScheme == .dark ? 0.18 : 0.12), in: Circle())
            
            VStack(alignment: .leading, spacing: 4) {
                Text("NUMBERS")
                    .font(.caption2.weight(.black))
                    .foregroundStyle(.secondary)
                Text("In protection feed")
                    .font(.subheadline.weight(.bold))
                    .foregroundStyle(.primary)
            }
            
            Spacer(minLength: 12)
            
            Text("\(model.blockedNumberCount)")
                .font(.system(size: 38, weight: .black, design: .rounded))
                .foregroundStyle(.primary)
                .lineLimit(1)
                .minimumScaleFactor(0.6)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .cardStyle(cornerRadius: 26)
    }
    
    var detailsCard: some View {
        VStack(alignment: .leading, spacing: 18) {
            sectionHeader("Blocklist Intelligence", subtitle: "Selected sources, verification, and how SpamSniper keeps blocking safe.")
            
            VStack(alignment: .leading, spacing: 12) {
                HStack(alignment: .top, spacing: 14) {
                    Image(systemName: "rectangle.stack.badge.person.crop.fill")
                        .font(.title3.weight(.semibold))
                        .foregroundStyle(theme.success)
                        .frame(width: 44, height: 44)
                        .background(theme.success.opacity(0.14), in: RoundedRectangle(cornerRadius: 16, style: .continuous))
                    
                    VStack(alignment: .leading, spacing: 6) {
                        Text(model.selectedBlocklistTitle)
                            .font(.headline.weight(.bold))
                        if !model.selectedBlocklistCountry.isEmpty {
                            Text(model.selectedBlocklistCountry)
                                .font(.caption.weight(.semibold))
                                .foregroundStyle(theme.tint)
                        }
                        Text(model.selectedBlocklistDescription)
                            .font(.footnote)
                            .foregroundStyle(.secondary)
                            .fixedSize(horizontal: false, vertical: true)
                    }
                }
            }
            .panelStyle()
            
            detailPanel {
                VStack(alignment: .leading, spacing: 14) {
                    sourceSummary
                    Divider().opacity(0.45)
                    signatureSummary
                }
            }
        }
        .cardStyle()
    }
    
    var syncResultCard: some View {
        Group {
            if let status = model.lastManualSyncStatus {
                HStack(alignment: .top, spacing: 14) {
                    Image(systemName: syncResultSymbol)
                        .font(.title3.weight(.bold))
                        .foregroundStyle(syncResultTint)
                        .frame(width: 42, height: 42)
                        .background(syncResultBackground, in: RoundedRectangle(cornerRadius: 15, style: .continuous))
                    VStack(alignment: .leading, spacing: 5) {
                        Text(status.title)
                            .font(.headline.weight(.bold))
                        Text(status.message)
                            .font(.footnote)
                            .foregroundStyle(.secondary)
                            .fixedSize(horizontal: false, vertical: true)
                        Text("Updated \(SpamBlockerModel.syncFormatter.localizedString(for: status.recordedAt, relativeTo: Date())).")
                            .font(.caption2)
                            .foregroundStyle(.tertiary)
                    }
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                .cardStyle(cornerRadius: 26)
            }
        }
    }
    
    func errorCard(message: String) -> some View {
        HStack(alignment: .top, spacing: 14) {
            Image(systemName: "exclamationmark.triangle.fill")
                .font(.title3.weight(.bold))
                .foregroundStyle(theme.warning)
                .frame(width: 42, height: 42)
                .background(theme.warning.opacity(0.14), in: RoundedRectangle(cornerRadius: 15, style: .continuous))
            VStack(alignment: .leading, spacing: 5) {
                Text("Needs attention")
                    .font(.headline.weight(.bold))
                Text(message)
                    .font(.footnote)
                    .foregroundStyle(.secondary)
                    .fixedSize(horizontal: false, vertical: true)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .cardStyle(cornerRadius: 26)
    }
    
    var aboutEntryCard: some View {
        NavigationLink {
            AboutView()
        } label: {
            HStack(alignment: .center, spacing: 14) {
                Image(systemName: "sparkles.rectangle.stack.fill")
                    .font(.title3.weight(.semibold))
                    .foregroundStyle(theme.tint)
                    .frame(width: 46, height: 46)
                    .background(theme.tintSoft, in: RoundedRectangle(cornerRadius: 16, style: .continuous))
                VStack(alignment: .leading, spacing: 4) {
                    Text("About SpamSniper")
                        .font(.headline.weight(.bold))
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
            .panelStyle(cornerRadius: 24)
        }
        .buttonStyle(.plain)
    }
    
    var actionRowDivider: some View {
        Divider()
            .overlay(.white.opacity(colorScheme == .dark ? 0.06 : 0.14))
            .padding(.leading, 46)
    }
    
    func sectionHeader(_ title: String, subtitle: String) -> some View {
        VStack(alignment: .leading, spacing: 5) {
            Text(title)
                .font(.title3.weight(.black))
            Text(subtitle)
                .font(.footnote)
                .foregroundStyle(.secondary)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }
    
    func heroMetric(symbol: String, title: String? = nil, value: String, expands: Bool = true) -> some View {
        HStack(spacing: 10) {
            Image(systemName: symbol)
                .font(.caption.weight(.bold))
                .foregroundStyle(theme.tint)
                .frame(width: 28, height: 28)
                .background(.white.opacity(colorScheme == .dark ? 0.12 : 0.58), in: Circle())
            VStack(alignment: .leading, spacing: 2) {
                if let title {
                    Text(title.uppercased())
                        .font(.caption2.weight(.black))
                        .foregroundStyle(theme.heroSecondaryForeground)
                }
                Text(value)
                    .font(title == nil ? .title3.weight(.black) : .caption.weight(.bold))
                    .foregroundStyle(theme.heroForeground)
                    .lineLimit(1)
            }
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 10)
        .frame(maxWidth: expands ? .infinity : nil, alignment: .leading)
        .background(.white.opacity(colorScheme == .dark ? 0.08 : 0.46), in: RoundedRectangle(cornerRadius: 18, style: .continuous))
    }
    
    func actionTileContent(symbol: String, title: String, detail: String, tint: Color, accessory: String) -> some View {
        HStack(alignment: .center, spacing: 12) {
            Image(systemName: symbol)
                .font(.subheadline.weight(.bold))
                .foregroundStyle(tint)
                .frame(width: 34, height: 34)
                .background(tint.opacity(colorScheme == .dark ? 0.18 : 0.12), in: RoundedRectangle(cornerRadius: 12, style: .continuous))
            
            VStack(alignment: .leading, spacing: 2) {
                Text(title)
                    .font(.subheadline.weight(.semibold))
                    .foregroundStyle(.primary)
                    .lineLimit(1)
                Text(detail)
                    .font(.caption)
                    .foregroundStyle(.secondary)
                    .lineLimit(2)
            }
            
            Spacer(minLength: 8)
            
            Image(systemName: accessory)
                .font(.caption.weight(.bold))
                .foregroundStyle(.secondary)
                .frame(width: 16, height: 16)
        }
        .padding(.vertical, 11)
        .frame(maxWidth: .infinity, alignment: .leading)
        .contentShape(Rectangle())
    }
    
    func compactStatusCard(title: String, value: String, detail: String, symbol: String, tint: Color) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                Image(systemName: symbol)
                    .font(.subheadline.weight(.bold))
                    .foregroundStyle(tint)
                    .frame(width: 32, height: 32)
                    .background(tint.opacity(colorScheme == .dark ? 0.18 : 0.12), in: Circle())
                Spacer()
                Text(title.uppercased())
                    .font(.caption2.weight(.black))
                    .foregroundStyle(.secondary)
            }
            
            Text(value)
                .font(.system(size: 24, weight: .black, design: .rounded))
                .foregroundStyle(.primary)
                .lineLimit(1)
                .minimumScaleFactor(0.7)
            
            Text(detail)
                .font(.caption2)
                .foregroundStyle(.secondary)
        }
        .frame(maxWidth: .infinity, minHeight: 96, alignment: .leading)
        .panelStyle(cornerRadius: 22)
    }
    
    func statusPill(title: String, tint: Color? = nil) -> some View {
        Text(title)
            .font(.caption.weight(.black))
            .foregroundStyle(tint ?? theme.heroForeground)
            .padding(.horizontal, 12)
            .padding(.vertical, 8)
            .background((tint ?? theme.tint).opacity(colorScheme == .dark ? 0.20 : 0.14), in: Capsule())
            .overlay {
                Capsule()
                    .strokeBorder(.white.opacity(colorScheme == .dark ? 0.20 : 0.42), lineWidth: 1)
            }
    }
}
