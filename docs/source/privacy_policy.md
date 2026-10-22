# Privacy Policy

**Effective date:** October 22, 2026

## Summary

SpamSniper is designed to block unwanted calls without building a user profile.

The app does not run analytics, advertising SDKs, or background tracking. It does not upload your personal blocklist entries, your contacts, or your call history to a SpamSniper-operated server.

## Spam Triage Terminal

The optional Spam Sniper Triage Terminal lets people check, report, and challenge spam caller numbers. It stores only the minimum data needed to operate that community list.

When you submit a phone number, the Triage Terminal normalizes it in memory, stores a keyed HMAC-SHA256 lookup hash, stores the E.164 value encrypted with AES-GCM, and stores a masked display string. The raw phone number is not stored in plain text. Legacy rows that predate this encryption are encrypted by a bounded maintenance job.

The Triage Terminal also stores a reporter identifier. That identifier is a keyed HMAC-SHA256 hash derived from the request IP address. It is stored as `reporter_hash`, `requester_hash`, or `contestant_hash`.

The IP address is not retained. It is used only for abuse prevention (Turnstile and rate limiting) and to derive that keyed reporter identifier for the report, removal request, or contest being submitted.

The reporter identifier is used only to operate the community list: preventing duplicate reports, counting independent reporters for confidence, enforcing one contest per removal request per reporter, and applying limits or cooldowns on removal requests. It is not used for profiling, analytics, advertising, cross-site tracking, or marketing, and it is not sold or shared.

Cloudflare may process request metadata at its edge to provide security, abuse prevention, and network delivery under Cloudflare's own terms.

Cloudflare Turnstile protects public submissions. The operator dashboard is protected by Cloudflare Access. Cloudflare therefore processes limited request metadata when these features are used.

Authorized operators can export verified spam entries, including full E.164 values, from the protected dashboard. The export is generated in memory and is not stored by the terminal.

- Report rows are retained for up to 12 months for duplicate-report prevention and confidence calculations, then purged in bounded maintenance batches.
- Resolved moderation records are retained for up to 12 months, subject to references needed for a number's current status.
- Administrator audit records are retained for up to 24 months and include the Cloudflare Access operator email for dashboard actions.
- Aggregated counters and masked number records may be retained while the number remains in the triage database.

Fonts used by the Triage Terminal and this documentation are self-hosted. Neither loads third-party font services.

## What SpamSniper Stores On Your Device

SpamSniper stores app data locally so call blocking can work on iPhone. That local data can include:

- repository selections
- downloaded blocklist data
- your personal blocked numbers and notes
- app settings related to sync and call blocking

This data stays on your device and is used only to build the final block list loaded into the iOS Call Directory extension.

## What SpamSniper Does Not Collect

SpamSniper does not collect or retain:

- account information
- contact lists copied to a remote server
- message contents
- call recordings
- usage analytics
- ad identifiers
- crash reporting telemetry
- location data

## Network Activity

SpamSniper may connect to a blocklist repository that you choose or that is bundled with the app. Those requests are used to download repository metadata, blocklist files, and signature files so the app can verify and import the data.

SpamSniper does not send your personal blocklist entries as part of that process.

## Contacts Access

If you grant Contacts permission, SpamSniper uses it only to avoid blocking numbers that already exist in your address book. Contact data is checked on-device and is not uploaded by the app.

If you do not grant Contacts permission, SpamSniper still works. It just cannot automatically exclude saved contacts from synced blocklists.

## Third-Party Services

SpamSniper does not use third-party advertising networks or behavioral tracking services.

The app may depend on third-party software components for local functionality, such as signature verification, but those components are not used to profile you.

## Data Sharing

SpamSniper does not sell personal data. It does not share your personal blocklist entries with data brokers, advertisers, or analytics vendors.

## Changes to This Policy

If the app's privacy behavior changes in a material way, this policy will be updated before the new behavior is shipped or enabled.

## Contact

For privacy questions, open an issue on GitHub:

- https://github.com/ffimnsr/spam-sniper/issues
