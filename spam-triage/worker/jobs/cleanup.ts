import { refreshNumberStatsByIds } from "../lib/number-stats.ts";
import {
  AUDIT_RETENTION_DAYS,
  CLEANUP_BATCH_SIZE,
  CLEANUP_ID_CHUNK,
  CLEANUP_MAX_BATCHES,
  isoDaysAgo,
  MODERATION_RETENTION_DAYS,
  RECENT_REPORT_WINDOW_DAYS,
  REPORT_RETENTION_DAYS,
} from "../lib/policy.ts";
import { setSystemState } from "../lib/system-state.ts";
import type { Env } from "../types.ts";

export interface CleanupResult {
  reportsDeleted: number;
  contestsDeleted: number;
  removalRequestsDeleted: number;
  auditRowsDeleted: number;
}

function chunks<T>(values: T[], size: number): T[][] {
  const result: T[][] = [];
  for (let index = 0; index < values.length; index += size) {
    result.push(values.slice(index, index + size));
  }
  return result;
}

// Bounded retention cleanup. It first identifies affected numbers, then deletes
// all old reports for those numbers and rebuilds their aggregates in chunks.
export async function cleanupRetainedData(env: Env): Promise<CleanupResult> {
  const nowMs = Date.now();
  const now = new Date(nowMs).toISOString();
  const recentCutoff = isoDaysAgo(RECENT_REPORT_WINDOW_DAYS, nowMs);
  const reportCutoff = isoDaysAgo(REPORT_RETENTION_DAYS, nowMs);
  const result: CleanupResult = {
    reportsDeleted: 0,
    contestsDeleted: 0,
    removalRequestsDeleted: 0,
    auditRowsDeleted: 0,
  };

  for (let batch = 0; batch < CLEANUP_MAX_BATCHES; batch++) {
    const oldReports = await env.DB.prepare(
      "SELECT id, number_id FROM reports WHERE created_at < ? ORDER BY created_at ASC LIMIT ?",
    )
      .bind(reportCutoff, CLEANUP_BATCH_SIZE)
      .all<{ id: number; number_id: number }>();
    const rows = oldReports.results ?? [];
    if (rows.length === 0) break;

    for (const chunk of chunks(rows, CLEANUP_ID_CHUNK)) {
      const reportIds = chunk.map((row) => row.id);
      const numberIds = [...new Set(chunk.map((row) => row.number_id))];
      const placeholders = reportIds.map(() => "?").join(", ");
      const results = await env.DB.batch([
        env.DB.prepare(
          `DELETE FROM reports WHERE id IN (${placeholders})`,
        ).bind(...reportIds),
        refreshNumberStatsByIds(env.DB, numberIds, recentCutoff, now),
      ]);
      result.reportsDeleted += results[0]?.meta?.changes ?? 0;
    }

    if (rows.length < CLEANUP_BATCH_SIZE) break;
  }

  const moderationCutoff = isoDaysAgo(MODERATION_RETENTION_DAYS, nowMs);
  const moderationResults = await env.DB.batch([
    env.DB.prepare(
      `DELETE FROM removal_contests
        WHERE removal_request_id IN (
          SELECT rr.id FROM removal_requests rr
          WHERE rr.status IN ('approved', 'rejected')
            AND rr.updated_at < ?
            AND NOT EXISTS (
              SELECT 1 FROM numbers n WHERE n.removal_request_id = rr.id
            )
          ORDER BY rr.updated_at ASC
          LIMIT ?
        )`,
    ).bind(moderationCutoff, CLEANUP_BATCH_SIZE),
    env.DB.prepare(
      `DELETE FROM removal_requests
        WHERE id IN (
          SELECT rr.id FROM removal_requests rr
          WHERE rr.status IN ('approved', 'rejected')
            AND rr.updated_at < ?
            AND NOT EXISTS (
              SELECT 1 FROM numbers n WHERE n.removal_request_id = rr.id
            )
          ORDER BY rr.updated_at ASC
          LIMIT ?
        )`,
    ).bind(moderationCutoff, CLEANUP_BATCH_SIZE),
  ]);
  result.contestsDeleted = moderationResults[0]?.meta?.changes ?? 0;
  result.removalRequestsDeleted = moderationResults[1]?.meta?.changes ?? 0;

  const audit = await env.DB.prepare(
    `DELETE FROM admin_audit_log
      WHERE id IN (
        SELECT id FROM admin_audit_log
        WHERE created_at < ?
        ORDER BY created_at ASC
        LIMIT ?
      )`,
  )
    .bind(isoDaysAgo(AUDIT_RETENTION_DAYS, nowMs), CLEANUP_BATCH_SIZE)
    .run();
  result.auditRowsDeleted = audit.meta?.changes ?? 0;

  await setSystemState(env.DB, "cleanup_last_run", now, now);
  await setSystemState(
    env.DB,
    "cleanup_last_result",
    JSON.stringify(result),
    now,
  );

  return result;
}
