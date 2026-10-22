-- Recent-activity status, maintenance cursors, audit trail, and integrity
-- checks for status/category/reason values.

ALTER TABLE numbers ADD COLUMN recent_unique_reporter_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE numbers ADD COLUMN status_checked_at TEXT NOT NULL DEFAULT '';
ALTER TABLE numbers ADD COLUMN legacy_migration_checked_at TEXT NOT NULL DEFAULT '';
ALTER TABLE removal_requests ADD COLUMN finalize_run_id TEXT;

CREATE TABLE IF NOT EXISTS system_state (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS admin_audit_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  actor TEXT NOT NULL,
  action TEXT NOT NULL,
  target_type TEXT NOT NULL,
  target_id INTEGER,
  metadata TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_admin_audit_log_created
  ON admin_audit_log(created_at);

-- status_checked_at drives the bounded daily reconciliation cursor.
CREATE INDEX IF NOT EXISTS idx_numbers_status_checked_at
  ON numbers(status_checked_at, id);

CREATE INDEX IF NOT EXISTS idx_numbers_legacy_migration_checked
  ON numbers(legacy_migration_checked_at, id);

-- Export ordering: verified rows by confidence, then recency.
CREATE INDEX IF NOT EXISTS idx_numbers_export
  ON numbers(status, unique_reporter_count DESC, last_reported_at DESC);

CREATE INDEX IF NOT EXISTS idx_reports_created_at
  ON reports(created_at);

CREATE INDEX IF NOT EXISTS idx_reports_number_created
  ON reports(number_id, created_at, reporter_hash);

-- Leftmost prefix of UNIQUE(number_id, reporter_hash) already covers this.
DROP INDEX IF EXISTS idx_reports_number_id;

CREATE INDEX IF NOT EXISTS idx_removal_requests_requester_created
  ON removal_requests(requester_hash, created_at);

CREATE INDEX IF NOT EXISTS idx_removal_requests_finalize_run
  ON removal_requests(finalize_run_id);

-- Old approve paths cleared removal_request_id. Relink removed numbers to their
-- latest approved request so the removal record stays durable and referenced.
UPDATE numbers
SET removal_request_id = (
  SELECT rr.id FROM removal_requests rr
  WHERE rr.number_id = numbers.id AND rr.status = 'approved'
  ORDER BY rr.updated_at DESC, rr.id DESC
  LIMIT 1
)
WHERE status = 'removed'
  AND removal_request_id IS NULL
  AND EXISTS (
    SELECT 1 FROM removal_requests rr
    WHERE rr.number_id = numbers.id AND rr.status = 'approved'
  );

-- Backfill recent counts from the report window.
UPDATE numbers
SET recent_unique_reporter_count = (
      SELECT COUNT(DISTINCT reporter_hash)
      FROM reports
      WHERE reports.number_id = numbers.id
        AND reports.created_at >= strftime('%Y-%m-%dT%H:%M:%fZ', 'now', '-90 days')
    ),
    status_checked_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now');

-- Recalculate statuses from recent activity. Removed rows that still reference
-- an approved request stay removed.
UPDATE numbers
SET status = CASE
  WHEN status = 'removed' THEN 'removed'
  WHEN removal_request_id IS NOT NULL THEN
    CASE (
      SELECT status FROM removal_requests
      WHERE id = numbers.removal_request_id
    )
      WHEN 'contested' THEN 'disputed'
      WHEN 'open' THEN 'under_removal_review'
      WHEN 'pending_review' THEN 'under_removal_review'
      WHEN 'approved' THEN 'removed'
      ELSE status
    END
  WHEN recent_unique_reporter_count >= 3 THEN 'verified_spam'
  WHEN recent_unique_reporter_count >= 2 THEN 'suspected'
  ELSE 'pending'
END;

-- Keep enum values consistent even if a future caller bypasses Zod/constants.

CREATE TRIGGER IF NOT EXISTS trg_numbers_status_insert
BEFORE INSERT ON numbers
WHEN NEW.status NOT IN (
  'pending', 'suspected', 'verified_spam',
  'under_removal_review', 'removed', 'disputed'
)
BEGIN
  SELECT RAISE(ABORT, 'invalid number status');
END;

CREATE TRIGGER IF NOT EXISTS trg_numbers_status_update
BEFORE UPDATE OF status ON numbers
WHEN NEW.status NOT IN (
  'pending', 'suspected', 'verified_spam',
  'under_removal_review', 'removed', 'disputed'
)
BEGIN
  SELECT RAISE(ABORT, 'invalid number status');
END;

CREATE TRIGGER IF NOT EXISTS trg_reports_category_insert
BEFORE INSERT ON reports
WHEN NEW.category NOT IN (
  'scam', 'phishing', 'loan_spam', 'robocall',
  'impersonation', 'delivery_scam', 'bank_scam', 'unknown'
)
BEGIN
  SELECT RAISE(ABORT, 'invalid report category');
END;

CREATE TRIGGER IF NOT EXISTS trg_reports_category_update
BEFORE UPDATE OF category ON reports
WHEN NEW.category NOT IN (
  'scam', 'phishing', 'loan_spam', 'robocall',
  'impersonation', 'delivery_scam', 'bank_scam', 'unknown'
)
BEGIN
  SELECT RAISE(ABORT, 'invalid report category');
END;

CREATE TRIGGER IF NOT EXISTS trg_removal_requests_status_insert
BEFORE INSERT ON removal_requests
WHEN NEW.status NOT IN (
  'open', 'pending_review', 'approved', 'rejected', 'contested'
)
BEGIN
  SELECT RAISE(ABORT, 'invalid removal request status');
END;

CREATE TRIGGER IF NOT EXISTS trg_removal_requests_status_update
BEFORE UPDATE OF status ON removal_requests
WHEN NEW.status NOT IN (
  'open', 'pending_review', 'approved', 'rejected', 'contested'
)
BEGIN
  SELECT RAISE(ABORT, 'invalid removal request status');
END;

CREATE TRIGGER IF NOT EXISTS trg_removal_requests_reason_insert
BEFORE INSERT ON removal_requests
WHEN NEW.reason NOT IN (
  'personal_number', 'incorrect_report', 'recycled_number',
  'legitimate_business', 'other'
)
BEGIN
  SELECT RAISE(ABORT, 'invalid removal reason');
END;

CREATE TRIGGER IF NOT EXISTS trg_removal_requests_reason_update
BEFORE UPDATE OF reason ON removal_requests
WHEN NEW.reason NOT IN (
  'personal_number', 'incorrect_report', 'recycled_number',
  'legitimate_business', 'other'
)
BEGIN
  SELECT RAISE(ABORT, 'invalid removal reason');
END;

CREATE TRIGGER IF NOT EXISTS trg_removal_contests_reason_insert
BEFORE INSERT ON removal_contests
WHEN NEW.reason NOT IN (
  'still_spam', 'recent_spam_call', 'known_scam_number', 'other'
)
BEGIN
  SELECT RAISE(ABORT, 'invalid contest reason');
END;

CREATE TRIGGER IF NOT EXISTS trg_removal_contests_reason_update
BEFORE UPDATE OF reason ON removal_contests
WHEN NEW.reason NOT IN (
  'still_spam', 'recent_spam_call', 'known_scam_number', 'other'
)
BEGIN
  SELECT RAISE(ABORT, 'invalid contest reason');
END;
