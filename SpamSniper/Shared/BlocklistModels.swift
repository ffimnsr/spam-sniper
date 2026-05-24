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
    /// Where this result originated.
    let source: ResultSource
    /// Personal entry attached to this result (non-nil when source is .personal or .combined).
    let personalEntry: PersonalBlocklistEntry?

    var id: Int64 { record.id }

    init(
        record: BlockedNumberRecord,
        matchedDigits: String,
        matchKind: MatchKind,
        source: ResultSource = .repo,
        personalEntry: PersonalBlocklistEntry? = nil
    ) {
        self.record = record
        self.matchedDigits = matchedDigits
        self.matchKind = matchKind
        self.source = source
        self.personalEntry = personalEntry
    }

    enum MatchKind: String, Equatable {
        case exact
        case suffix
        case contains
    }

    /// Where the search result came from.
    enum ResultSource: Equatable {
        /// Found only in the synced repo database.
        case repo
        /// Found only in the user's personal blocklist.
        case personal
        /// Found in both; repo record is primary, personal entry supplemental.
        case combined
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

struct ResolvedBlocklistRepositoryCountry: Identifiable, Equatable {
    let code: String
    let name: String
    let blocklists: [BlocklistCatalogEntry]

    var id: String { code }
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
    func resolvedCountries(relativeTo repositoryURL: URL?) -> [ResolvedBlocklistRepositoryCountry] {
        countries.map { country in
            ResolvedBlocklistRepositoryCountry(
                code: country.code,
                name: country.name,
                blocklists: country.blocklists.map { blocklist in
                    BlocklistCatalogEntry(
                        id: blocklist.id,
                        countryCode: country.code,
                        countryName: country.name,
                        title: blocklist.title,
                        description: blocklist.description,
                        source: blocklist.source,
                        documentURL: resolveDocumentURL(
                            blocklistPath: blocklist.path,
                            relativeTo: repositoryURL
                        ),
                        signatureURL: resolveBlocklistSignatureURL(
                            blocklistSignature: blocklist.signatureURL,
                            countrySignature: country.signatureURL,
                            relativeTo: repositoryURL
                        )
                    )
                }
            )
        }
    }

    func catalogEntries(relativeTo repositoryURL: URL?) -> [BlocklistCatalogEntry] {
        resolvedCountries(relativeTo: repositoryURL).flatMap(\.blocklists)
    }

    func resolvedRepositoryPublicKeyURL(relativeTo repositoryURL: URL?) -> URL? {
        resolveRepositoryRelativeURL(gpgKeyURL, relativeTo: repositoryURL)
    }

    private func resolveDocumentURL(
        blocklistPath: String,
        relativeTo repositoryURL: URL?
    ) -> URL? {
        resolveRepositoryRelativeURL(blocklistPath, relativeTo: repositoryURL)
    }

    private func resolveBlocklistSignatureURL(
        blocklistSignature: String?,
        countrySignature: String?,
        relativeTo repositoryURL: URL?
    ) -> URL? {
        resolveRepositoryRelativeURL(blocklistSignature ?? countrySignature, relativeTo: repositoryURL)
    }

    private func resolveRepositoryRelativeURL(
        _ value: String?,
        relativeTo repositoryURL: URL?
    ) -> URL? {
        guard let trimmedValue = value?.trimmingCharacters(in: .whitespacesAndNewlines),
              !trimmedValue.isEmpty else {
            return nil
        }

        if let url = URL(string: trimmedValue), url.scheme != nil {
            return url
        }

        guard let baseURL = repositoryURL?.deletingLastPathComponent() else {
            return nil
        }

        return URL(string: trimmedValue, relativeTo: baseURL)?.absoluteURL
    }
}

// MARK: - Trusted Key

struct TrustedKey: Codable, Identifiable, Equatable {
    /// Uppercase hex fingerprint of the OpenPGP key (e.g. "AABBCCDD…").
    let id: String
    /// Human-readable label shown in the UI.
    var name: String
    /// ASCII-armored public key block.
    var armoredData: String
    let addedAt: Date
    /// `true` for the read-only built-in community key.
    let isBuiltIn: Bool
}

extension TrustedKey {
    /// Short 8-char display fingerprint for the UI.
    var shortFingerprint: String {
        let hex = id.replacingOccurrences(of: " ", with: "")
        guard hex.count >= 8 else { return hex }
        return String(hex.suffix(8)).uppercased()
    }

    /// Formatted fingerprint split into 4-character groups.
    var formattedFingerprint: String {
        id.formattedAsFingerprintGroups()
    }
}

extension String {
    /// Formats a hex fingerprint string into space-separated 4-character groups.
    func formattedAsFingerprintGroups() -> String {
        let hex = self.replacingOccurrences(of: " ", with: "").uppercased()
        return stride(from: 0, to: hex.count, by: 4).map { i -> String in
            let start = hex.index(hex.startIndex, offsetBy: i)
            let end = hex.index(start, offsetBy: min(4, hex.count - i))
            return String(hex[start..<end])
        }.joined(separator: " ")
    }
}

// MARK: - Stored Repository

struct StoredRepository: Codable, Identifiable, Equatable {
    /// Stable identifier for this repository record.
    let id: String
    /// The repo.json URL (may be updated by the user).
    var urlString: String
    /// Name sourced from repo metadata at validation time.
    var name: String
    /// Optional user-supplied override label. When set this is what the UI shows.
    var customName: String
    /// `true` for the read-only built-in community repo entry.
    let isBuiltIn: Bool
    /// Fingerprint of the TrustedKey that must sign this repository's content.
    /// `nil` for the built-in repo (uses the bundled key) or repos not yet associated with a key.
    var trustedKeyFingerprint: String?

    /// The label that should be displayed in the UI.
    var displayName: String {
        let label = customName.trimmingCharacters(in: .whitespacesAndNewlines)
        return label.isEmpty ? name : label
    }

    var resolvedURL: URL? { URL(string: urlString) }

    init(
        id: String,
        urlString: String,
        name: String,
        customName: String,
        isBuiltIn: Bool,
        trustedKeyFingerprint: String?
    ) {
        self.id = id
        self.urlString = urlString
        self.name = name
        self.customName = customName
        self.isBuiltIn = isBuiltIn
        self.trustedKeyFingerprint = trustedKeyFingerprint
    }

    /// Returns a copy with updated fields; `id` is always preserved.
    func updating(urlString: String? = nil, name: String? = nil, customName: String? = nil, trustedKeyFingerprint: String?? = nil) -> StoredRepository {
        StoredRepository(
            id: id,
            urlString: urlString ?? self.urlString,
            name: name ?? self.name,
            customName: customName ?? self.customName,
            isBuiltIn: isBuiltIn,
            trustedKeyFingerprint: trustedKeyFingerprint ?? self.trustedKeyFingerprint
        )
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let urlString = try container.decode(String.self, forKey: .urlString)
        let isBuiltIn = try container.decodeIfPresent(Bool.self, forKey: .isBuiltIn) ?? false
        let decodedID = try container.decodeIfPresent(String.self, forKey: .id)

        self.id = Self.migratedID(decodedID, urlString: urlString, isBuiltIn: isBuiltIn)
        self.urlString = urlString
        self.name = try container.decode(String.self, forKey: .name)
        self.customName = try container.decodeIfPresent(String.self, forKey: .customName) ?? ""
        self.isBuiltIn = isBuiltIn
        self.trustedKeyFingerprint = try container.decodeIfPresent(String.self, forKey: .trustedKeyFingerprint)
    }

    private static func migratedID(_ decodedID: String?, urlString: String, isBuiltIn: Bool) -> String {
        if isBuiltIn {
            return builtIn.id
        }

        guard let decodedID, !decodedID.isEmpty else {
            return UUID().uuidString
        }

        if decodedID == urlString || URL(string: decodedID)?.scheme != nil {
            return UUID().uuidString
        }

        return decodedID
    }
}

private extension StoredRepository {
    enum CodingKeys: String, CodingKey {
        case id
        case urlString
        case name
        case customName
        case isBuiltIn
        case trustedKeyFingerprint
    }
}

extension StoredRepository {
    static let builtIn = StoredRepository(
        id: "builtin",
        urlString: "https://raw.githubusercontent.com/ffimnsr/spam-sniper/master/blocklist/repo.json",
        name: "Built-in Community Repo",
        customName: "",
        isBuiltIn: true,
        trustedKeyFingerprint: nil
    )

    /// Convenience init used when saving a newly validated repo.
    init(
        validatedURL: URL,
        repoName: String,
        trustedKeyFingerprint: String? = nil,
        id: String = UUID().uuidString
    ) {
        self.init(
            id: id,
            urlString: validatedURL.absoluteString,
            name: repoName,
            customName: "",
            isBuiltIn: false,
            trustedKeyFingerprint: trustedKeyFingerprint
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

extension BlockedNumberRecord {
    nonisolated static func == (lhs: BlockedNumberRecord, rhs: BlockedNumberRecord) -> Bool {
        lhs.phoneNumber == rhs.phoneNumber
        && lhs.displayName == rhs.displayName
        && lhs.category == rhs.category
        && lhs.confidence == rhs.confidence
        && lhs.aliases == rhs.aliases
        && lhs.tags == rhs.tags
        && lhs.notes == rhs.notes
    }
}

extension BlockedNumberSearchResult {
    nonisolated static func == (lhs: BlockedNumberSearchResult, rhs: BlockedNumberSearchResult) -> Bool {
        lhs.record == rhs.record
        && lhs.matchedDigits == rhs.matchedDigits
        && lhs.matchKind == rhs.matchKind
        && lhs.source == rhs.source
        && lhs.personalEntry == rhs.personalEntry
    }
}

extension BlockedNumberSearchResult.MatchKind {
    nonisolated static func == (lhs: Self, rhs: Self) -> Bool {
        lhs.rawValue == rhs.rawValue
    }
}

extension BlockedNumberSearchResult.ResultSource {
    nonisolated static func == (lhs: Self, rhs: Self) -> Bool {
        switch (lhs, rhs) {
        case (.repo, .repo), (.personal, .personal), (.combined, .combined):
            true
        default:
            false
        }
    }
}

extension BlocklistRepositoryCountry {
    nonisolated static func == (lhs: BlocklistRepositoryCountry, rhs: BlocklistRepositoryCountry) -> Bool {
        lhs.code == rhs.code
        && lhs.name == rhs.name
        && lhs.signatureURL == rhs.signatureURL
        && lhs.blocklists == rhs.blocklists
    }
}

extension BlocklistRepositoryEntry {
    nonisolated static func == (lhs: BlocklistRepositoryEntry, rhs: BlocklistRepositoryEntry) -> Bool {
        lhs.id == rhs.id
        && lhs.title == rhs.title
        && lhs.description == rhs.description
        && lhs.path == rhs.path
        && lhs.source == rhs.source
        && lhs.signatureURL == rhs.signatureURL
    }
}

extension BlocklistCatalogEntry {
    nonisolated static func == (lhs: BlocklistCatalogEntry, rhs: BlocklistCatalogEntry) -> Bool {
        lhs.id == rhs.id
        && lhs.countryCode == rhs.countryCode
        && lhs.countryName == rhs.countryName
        && lhs.title == rhs.title
        && lhs.description == rhs.description
        && lhs.source == rhs.source
        && lhs.documentURL == rhs.documentURL
        && lhs.signatureURL == rhs.signatureURL
    }
}

extension ResolvedBlocklistRepositoryCountry {
    nonisolated static func == (lhs: ResolvedBlocklistRepositoryCountry, rhs: ResolvedBlocklistRepositoryCountry) -> Bool {
        lhs.code == rhs.code
        && lhs.name == rhs.name
        && lhs.blocklists == rhs.blocklists
    }
}

extension StoredBlocklistSelection {
    nonisolated static func == (lhs: StoredBlocklistSelection, rhs: StoredBlocklistSelection) -> Bool {
        lhs.id == rhs.id
        && lhs.countryCode == rhs.countryCode
        && lhs.countryName == rhs.countryName
        && lhs.title == rhs.title
        && lhs.description == rhs.description
        && lhs.documentURL == rhs.documentURL
        && lhs.signatureURL == rhs.signatureURL
    }
}

extension TrustedKey {
    nonisolated static func == (lhs: TrustedKey, rhs: TrustedKey) -> Bool {
        lhs.id == rhs.id
        && lhs.name == rhs.name
        && lhs.armoredData == rhs.armoredData
        && lhs.addedAt == rhs.addedAt
        && lhs.isBuiltIn == rhs.isBuiltIn
    }
}

extension StoredRepository {
    nonisolated static func == (lhs: StoredRepository, rhs: StoredRepository) -> Bool {
        lhs.id == rhs.id
        && lhs.urlString == rhs.urlString
        && lhs.name == rhs.name
        && lhs.customName == rhs.customName
        && lhs.isBuiltIn == rhs.isBuiltIn
        && lhs.trustedKeyFingerprint == rhs.trustedKeyFingerprint
    }
}
