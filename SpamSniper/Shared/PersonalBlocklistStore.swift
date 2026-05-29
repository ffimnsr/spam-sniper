import Foundation

// MARK: - Model

struct PersonalBlocklistImportPreview {
    let importedEntries: [PersonalBlocklistEntry]
    let importedCount: Int
    let additionsCount: Int
    let updatesCount: Int
    let duplicateCountInImport: Int
    let currentCount: Int
    let mergedTotalCount: Int
}

struct PersonalBlocklistImportResult {
    let importedCount: Int
    let additionsCount: Int
    let updatesCount: Int
    let finalTotalCount: Int
}

enum PersonalBlocklistTransferError: LocalizedError {
    case emptyFile
    case invalidLine(lineNumber: Int)
    case invalidPhoneNumber(lineNumber: Int)

    var errorDescription: String? {
        switch self {
        case .emptyFile:
            return "The selected file does not contain any personal blocklist entries."
        case .invalidLine(let lineNumber):
            return "Line \(lineNumber) is not valid JSON."
        case .invalidPhoneNumber(let lineNumber):
            return "Line \(lineNumber) does not contain a valid phone number."
        }
    }
}

/// A single entry in the user's personal blocklist.
struct PersonalBlocklistEntry: Codable, Identifiable, Equatable {
    /// Stable UUID string – never changes after creation.
    let id: String
    /// E.164-normalized phone number stored as a raw digit string (no leading "+").
    let phoneNumber: Int64
    /// Human-readable label for the number.
    var displayName: String
    /// User-supplied notes.
    var notes: String
    /// Tags (free-form strings).
    var tags: [String]
    /// ISO-8601 timestamp when the entry was created.
    let createdAt: Date
    /// ISO-8601 timestamp of last edit.
    var updatedAt: Date

    var phoneNumberE164: String { "+\(phoneNumber)" }

    var normalizedDigits: String { "\(phoneNumber)" }

    init(
        id: String = UUID().uuidString,
        phoneNumber: Int64,
        displayName: String = "",
        notes: String = "",
        tags: [String] = [],
        createdAt: Date = Date(),
        updatedAt: Date = Date()
    ) {
        self.id = id
        self.phoneNumber = phoneNumber
        self.displayName = displayName.trimmingCharacters(in: .whitespacesAndNewlines)
        self.notes = notes.trimmingCharacters(in: .whitespacesAndNewlines)
        self.tags = tags
        self.createdAt = createdAt
        self.updatedAt = updatedAt
    }
}

extension PersonalBlocklistEntry {
    nonisolated static func == (lhs: PersonalBlocklistEntry, rhs: PersonalBlocklistEntry) -> Bool {
        lhs.id == rhs.id
        && lhs.phoneNumber == rhs.phoneNumber
        && lhs.displayName == rhs.displayName
        && lhs.notes == rhs.notes
        && lhs.tags == rhs.tags
        && lhs.createdAt == rhs.createdAt
        && lhs.updatedAt == rhs.updatedAt
    }
}

// MARK: - Store

/// Manages the user's personal blocklist with iCloud Key-Value sync.
///
/// Primary storage: `NSUbiquitousKeyValueStore` (iCloud KV).
/// Shared local fallback: app-group `UserDefaults` so the app and extension stay in sync without iCloud.
/// Call `startObserving()` once per app launch to receive remote-change notifications.
final class PersonalBlocklistStore {
    static let shared = PersonalBlocklistStore()

    // MARK: Private

    private let storeKey = "personalBlocklist.entries.v1"
    private let encoder = JSONEncoder()
    private let decoder = JSONDecoder()
    private let legacyLocal = UserDefaults.standard
    /// `nil` when iCloud KV should not be touched (tests/extensions) or when iCloud is unavailable.
    /// Access only via `iCloudStore` which checks availability lazily.
    private lazy var iCloudStore: NSUbiquitousKeyValueStore? = {
        // NSUbiquitousKeyValueStore.default will crash ("BUG IN CLIENT OF KVS")
        // when the ubiquity-kvstore-identifier entitlement is missing. Unit tests and
        // the Call Directory extension must use only the shared app-group fallback.
        guard !Self.isRunningUnitTests,
              !Self.isRunningInAppExtension,
              FileManager.default.ubiquityIdentityToken != nil else {
            return nil
        }
        return NSUbiquitousKeyValueStore.default
    }()
    private let local: UserDefaults = {
        guard let sharedDefaults = UserDefaults(suiteName: SpamBlockerShared.appGroupIdentifier) else {
            return .standard
        }
        return sharedDefaults
    }()
    private var isObserving = false

    private init() {
        encoder.dateEncodingStrategy = .iso8601
        decoder.dateDecodingStrategy = .iso8601
        migrateLegacyLocalEntriesIfNeeded()
    }

    // MARK: Public API

    /// All personal entries, sorted newest-first.
    var entries: [PersonalBlocklistEntry] {
        get { load() }
        set { save(newValue) }
    }

    /// Begin listening for iCloud remote changes. Call once on app launch.
    func startObserving() {
        guard let store = iCloudStore, !isObserving else { return }
        isObserving = true
        NotificationCenter.default.addObserver(
            self,
            selector: #selector(iCloudDidChange(_:)),
            name: NSUbiquitousKeyValueStore.didChangeExternallyNotification,
            object: store
        )
        store.synchronize()
        mirrorICloudEntriesToLocalStore()
    }

    /// Add a new entry. Returns `false` if the number already exists.
    @discardableResult
    func add(_ entry: PersonalBlocklistEntry) -> Bool {
        var current = entries
        guard !current.contains(where: { $0.phoneNumber == entry.phoneNumber }) else {
            return false
        }
        current.insert(entry, at: 0)
        entries = current
        return true
    }

    /// Update an existing entry by matching `id`.
    func update(_ entry: PersonalBlocklistEntry) {
        var current = entries
        guard let index = current.firstIndex(where: { $0.id == entry.id }) else { return }
        var updated = entry
        updated = PersonalBlocklistEntry(
            id: entry.id,
            phoneNumber: entry.phoneNumber,
            displayName: entry.displayName,
            notes: entry.notes,
            tags: entry.tags,
            createdAt: entry.createdAt,
            updatedAt: Date()
        )
        current[index] = updated
        entries = current
    }

    /// Delete entries with the given IDs.
    func delete(ids: Set<String>) {
        entries = entries.filter { !ids.contains($0.id) }
    }

    /// Returns the entry matching the given E.164 digit-string (no "+"), if any.
    func entry(forDigits digits: String) -> PersonalBlocklistEntry? {
        guard let number = Int64(digits) else { return nil }
        return entries.first { $0.phoneNumber == number }
    }

    func exportJSONLines() throws -> Data {
        let exportEncoder = JSONEncoder()
        exportEncoder.dateEncodingStrategy = .iso8601
        exportEncoder.outputFormatting = [.sortedKeys, .withoutEscapingSlashes]

        let lines = try entries.map { entry in
            let record = PersonalBlocklistTransferRecord(
                id: entry.id,
                phoneNumber: entry.phoneNumberE164,
                displayName: entry.displayName,
                notes: entry.notes,
                tags: entry.tags,
                createdAt: entry.createdAt,
                updatedAt: entry.updatedAt
            )
            let encoded = try exportEncoder.encode(record)
            guard let line = String(data: encoded, encoding: .utf8) else {
                throw CocoaError(.fileWriteUnknown)
            }
            return line
        }

        return Data(lines.joined(separator: "\n").utf8)
    }

    func previewImport(from data: Data) throws -> PersonalBlocklistImportPreview {
        guard let contents = String(data: data, encoding: .utf8) else {
            throw CocoaError(.fileReadCorruptFile)
        }

        let currentEntries = entries
        let currentNumbers = Set(currentEntries.map(\.phoneNumber))
        var importedByNumber: [Int64: PersonalBlocklistEntry] = [:]
        var orderedNumbers: [Int64] = []
        var duplicateCountInImport = 0
        var parsedLineCount = 0

        for (index, rawLine) in contents.components(separatedBy: .newlines).enumerated() {
            let line = rawLine.trimmingCharacters(in: .whitespacesAndNewlines)
            guard !line.isEmpty else { continue }
            parsedLineCount += 1

            let lineData = Data(line.utf8)
            let record: PersonalBlocklistTransferRecord
            do {
                record = try decoder.decode(PersonalBlocklistTransferRecord.self, from: lineData)
            } catch {
                throw PersonalBlocklistTransferError.invalidLine(lineNumber: index + 1)
            }

            let entry: PersonalBlocklistEntry
            do {
                entry = try record.makeEntry()
            } catch {
                throw PersonalBlocklistTransferError.invalidPhoneNumber(lineNumber: index + 1)
            }

            if importedByNumber.updateValue(entry, forKey: entry.phoneNumber) == nil {
                orderedNumbers.append(entry.phoneNumber)
            } else {
                duplicateCountInImport += 1
            }
        }

        guard parsedLineCount > 0 else {
            throw PersonalBlocklistTransferError.emptyFile
        }

        let importedEntries = orderedNumbers.compactMap { importedByNumber[$0] }
        let updatesCount = importedEntries.filter { currentNumbers.contains($0.phoneNumber) }.count
        let additionsCount = importedEntries.count - updatesCount

        return PersonalBlocklistImportPreview(
            importedEntries: importedEntries,
            importedCount: importedEntries.count,
            additionsCount: additionsCount,
            updatesCount: updatesCount,
            duplicateCountInImport: duplicateCountInImport,
            currentCount: currentEntries.count,
            mergedTotalCount: currentEntries.count + additionsCount
        )
    }

    func mergeImportedEntries(using preview: PersonalBlocklistImportPreview) -> PersonalBlocklistImportResult {
        var mergedEntriesByNumber = Dictionary(uniqueKeysWithValues: entries.map { ($0.phoneNumber, $0) })

        for entry in preview.importedEntries {
            mergedEntriesByNumber[entry.phoneNumber] = entry
        }

        entries = mergedEntriesByNumber.values.sorted { lhs, rhs in
            if lhs.updatedAt != rhs.updatedAt {
                return lhs.updatedAt > rhs.updatedAt
            }
            return lhs.createdAt > rhs.createdAt
        }

        return PersonalBlocklistImportResult(
            importedCount: preview.importedCount,
            additionsCount: preview.additionsCount,
            updatesCount: preview.updatesCount,
            finalTotalCount: mergedEntriesByNumber.count
        )
    }

    // MARK: Private helpers

    private func load() -> [PersonalBlocklistEntry] {
        // Prefer iCloud KV; fall back to local UserDefaults
        if let store = iCloudStore,
           let data = store.data(forKey: storeKey),
           let decoded = try? decoder.decode([PersonalBlocklistEntry].self, from: data) {
            return decoded
        }
        if let data = local.data(forKey: storeKey),
           let decoded = try? decoder.decode([PersonalBlocklistEntry].self, from: data) {
            return decoded
        }
        return []
    }

    private func save(_ entries: [PersonalBlocklistEntry]) {
        guard let data = try? encoder.encode(entries) else { return }
        if let store = iCloudStore {
            store.set(data, forKey: storeKey)
            store.synchronize()
        }
        local.set(data, forKey: storeKey)
    }

    @objc private func iCloudDidChange(_ notification: Notification) {
        mirrorICloudEntriesToLocalStore()
        // Notify observers that the store changed so @Observable models can refresh.
        NotificationCenter.default.post(name: .personalBlocklistStoreDidChange, object: nil)
    }

    private func migrateLegacyLocalEntriesIfNeeded() {
        guard local !== legacyLocal,
              local.data(forKey: storeKey) == nil,
              let legacyData = legacyLocal.data(forKey: storeKey) else {
            return
        }

        local.set(legacyData, forKey: storeKey)
    }

    private func mirrorICloudEntriesToLocalStore() {
        guard let store = iCloudStore else { return }

        if let data = store.data(forKey: storeKey) {
            local.set(data, forKey: storeKey)
        } else {
            local.removeObject(forKey: storeKey)
        }
    }

    private static var isRunningUnitTests: Bool {
        ProcessInfo.processInfo.environment["XCTestConfigurationFilePath"] != nil
    }

    private static var isRunningInAppExtension: Bool {
        Bundle.main.infoDictionary?["NSExtension"] != nil
    }
}

extension Notification.Name {
    static let personalBlocklistStoreDidChange = Notification.Name("personalBlocklistStoreDidChange")
}

private struct PersonalBlocklistTransferRecord: Codable {
    let id: String?
    let phoneNumber: String
    let displayName: String?
    let notes: String?
    let tags: [String]?
    let createdAt: Date?
    let updatedAt: Date?

    private enum CodingKeys: String, CodingKey {
        case id
        case phoneNumber
        case displayName
        case notes
        case tags
        case createdAt
        case updatedAt
    }

    init(
        id: String?,
        phoneNumber: String,
        displayName: String?,
        notes: String?,
        tags: [String]?,
        createdAt: Date?,
        updatedAt: Date?
    ) {
        self.id = id
        self.phoneNumber = phoneNumber
        self.displayName = displayName
        self.notes = notes
        self.tags = tags
        self.createdAt = createdAt
        self.updatedAt = updatedAt
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        id = try container.decodeIfPresent(String.self, forKey: .id)
        displayName = try container.decodeIfPresent(String.self, forKey: .displayName)
        notes = try container.decodeIfPresent(String.self, forKey: .notes)
        tags = try container.decodeIfPresent([String].self, forKey: .tags)
        createdAt = try container.decodeIfPresent(Date.self, forKey: .createdAt)
        updatedAt = try container.decodeIfPresent(Date.self, forKey: .updatedAt)

        if let stringValue = try container.decodeIfPresent(String.self, forKey: .phoneNumber) {
            phoneNumber = stringValue
        } else if let numericValue = try container.decodeIfPresent(Int64.self, forKey: .phoneNumber) {
            phoneNumber = "\(numericValue)"
        } else {
            throw DecodingError.keyNotFound(
                CodingKeys.phoneNumber,
                .init(codingPath: decoder.codingPath, debugDescription: "phoneNumber is required")
            )
        }
    }

    func makeEntry() throws -> PersonalBlocklistEntry {
        guard let number = try? PhoneNumberNormalizer.normalizedE164Digits(from: phoneNumber) else {
            throw PersonalBlocklistTransferError.invalidPhoneNumber(lineNumber: 0)
        }

        let normalizedID = id?.trimmingCharacters(in: .whitespacesAndNewlines)
        let normalizedTags = (tags ?? [])
            .map { $0.trimmingCharacters(in: .whitespacesAndNewlines) }
            .filter { !$0.isEmpty }
        let createdAt = createdAt ?? Date()
        let updatedAt = updatedAt ?? createdAt

        return PersonalBlocklistEntry(
            id: normalizedID?.isEmpty == false ? normalizedID! : UUID().uuidString,
            phoneNumber: number,
            displayName: displayName ?? "",
            notes: notes ?? "",
            tags: normalizedTags,
            createdAt: createdAt,
            updatedAt: updatedAt
        )
    }
}
