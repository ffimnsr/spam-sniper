import SwiftUI

struct ContentView: View {
    @State var model = SpamBlockerModel()
    @State var isContactAccessPickerPresented = false
    @Environment(\.scenePhase) var scenePhase
    @Environment(\.colorScheme) var colorScheme

    var body: some View {
        NavigationStack {
            ScrollView {
                LazyVStack(alignment: .leading, spacing: 18) {
                    heroCard
                    quickActionsSection
                    statsRow
                    detailsCard
                    staleSyncCard
                    syncResultCard

                    if let errorMessage = model.errorMessage {
                        errorCard(message: errorMessage)
                    }

                    aboutEntryCard
                }
                .padding(.horizontal, 18)
                .padding(.top, 14)
                .padding(.bottom, 18)
            }
            .scrollIndicators(.hidden)
            .background(backgroundGradient)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .principal) {
                    VStack(spacing: 2) {
                        Text("SpamSniper")
                            .font(.headline.weight(.bold))
                        Text(model.isBlockingEnabled ? "Protection on" : "Protection paused")
                            .font(.caption2.weight(.semibold))
                            .foregroundStyle(.secondary)
                    }
                    .accessibilityElement(children: .combine)
                }
            }
            .safeAreaInset(edge: .bottom) {
                stickyProtectionBar
            }
            .task {
                guard !AppRuntime.isRunningTests else { return }
                await model.refresh()
            }
            .onChange(of: scenePhase) { _, newPhase in
                guard !AppRuntime.isRunningTests else { return }
                guard newPhase == .active else { return }

                Task {
                    await model.refresh()
                }
            }
            .onReceive(NotificationCenter.default.publisher(for: .personalBlocklistStoreDidChange)) { _ in
                guard !AppRuntime.isRunningTests else { return }
                Task {
                    await model.processPersonalBlocklistChange()
                }
            }
        }
    }
}

#Preview {
    ContentView()
}
