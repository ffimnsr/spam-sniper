//
//  CallDirectoryHandler.swift
//  SpamSniperCallBlocker
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

        let snapshot = try? BlocklistSyncService.fetchEffectiveSnapshot()
        let blockingNumbers = snapshot?.blockedNumbers ?? SpamBlockerShared.blockedNumbers

        for phoneNumber in blockingNumbers {
            context.addBlockingEntry(withNextSequentialPhoneNumber: phoneNumber)
        }

        if let snapshot {
            for identificationEntry in snapshot.identificationEntries {
                context.addIdentificationEntry(
                    withNextSequentialPhoneNumber: identificationEntry.phoneNumber,
                    label: identificationEntry.label
                )
            }
        }

        context.completeRequest()
    }
}

extension CallDirectoryHandler: CXCallDirectoryExtensionContextDelegate {
    func requestFailed(for extensionContext: CXCallDirectoryExtensionContext, withError error: Error) {
        NSLog("SpamSniper call directory request failed: %@", error.localizedDescription)
    }
}
