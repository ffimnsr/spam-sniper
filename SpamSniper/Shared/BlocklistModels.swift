//
//  BlocklistModels.swift
//  SpamSniper
//
//  Created by Codex on 3/19/26.
//

import Foundation

struct BlocklistDocument: Decodable {
    let source: String
    let entries: [BlocklistEntryDocument]

    enum CodingKeys: String, CodingKey {
        case source
        case entries
    }
}

struct BlocklistEntryDocument: Decodable {
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

    var normalizedDigits: String {
        Self.normalizedDigits(from: phoneNumberE164)
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

    nonisolated static func normalizedDigits(from rawValue: String) -> String {
        rawValue.filter(\.isNumber)
    }
}

struct BlockedNumberSearchResult: Identifiable, Equatable {
    let record: BlockedNumberRecord
    let matchedDigits: String
    let matchKind: MatchKind

    var id: Int64 { record.id }

    enum MatchKind: String, Equatable {
        case exact
        case suffix
        case contains
    }
}

struct BlocklistSnapshot {
    let records: [BlockedNumberRecord]
    let blocklistIDs: [String]
    let source: String
    let syncedAt: Date?

    // swiftlint:disable:next unused_declaration
    var blockedNumbers: [Int64] {
        records.map(\.phoneNumber).sorted()
    }
}

struct BlocklistRepositoryDocument: Decodable {
    let name: String
    let gpgKeyURL: String?
    let defaultBlocklistID: String?
    let countries: [BlocklistRepositoryCountry]

    enum CodingKeys: String, CodingKey {
        case name
        case gpgKeyURL = "gpg_key_url"
        case defaultBlocklistID = "default_blocklist_id"
        case countries
    }
}

struct BlocklistRepositoryCountry: Decodable, Identifiable, Equatable {
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

struct BlocklistRepositoryEntry: Decodable, Identifiable, Equatable {
    let id: String
    let title: String
    let description: String
    let path: String
    let source: String
    let signatureURL: String?

    enum CodingKeys: String, CodingKey {
        case id
        case title
        case description
        case path
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
    let signatureURL: URL?
}

struct StoredBlocklistSelection: Codable, Equatable {
    let id: String
    let countryCode: String
    let countryName: String
    let title: String
    let description: String
    let documentURL: String?
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

// MARK: - Stored Repository

struct StoredRepository: Codable, Identifiable, Equatable {
    /// Stable identifier – the normalised URL string (never changes for a given entry).
    let id: String
    /// The repo.json URL (may be updated by the user).
    var urlString: String
    /// Name sourced from repo metadata at validation time.
    var name: String
    /// Optional user-supplied override label. When set this is what the UI shows.
    var customName: String
    /// `true` for the read-only built-in community repo entry.
    let isBuiltIn: Bool

    /// The label that should be displayed in the UI.
    var displayName: String {
        let label = customName.trimmingCharacters(in: .whitespacesAndNewlines)
        return label.isEmpty ? name : label
    }

    var resolvedURL: URL? { URL(string: urlString) }

    /// Returns a copy with updated fields; `id` is always preserved.
    func updating(urlString: String? = nil, name: String? = nil, customName: String? = nil) -> StoredRepository {
        StoredRepository(
            id: id,
            urlString: urlString ?? self.urlString,
            name: name ?? self.name,
            customName: customName ?? self.customName,
            isBuiltIn: isBuiltIn
        )
    }
}

extension StoredRepository {
    static let builtIn = StoredRepository(
        id: "builtin",
        urlString: "https://raw.githubusercontent.com/ffimnsr/spam-sniper/master/blocklist/repo.json",
        name: "Built-in Community Repo",
        customName: "",
        isBuiltIn: true
    )

    /// Convenience init used when saving a newly validated repo.
    init(validatedURL: URL, repoName: String) {
        self.init(
            id: validatedURL.absoluteString,
            urlString: validatedURL.absoluteString,
            name: repoName,
            customName: "",
            isBuiltIn: false
        )
    }
}

// MARK: -

extension StoredBlocklistSelection {
    nonisolated init(entry: BlocklistCatalogEntry) {
        self.init(
            id: entry.id,
            countryCode: entry.countryCode,
            countryName: entry.countryName,
            title: entry.title,
            description: entry.description,
            documentURL: entry.documentURL?.absoluteString,
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
