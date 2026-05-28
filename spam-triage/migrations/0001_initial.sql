-- Initial schema for spam-triage
-- Numbers table: stores hashed phone numbers and their status
CREATE TABLE IF NOT EXISTS numbers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  number_hash TEXT NOT NULL UNIQUE,
  display_mask TEXT NOT NULL,
  country_code TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  report_count INTEGER NOT NULL DEFAULT 0,
  unique_reporter_count INTEGER NOT NULL DEFAULT 0,
  removal_request_id INTEGER,
  first_reported_at TEXT NOT NULL,
  last_reported_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_numbers_status ON numbers(status);

-- Reports table: stores individual spam reports
CREATE TABLE IF NOT EXISTS reports (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  number_id INTEGER NOT NULL,
  reporter_hash TEXT NOT NULL,
  category TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY (number_id) REFERENCES numbers(id),
  UNIQUE(number_id, reporter_hash)
);

CREATE INDEX IF NOT EXISTS idx_reports_number_id ON reports(number_id);

-- Removal requests table: stores requests to remove numbers
CREATE TABLE IF NOT EXISTS removal_requests (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  number_id INTEGER NOT NULL,
  requester_hash TEXT NOT NULL,
  reason TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open',
  contest_deadline TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (number_id) REFERENCES numbers(id)
);

CREATE INDEX IF NOT EXISTS idx_removal_requests_status_deadline ON removal_requests(status, contest_deadline);
CREATE INDEX IF NOT EXISTS idx_removal_requests_number_id ON removal_requests(number_id);

-- Removal contests table: stores contests against removal requests
CREATE TABLE IF NOT EXISTS removal_contests (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  removal_request_id INTEGER NOT NULL,
  contestant_hash TEXT NOT NULL,
  reason TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY (removal_request_id) REFERENCES removal_requests(id),
  UNIQUE(removal_request_id, contestant_hash)
);

CREATE INDEX IF NOT EXISTS idx_removal_contests_request_id ON removal_contests(removal_request_id);
