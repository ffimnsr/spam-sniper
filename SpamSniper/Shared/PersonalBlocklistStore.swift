import Foundation

// MARK: - Model

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

// MARK: - Store

/// Manages the user's personal blocklist with iCloud Key-Value sync.
///
/// Primary storage: `NSUbiquitousKeyValueStore` (iCloud KV).
/// Local fallback: `UserDefaults` (same key) so it works without iCloud.
/// Call `startObserving()` once per app launch to receive remote-change notifications.
final class PersonalBlocklistStore {
    static let shared = PersonalBlocklistStore()

    // MARK: Private

    private let storeKey = "personalBlocklist.entries.v1"
    private let encoder = JSONEncoder()
    private let decoder = JSONDecoder()
    private let iCloud = NSUbiquitousKeyValueStore.default
    private let local = UserDefaults.standard

    private init() {
        encoder.dateEncodingStrategy = .iso8601
        decoder.dateDecodingStrategy = .iso8601
    }

    // MARK: Public API

    /// All personal entries, sorted newest-first.
    var entries: [PersonalBlocklistEntry] {
        get { load() }
        set { save(newValue) }
    }

    /// Begin listening for iCloud remote changes. Call once on app launch.
    func startObserving() {
        NotificationCenter.default.addObserver(
            self,
            selector: #selector(iCloudDidChange(_:)),
            name: NSUbiquitousKeyValueStore.didChangeExternallyNotification,
            object: iCloud
        )
        iCloud.synchronize()
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

    // MARK: Private helpers

    private func load() -> [PersonalBlocklistEntry] {
        // Prefer iCloud KV; fall back to local UserDefaults
        if let data = iCloud.data(forKey: storeKey),
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
        iCloud.set(data, forKey: storeKey)
        local.set(data, forKey: storeKey)
        iCloud.synchronize()
    }

    @objc private func iCloudDidChange(_ notification: Notification) {
        // Notify observers that the store changed so @Observable models can refresh.
        NotificationCenter.default.post(name: .personalBlocklistStoreDidChange, object: nil)
    }
}

extension Notification.Name {
    static let personalBlocklistStoreDidChange = Notification.Name("personalBlocklistStoreDidChange")
}
