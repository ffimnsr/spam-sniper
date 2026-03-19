//
//  CallDirectoryHandler.swift
//  SpamSniperCallBlocker
//
//  Created by Codex on 3/19/26.
//

import CallKit
import Foundation

final class CallDirectoryHandler: CXCallDirectoryProvider {
    override func beginRequest(with context: CXCallDirectoryExtensionContext) {
        context.delegate = self

        if context.isIncremental {
            context.removeAllBlockingEntries()
        }

        guard SpamBlockerShared.isEnabled else {
            context.completeRequest()
            return
        }

        for phoneNumber in SpamBlockerShared.blockedNumbers {
            context.addBlockingEntry(withNextSequentialPhoneNumber: phoneNumber)
        }

        context.completeRequest()
    }
}

extension CallDirectoryHandler: CXCallDirectoryExtensionContextDelegate {
    func requestFailed(for extensionContext: CXCallDirectoryExtensionContext, withError error: Error) {
        NSLog("SpamSniper call directory request failed: %@", error.localizedDescription)
    }
}
