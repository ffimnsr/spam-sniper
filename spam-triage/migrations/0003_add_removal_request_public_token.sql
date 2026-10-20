-- Public, unguessable token for removal request lookups. Numeric IDs stay
-- internal/admin-only so the public endpoints cannot be enumerated.
ALTER TABLE removal_requests ADD COLUMN public_token TEXT;

-- Backfill existing rows so old requests remain reachable through the new
-- public URL shape.
UPDATE removal_requests
SET public_token = lower(hex(randomblob(16)))
WHERE public_token IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_removal_requests_public_token
  ON removal_requests(public_token);
