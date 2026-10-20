import type { Env } from "../types.ts";

export async function finalizeRemovalRequests(env: Env): Promise<void> {
  const now = new Date().toISOString();

  const rows = await env.DB.prepare(
    `SELECT id, number_id FROM removal_requests
			 WHERE status = 'open' AND contest_deadline <= ?
			 ORDER BY contest_deadline ASC
			 LIMIT 100`,
  )
    .bind(now)
    .all<{ id: number; number_id: number }>();

  for (const rr of rows.results ?? []) {
    // Both transitions carry their own predicate, so a contest arriving
    // between the cron read and this write cannot be overridden.
    const results = await env.DB.batch([
      env.DB.prepare(
        `UPDATE removal_requests SET status = ?, updated_at = ?
         WHERE id = ? AND status = 'open'
           AND NOT EXISTS (SELECT 1 FROM removal_contests rc WHERE rc.removal_request_id = removal_requests.id)`,
      ).bind("approved", now, rr.id),
      env.DB.prepare(
        `UPDATE removal_requests SET status = ?, updated_at = ?
         WHERE id = ? AND status = 'open'
           AND EXISTS (SELECT 1 FROM removal_contests rc WHERE rc.removal_request_id = removal_requests.id)`,
      ).bind("contested", now, rr.id),
    ]);

    const approved = (results[0]?.meta?.changes ?? 0) > 0;
    const contested = (results[1]?.meta?.changes ?? 0) > 0;

    if (!approved && !contested) continue;

    if (approved) {
      await env.DB.prepare(
        "UPDATE numbers SET status = ?, removal_request_id = NULL, updated_at = ? WHERE id = ? AND (removal_request_id IS NULL OR removal_request_id = ?)",
      )
        .bind("removed", now, rr.number_id, rr.id)
        .run();
    } else {
      await env.DB.prepare(
        "UPDATE numbers SET status = ?, updated_at = ? WHERE id = ? AND (removal_request_id IS NULL OR removal_request_id = ?)",
      )
        .bind("disputed", now, rr.number_id, rr.id)
        .run();
    }
  }
}
