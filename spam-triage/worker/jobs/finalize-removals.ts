import {
  FINALIZER_BATCH_SIZE,
  FINALIZER_MAX_BATCHES,
  isoDaysAgo,
  RECENT_REPORT_WINDOW_DAYS,
  VERIFIED_UNIQUE_REPORTERS,
} from "../lib/policy.ts";
import { setSystemState } from "../lib/system-state.ts";
import type { Env } from "../types.ts";

export interface FinalizeResult {
  processed: number;
  approved: number;
  pendingReview: number;
  contested: number;
}

interface StatusCountRow {
  status: string;
  count: number;
}

// Set-based finalizer. It resolves one bounded batch per statement group and
// repeats up to FINALIZER_MAX_BATCHES so a backlog can drain without exceeding
// D1's per-invocation query budget.
export async function finalizeRemovalRequests(
  env: Env,
): Promise<FinalizeResult> {
  const nowMs = Date.now();
  const now = new Date(nowMs).toISOString();
  const recentCutoff = isoDaysAgo(RECENT_REPORT_WINDOW_DAYS, nowMs);
  const result: FinalizeResult = {
    processed: 0,
    approved: 0,
    pendingReview: 0,
    contested: 0,
  };

  const dueIds = `(
    SELECT id FROM removal_requests
    WHERE status = 'open' AND contest_deadline <= ?
    ORDER BY contest_deadline ASC, id ASC
    LIMIT ?
  )`;

  for (let batch = 0; batch < FINALIZER_MAX_BATCHES; batch++) {
    const runId = crypto.randomUUID();
    const [, counts] = await env.DB.batch([
      env.DB.prepare(
        `UPDATE removal_requests
            SET status = CASE
                  WHEN EXISTS (
                    SELECT 1 FROM removal_contests rc
                    WHERE rc.removal_request_id = removal_requests.id
                  ) THEN 'contested'
                  WHEN (
                    SELECT COUNT(DISTINCT reporter_hash) FROM reports
                    WHERE number_id = removal_requests.number_id
                      AND created_at >= ?
                  ) >= ? THEN 'pending_review'
                  ELSE 'approved'
                END,
                updated_at = ?,
                finalize_run_id = ?
          WHERE id IN ${dueIds}
            AND status = 'open'`,
      ).bind(
        recentCutoff,
        VERIFIED_UNIQUE_REPORTERS,
        now,
        runId,
        now,
        FINALIZER_BATCH_SIZE,
      ),
      env.DB.prepare(
        `SELECT status, COUNT(*) AS count FROM removal_requests
          WHERE finalize_run_id = ?
            AND status IN ('contested', 'approved', 'pending_review')
          GROUP BY status`,
      ).bind(runId),
      env.DB.prepare(
        `UPDATE numbers
            SET status = CASE (
                  SELECT rr.status FROM removal_requests rr
                  WHERE rr.number_id = numbers.id AND rr.finalize_run_id = ?
                  ORDER BY rr.id DESC
                  LIMIT 1
                )
                  WHEN 'contested' THEN 'disputed'
                  WHEN 'approved' THEN 'removed'
                  WHEN 'pending_review' THEN 'under_removal_review'
                  ELSE status
                END,
                removal_request_id = CASE
                  WHEN removal_request_id IS NULL THEN (
                    SELECT rr.id FROM removal_requests rr
                    WHERE rr.number_id = numbers.id AND rr.finalize_run_id = ?
                    ORDER BY rr.id DESC
                    LIMIT 1
                  )
                  ELSE removal_request_id
                END,
                updated_at = ?,
                status_checked_at = ?
          WHERE id IN (
            SELECT number_id FROM removal_requests
            WHERE finalize_run_id = ?
              AND status IN ('contested', 'approved', 'pending_review')
          )
            AND status != 'removed'
            AND (
              removal_request_id IS NULL
              OR removal_request_id IN (
                SELECT id FROM removal_requests WHERE finalize_run_id = ?
              )
            )`,
      ).bind(runId, runId, now, now, runId, runId),
      env.DB.prepare(
        `INSERT INTO admin_audit_log
           (actor, action, target_type, target_id, metadata, created_at)
         SELECT 'system', 'finalize_removal', 'removal_request', rr.id, NULL, ?
           FROM removal_requests rr
          WHERE rr.finalize_run_id = ?
            AND rr.status IN ('contested', 'approved', 'pending_review')`,
      ).bind(now, runId),
    ]);

    const batchCounts = (counts?.results ?? []) as StatusCountRow[];
    const batchProcessed = batchCounts.reduce(
      (total, row) => total + row.count,
      0,
    );

    for (const row of batchCounts) {
      if (row.status === "approved") result.approved += row.count;
      else if (row.status === "pending_review")
        result.pendingReview += row.count;
      else if (row.status === "contested") result.contested += row.count;
    }
    result.processed += batchProcessed;

    // Stop when the queue is empty or the final partial batch was reached.
    if (batchProcessed === 0 || batchProcessed < FINALIZER_BATCH_SIZE) break;
  }

  await setSystemState(env.DB, "finalizer_last_run", now, now);
  await setSystemState(
    env.DB,
    "finalizer_last_result",
    JSON.stringify(result),
    now,
  );

  return result;
}
