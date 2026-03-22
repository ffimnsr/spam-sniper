//
//  ContactFilteringService.swift
//  SpamSniper
//
//  Created by Codex on 3/19/26.
//

import Contacts
import Foundation

struct ContactFilterSnapshot {
    enum PermissionState {
        case authorized
        case limited
        case denied
        case restricted
        case notDetermined

        var description: String {
            switch self {
            case .authorized:
                return "All contacts are checked so known people are excluded from blocking."
            case .limited:
                return "Only selected contacts are checked so saved people can be excluded from blocking."
            case .denied:
                return "Contacts access is off, so SpamSniper cannot skip numbers saved in your address book."
            case .restricted:
                return "Contacts access is restricted on this device."
            case .notDetermined:
                return "Contacts permission has not been decided yet."
            }
        }
    }

    let state: PermissionState
    let phoneNumbers: Set<Int64>
}

enum ContactFilteringService {
    static func currentPermissionState() -> ContactFilterSnapshot.PermissionState {
        permissionState(for: CNContactStore.authorizationStatus(for: .contacts))
    }

    static func requestAccessIfNeeded() async -> ContactFilterSnapshot.PermissionState {
        let store = CNContactStore()
        let state = currentPermissionState()
        guard state == .notDetermined else {
            return state
        }

        _ = await requestContactsAccess(store: store)
        return currentPermissionState()
    }

    static func loadSnapshot() async -> ContactFilterSnapshot {
        let state = currentPermissionState()
        let store = CNContactStore()

        guard state == .authorized || state == .limited else {
            return ContactFilterSnapshot(state: state, phoneNumbers: [])
        }

        let keys: [CNKeyDescriptor] = [CNContactPhoneNumbersKey as CNKeyDescriptor]
        let request = CNContactFetchRequest(keysToFetch: keys)

        let phoneNumbersResult: Result<Set<Int64>, Error> = await withCheckedContinuation { continuation in
            Task.detached {
                var collected = Set<Int64>()
                do {
                    try store.enumerateContacts(with: request) { contact, _ in
                        for phone in contact.phoneNumbers {
                            let digits = phone.value.stringValue.filter(\.isNumber)
                            if let value = Int64(digits), value > 0 {
                                collected.insert(value)
                            }
                        }
                    }
                    continuation.resume(returning: .success(collected))
                } catch {
                    continuation.resume(returning: .failure(error))
                }
            }
        }

        switch phoneNumbersResult {
        case .success(let numbers):
            return ContactFilterSnapshot(state: state, phoneNumbers: numbers)
        case .failure:
            return ContactFilterSnapshot(state: state, phoneNumbers: [])
        }
    }

    private static func requestContactsAccess(store: CNContactStore) async -> Bool {
        await withCheckedContinuation { continuation in
            store.requestAccess(for: .contacts) { granted, _ in
                continuation.resume(returning: granted)
            }
        }
    }

    private static func permissionState(for status: CNAuthorizationStatus) -> ContactFilterSnapshot.PermissionState {
        switch status {
        case .authorized:
            return .authorized
        case .limited:
            return .limited
        case .denied:
            return .denied
        case .restricted:
            return .restricted
        case .notDetermined:
            return .notDetermined
        @unknown default:
            return .notDetermined
        }
    }
}
