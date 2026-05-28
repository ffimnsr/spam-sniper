import type { Env } from "../types.ts";

export async function finalizeRemovalRequests(env: Env): Promise<void> {
  const now = new Date().toISOString();

  const rows = await env.DB.prepare(
    `SELECT id, number_id FROM removal_requests
			 WHERE status = 'open' AND contest_deadline <= ?
			 LIMIT 100`,
  )
    .bind(now)
    .all<{ id: number; number_id: number }>();

  for (const rr of rows.results ?? []) {
    const contestRes = await env.DB.prepare(
      "SELECT COUNT(*) as count FROM removal_contests WHERE removal_request_id = ?",
    )
      .bind(rr.id)
      .first<{ count: number }>();

    const contestCount = contestRes?.count ?? 0;

    if (contestCount === 0) {
      await env.DB.prepare(
        "UPDATE removal_requests SET status = ?, updated_at = ? WHERE id = ?",
      )
        .bind("approved", now, rr.id)
        .run();
      await env.DB.prepare(
        "UPDATE numbers SET status = ?, removal_request_id = NULL, updated_at = ? WHERE id = ?",
      )
        .bind("removed", now, rr.number_id)
        .run();
    } else {
      await env.DB.prepare(
        "UPDATE removal_requests SET status = ?, updated_at = ? WHERE id = ?",
      )
        .bind("contested", now, rr.id)
        .run();
      await env.DB.prepare(
        "UPDATE numbers SET status = ?, updated_at = ? WHERE id = ?",
      )
        .bind("disputed", now, rr.number_id)
        .run();
    }
  }
}
