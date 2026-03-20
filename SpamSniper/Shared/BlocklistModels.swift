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

    enum CodingKeys: String, CodingKey {
        case version
        case generatedAt = "generated_at"
        case source
        case notes
        case entries
    }
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
    let blocklistID: String?
    let source: String
    let syncedAt: Date?

    var blockedNumbers: [Int64] {
        records.map(\.phoneNumber).sorted()
    }
}

struct BlocklistRepositoryDocument: Codable {
    let version: Int
    let generatedAt: String
    let name: String
    let gpgKeyURL: String?
    let defaultBlocklistID: String?
    let countries: [BlocklistRepositoryCountry]

    enum CodingKeys: String, CodingKey {
        case version
        case generatedAt = "generated_at"
        case name
        case gpgKeyURL = "gpg_key_url"
        case defaultBlocklistID = "default_blocklist_id"
        case countries
    }
}

struct BlocklistRepositoryCountry: Codable, Identifiable, Equatable {
    let code: String
    let name: String
    let signatureURL: String?
    let blocklists: [BlocklistRepositoryEntry]

    var id: String { code }

    enum CodingKeys: String, CodingKey {
        case code
        case name
        case signatureURL = "signature_url"
        case blocklists
    }
}

struct BlocklistRepositoryEntry: Codable, Identifiable, Equatable {
    let id: String
    let title: String
    let description: String
    let path: String
    let seedResource: String
    let source: String
    let signatureURL: String?

    enum CodingKeys: String, CodingKey {
        case id
        case title
        case description
        case path
        case seedResource = "seed_resource"
        case source
        case signatureURL = "signature_url"
    }
}

struct BlocklistCatalogEntry: Identifiable, Equatable {
    let id: String
    let countryCode: String
    let countryName: String
    let title: String
    let description: String
    let source: String
    let documentURL: URL?
    let seedResource: String
    let signatureURL: URL?
}

struct StoredBlocklistSelection: Codable, Equatable {
    let id: String
    let countryCode: String
    let countryName: String
    let title: String
    let description: String
    let source: String
    let documentURL: String?
    let seedResource: String
    let signatureURL: String?
}

extension BlocklistRepositoryDocument {
    func catalogEntries(relativeTo repositoryURL: URL?) -> [BlocklistCatalogEntry] {
        countries.flatMap { country in
            country.blocklists.map { blocklist in
                BlocklistCatalogEntry(
                    id: blocklist.id,
                    countryCode: country.code,
                    countryName: country.name,
                    title: blocklist.title,
                    description: blocklist.description,
                    source: blocklist.source,
                    documentURL: repositoryURL?.deletingLastPathComponent().appending(path: blocklist.path),
                    seedResource: blocklist.seedResource,
                    signatureURL: resolveSignatureURL(
                        blocklistSignature: blocklist.signatureURL,
                        countrySignature: country.signatureURL,
                        relativeTo: repositoryURL
                    )
                )
            }
        }
    }

    private func resolveSignatureURL(
        blocklistSignature: String?,
        countrySignature: String?,
        relativeTo repositoryURL: URL?
    ) -> URL? {
        let value = blocklistSignature ?? countrySignature ?? gpgKeyURL
        guard let value else {
            return nil
        }

        if let url = URL(string: value), url.scheme != nil {
            return url
        }

        return repositoryURL?.deletingLastPathComponent().appending(path: value)
    }
}

extension StoredBlocklistSelection {
    init(entry: BlocklistCatalogEntry) {
        self.init(
            id: entry.id,
            countryCode: entry.countryCode,
            countryName: entry.countryName,
            title: entry.title,
            description: entry.description,
            source: entry.source,
            documentURL: entry.documentURL?.absoluteString,
            seedResource: entry.seedResource,
            signatureURL: entry.signatureURL?.absoluteString
        )
    }

    var resolvedDocumentURL: URL? {
        documentURL.flatMap(URL.init(string:))
    }

    var resolvedSignatureURL: URL? {
        signatureURL.flatMap(URL.init(string:))
    }
}
