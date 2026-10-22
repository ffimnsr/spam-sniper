import {
  SUSPECTED_UNIQUE_REPORTERS,
  VERIFIED_UNIQUE_REPORTERS,
} from "./policy.ts";

// Recomputes every derived number column from the reports table. Used inside
// the report transaction and by the daily reconciliation/cleanup jobs so
// counters cannot drift from the source rows.
const NUMBER_STATS_SET = `
SET report_count = (
      SELECT COUNT(*) FROM reports WHERE number_id = numbers.id
    ),
    unique_reporter_count = (
      SELECT COUNT(DISTINCT reporter_hash) FROM reports WHERE number_id = numbers.id
    ),
    recent_unique_reporter_count = (
      SELECT COUNT(DISTINCT reporter_hash)
      FROM reports
      WHERE number_id = numbers.id AND created_at >= ?
    ),
    status = CASE
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
      WHEN (
        SELECT COUNT(DISTINCT reporter_hash)
        FROM reports
        WHERE number_id = numbers.id AND created_at >= ?
      ) >= ? THEN 'verified_spam'
      WHEN (
        SELECT COUNT(DISTINCT reporter_hash)
        FROM reports
        WHERE number_id = numbers.id AND created_at >= ?
      ) >= ? THEN 'suspected'
      ELSE 'pending'
    END,
    last_reported_at = COALESCE(
      (SELECT MAX(created_at) FROM reports WHERE number_id = numbers.id),
      first_reported_at
    ),
    status_checked_at = ?,
    updated_at = ?
`;

export const REFRESH_NUMBER_STATS_SQL = `
UPDATE numbers ${NUMBER_STATS_SET}
WHERE id = ?
`;

export const RECONCILE_NUMBER_STATS_SQL = `
UPDATE numbers ${NUMBER_STATS_SET}
WHERE id IN (
  SELECT id FROM numbers ORDER BY status_checked_at ASC, id ASC LIMIT ?
)
`;

function bindStatsValues(
  statement: D1PreparedStatement,
  recentCutoff: string,
  now: string,
  target: number,
): D1PreparedStatement {
  return statement.bind(
    recentCutoff,
    recentCutoff,
    VERIFIED_UNIQUE_REPORTERS,
    recentCutoff,
    SUSPECTED_UNIQUE_REPORTERS,
    now,
    now,
    target,
  );
}

export function bindRefreshNumberStats(
  statement: D1PreparedStatement,
  numberId: number,
  recentCutoff: string,
  now: string,
): D1PreparedStatement {
  return bindStatsValues(statement, recentCutoff, now, numberId);
}

export function refreshNumberStats(
  db: D1Database,
  numberId: number,
  recentCutoff: string,
  now: string,
): D1PreparedStatement {
  return bindRefreshNumberStats(
    db.prepare(REFRESH_NUMBER_STATS_SQL),
    numberId,
    recentCutoff,
    now,
  );
}

export function reconcileNumberStats(
  db: D1Database,
  limit: number,
  recentCutoff: string,
  now: string,
): D1PreparedStatement {
  return bindStatsValues(
    db.prepare(RECONCILE_NUMBER_STATS_SQL),
    recentCutoff,
    now,
    limit,
  );
}

// Refreshes an explicit id set after retention deletes. Callers chunk ids so
// the stats bindings plus ids stay below D1's bound-parameter limit.
export function refreshNumberStatsByIds(
  db: D1Database,
  numberIds: number[],
  recentCutoff: string,
  now: string,
): D1PreparedStatement {
  const placeholders = numberIds.map(() => "?").join(", ");
  return db
    .prepare(`UPDATE numbers ${NUMBER_STATS_SET} WHERE id IN (${placeholders})`)
    .bind(
      recentCutoff,
      recentCutoff,
      VERIFIED_UNIQUE_REPORTERS,
      recentCutoff,
      SUSPECTED_UNIQUE_REPORTERS,
      now,
      now,
      ...numberIds,
    );
}
