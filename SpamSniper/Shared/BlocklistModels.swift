//
//  BlocklistModels.swift
//  SpamSniper
//
//  Created by Codex on 3/19/26.
//

import Foundation

struct BlocklistDocument: Codable {
    let version: Int
    let generatedAt: String
    let source: String
    let notes: [String]
    let entries: [BlocklistEntryDocument]
}

struct BlocklistEntryDocument: Codable {
    let phoneNumberE164: String
    let displayName: String
    let category: String
    let confidence: String
    let aliases: [String]
    let tags: [String]
    let notes: String

    enum CodingKeys: String, CodingKey {
        case phoneNumberE164 = "phone_number_e164"
        case displayName = "display_name"
        case category
        case confidence
        case aliases
        case tags
        case notes
    }
}

struct BlockedNumberRecord: Identifiable, Equatable {
    let phoneNumber: Int64
    let displayName: String
    let category: String
    let confidence: String
    let aliases: [String]
    let tags: [String]
    let notes: String

    var id: Int64 { phoneNumber }

    var phoneNumberE164: String {
        "+\(phoneNumber)"
    }

    nonisolated static func from(document: BlocklistEntryDocument) -> BlockedNumberRecord? {
        let digits = document.phoneNumberE164.filter(\.isNumber)
        guard let phoneNumber = Int64(digits), phoneNumber > 0 else {
            return nil
        }

        return BlockedNumberRecord(
            phoneNumber: phoneNumber,
            displayName: document.displayName,
            category: document.category,
            confidence: document.confidence,
            aliases: document.aliases,
            tags: document.tags,
            notes: document.notes
        )
    }
}

struct BlocklistSnapshot {
    let records: [BlockedNumberRecord]
    let source: String
    let syncedAt: Date?

    var blockedNumbers: [Int64] {
        records.map(\.phoneNumber).sorted()
    }
}
