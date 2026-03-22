import ContactsUI
import SwiftUI

struct ContentView: View {
    @State var model = SpamBlockerModel()
    @State var isContactAccessPickerPresented = false
    @Environment(\.scenePhase) var scenePhase
    @Environment(\.colorScheme) var colorScheme

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
}

#Preview {
    ContentView()
}
