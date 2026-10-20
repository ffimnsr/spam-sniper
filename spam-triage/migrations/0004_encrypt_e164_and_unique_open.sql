-- Encrypted-at-rest E.164 storage. New writes populate phone_number_enc and
-- leave phone_number_e164 NULL; the scheduled job migrates legacy plaintext.
ALTER TABLE numbers ADD COLUMN phone_number_enc TEXT;

-- The previous create flow was a racy check-then-insert. If it produced more
-- than one open request for a number, keep the oldest and reject the rest so
-- the unique index below can be created without a failed deploy.
UPDATE removal_requests
SET status = 'rejected',
    updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
WHERE status = 'open'
  AND id NOT IN (
    SELECT MIN(id)
    FROM removal_requests
    WHERE status = 'open'
    GROUP BY number_id
  );

-- Repoint numbers that referenced a rejected duplicate at the surviving open
-- request, or clear the pointer when no open request remains. Only rows that
-- point at rejected requests are touched; contested/approved links stay intact.
UPDATE numbers
SET removal_request_id = (
  SELECT MIN(rr.id)
  FROM removal_requests rr
  WHERE rr.number_id = numbers.id AND rr.status = 'open'
)
WHERE removal_request_id IN (
  SELECT id FROM removal_requests WHERE status = 'rejected'
);

-- Enforce the "one open removal request per number" rule in the database so a
-- concurrent check-then-insert cannot create duplicates.
CREATE UNIQUE INDEX IF NOT EXISTS idx_removal_requests_open_per_number
  ON removal_requests(number_id) WHERE status = 'open';
