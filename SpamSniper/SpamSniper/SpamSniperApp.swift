//
//  SpamSniperApp.swift
//  SpamSniper
//
//  Created by pastel on 3/19/26.
//

import SwiftUI

@main
struct SpamSniperApp: App {
    init() {
        SpamBlockerShared.registerDefaults()
    }

    var body: some Scene {
        WindowGroup {
            ContentView()
        }
    }
}
