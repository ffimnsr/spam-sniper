//
//  ContentView.swift
//  SpamSniper
//
//  Created by pastel on 3/19/26.
//

import SwiftUI

struct ContentView: View {
    @State private var model = SpamBlockerModel()
    @Environment(\.scenePhase) private var scenePhase

    var body: some View {
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
        }
        .background(backgroundGradient)
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
                Text("Protection")
                    .font(.title3.weight(.semibold))
                Spacer()
                Circle()
                    .fill(model.isBlockingEnabled ? Color.green : Color.gray.opacity(0.35))
                    .frame(width: 10, height: 10)
            }

            Toggle(isOn: bindingForToggle) {
                VStack(alignment: .leading, spacing: 4) {
                    Text("Block calls on the spam list")
                        .font(.headline)
                    Text("Turning this off clears the blocker until you enable it again.")
                        .font(.footnote)
                        .foregroundStyle(.secondary)
                }
            }
            .disabled(model.isBusy)
            .tint(Color(red: 0.04, green: 0.46, blue: 0.54))

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
                Text("Source")
                    .font(.caption.weight(.bold))
                    .foregroundStyle(.secondary)
                Text(model.blocklistSource)
                    .font(.subheadline.weight(.semibold))
                Text("Last synced \(model.lastSyncDescription).")
                    .font(.footnote)
                    .foregroundStyle(.secondary)
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
                symbol: "list.bullet.rectangle.portrait",
                title: "Preloaded blocklist",
                detail: "SpamSniper imports a repo-friendly JSON blocklist into a shared SQLite database inside the app group."
            )

            infoRow(
                symbol: "phone.badge.shield.checkmark",
                title: "System-level call blocking",
                detail: "The Call Directory extension hands those numbers to iOS so matching calls can be blocked by the system."
            )

            infoRow(
                symbol: "arrow.triangle.2.circlepath",
                title: "Daily sync-ready",
                detail: "The app refreshes blocklist data on a daily cadence while launching or returning to the foreground, with a remote fetch hook ready for the repo URL."
            )
        }
        .cardStyle()
    }

    private func errorCard(message: String) -> some View {
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

    private func statCard(title: String, value: String, detail: String) -> some View {
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

    private func infoRow(symbol: String, title: String, detail: String) -> some View {
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

    private func statusPill(title: String) -> some View {
        Text(title)
            .font(.caption.weight(.bold))
            .foregroundStyle(.white)
            .padding(.horizontal, 12)
            .padding(.vertical, 8)
            .background(.white.opacity(0.15), in: Capsule())
    }

    private var backgroundGradient: some View {
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

    private var statusTitle: String {
        switch model.extensionStatus {
        case .enabled:
            return "Extension Ready"
        case .disabled:
            return "Needs Setup"
        case .unknown:
            return "Checking"
        }
    }

    private var statusShortValue: String {
        switch model.extensionStatus {
        case .enabled:
            return "Ready"
        case .disabled:
            return "Off"
        case .unknown:
            return "..."
        }
    }

    private var bindingForToggle: Binding<Bool> {
        Binding(
            get: { model.isBlockingEnabled },
            set: { newValue in
                Task {
                    await model.setBlockingEnabled(newValue)
                }
            }
        )
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
