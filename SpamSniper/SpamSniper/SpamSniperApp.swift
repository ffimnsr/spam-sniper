//
//  SpamSniperApp.swift
//  SpamSniper
//
//  Created by ffimnsr on 3/19/26.
//

import Foundation
import SwiftUI

enum AppRuntime {
    static var isRunningTests: Bool {
        ProcessInfo.processInfo.environment["XCTestConfigurationFilePath"] != nil
    }
}

@main
struct SpamSniperApp: App {
    init() {
        SpamBlockerShared.registerDefaults()
        guard !AppRuntime.isRunningTests else { return }
        PersonalBlocklistStore.shared.startObserving()
    }

    var body: some Scene {
        WindowGroup {
            ContentView()
        }
    }
}
