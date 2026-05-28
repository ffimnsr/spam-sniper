import { json, jsonError } from "../lib/http.ts";
import { readJsonObject } from "../lib/request.ts";
import { AdminResolveBodySchema } from "../lib/validation.ts";
import {
  getAdminRemovalRequestsApiPath,
} from "../../shared/admin-paths.ts";
import type { Env } from "../types.ts";

function requireAdmin(request: Request, env: Env): Response | null {
  const auth = request.headers.get("Authorization") ?? "";
  const token = auth.replace(/^Bearer\s+/i, "");
  if (!token || token !== env.ADMIN_PASSWORD) {
    return jsonError("Unauthorized", 401, "UNAUTHORIZED");
  }
  return null;
}

// Map DB category labels to community-core style labels
function mapCategory(cat: string): string {
  const map: Record<string, string> = {
    scam: "scam",
    phishing: "phishing",
    loan_spam: "loan spam",
    robocall: "robocall",
    impersonation: "impersonation",
    delivery_scam: "delivery scam",
    bank_scam: "bank scam",
    unknown: "unknown",
  };
  return map[cat] ?? cat;
}

export async function handleAdminSummary(
  request: Request,
  env: Env,
): Promise<Response> {
  if (request.method !== "GET") {
    return jsonError("Method not allowed", 405, "METHOD_NOT_ALLOWED");
  }

  const denied = requireAdmin(request, env);
  if (denied) return denied;

  const db = env.DB;

  const total = await db
    .prepare("SELECT COUNT(*) as count FROM numbers")
    .first<{ count: number }>();
  const pending = await db
    .prepare("SELECT COUNT(*) as count FROM numbers WHERE status = ?")
    .bind("pending")
    .first<{ count: number }>();
  const suspected = await db
    .prepare("SELECT COUNT(*) as count FROM numbers WHERE status = ?")
    .bind("suspected")
    .first<{ count: number }>();
  const verified = await db
    .prepare("SELECT COUNT(*) as count FROM numbers WHERE status = ?")
    .bind("verified_spam")
    .first<{ count: number }>();
  const underReview = await db
    .prepare("SELECT COUNT(*) as count FROM numbers WHERE status = ?")
    .bind("under_removal_review")
    .first<{ count: number }>();
  const disputed = await db
    .prepare("SELECT COUNT(*) as count FROM numbers WHERE status = ?")
    .bind("disputed")
    .first<{ count: number }>();
  const removed = await db
    .prepare("SELECT COUNT(*) as count FROM numbers WHERE status = ?")
    .bind("removed")
    .first<{ count: number }>();
  const openRR = await db
    .prepare("SELECT COUNT(*) as count FROM removal_requests WHERE status = ?")
    .bind("open")
    .first<{ count: number }>();
  const contestedRR = await db
    .prepare("SELECT COUNT(*) as count FROM removal_requests WHERE status = ?")
    .bind("contested")
    .first<{ count: number }>();

  return json({
    ok: true,
    totalNumbers: total?.count ?? 0,
    pending: pending?.count ?? 0,
    suspected: suspected?.count ?? 0,
    verifiedSpam: verified?.count ?? 0,
    underRemovalReview: underReview?.count ?? 0,
    disputed: disputed?.count ?? 0,
    removed: removed?.count ?? 0,
    openRemovalRequests: openRR?.count ?? 0,
    contestedRemovalRequests: contestedRR?.count ?? 0,
  });
}

export async function handleAdminRemovalRequests(
  request: Request,
  env: Env,
): Promise<Response> {
  if (request.method !== "GET") {
    return jsonError("Method not allowed", 405, "METHOD_NOT_ALLOWED");
  }

  const denied = requireAdmin(request, env);
  if (denied) return denied;

  const rows = await env.DB.prepare(
    `SELECT rr.id, rr.status, rr.reason, rr.contest_deadline, rr.created_at, n.display_mask,
				(SELECT COUNT(*) FROM removal_contests rc WHERE rc.removal_request_id = rr.id) as contest_count
			 FROM removal_requests rr
			 JOIN numbers n ON rr.number_id = n.id
			 WHERE rr.status IN ('open', 'contested')
			 ORDER BY rr.created_at DESC
			 LIMIT 100`,
  ).all<{
    id: number;
    status: string;
    reason: string;
    contest_deadline: string;
    created_at: string;
    display_mask: string;
    contest_count: number;
  }>();

  return json({ ok: true, requests: rows.results ?? [] });
}

export async function handleAdminResolve(
  request: Request,
  env: Env,
): Promise<Response> {
  if (request.method !== "POST") {
    return jsonError("Method not allowed", 405, "METHOD_NOT_ALLOWED");
  }

  const denied = requireAdmin(request, env);
  if (denied) return denied;

  const url = new URL(request.url);
  const adminRemovalRequestsApiPath = getAdminRemovalRequestsApiPath(
    env.HIDDEN_ADMIN_PATH,
  );
  const match = url.pathname.match(
    new RegExp(`^${adminRemovalRequestsApiPath}/(\\d+)/resolve$`),
  );
  if (!match) {
    return jsonError("Invalid removal request ID", 400, "VALIDATION_ERROR");
  }

  const id = Number(match[1]);
  if (!Number.isFinite(id) || id <= 0) {
    return jsonError("Invalid removal request ID", 400, "VALIDATION_ERROR");
  }

  const bodyResult = await readJsonObject(request);
  if (!bodyResult.ok) {
    return bodyResult.response;
  }

  const parsed = AdminResolveBodySchema.safeParse(bodyResult.value);
  if (!parsed.success) {
    return jsonError("Invalid request body", 400, "VALIDATION_ERROR");
  }

  const { action } = parsed.data;
  const now = new Date().toISOString();

  const rr = await env.DB.prepare(
    "SELECT id, number_id FROM removal_requests WHERE id = ?",
  )
    .bind(id)
    .first<{ id: number; number_id: number }>();

  if (!rr) {
    return jsonError("Removal request not found", 404, "NOT_FOUND");
  }

  if (action === "approve_removal") {
    await env.DB.prepare(
      "UPDATE removal_requests SET status = ?, updated_at = ? WHERE id = ?",
    )
      .bind("approved", now, id)
      .run();
    await env.DB.prepare(
      "UPDATE numbers SET status = ?, removal_request_id = NULL, updated_at = ? WHERE id = ?",
    )
      .bind("removed", now, rr.number_id)
      .run();
  } else if (action === "reject_removal") {
    await env.DB.prepare(
      "UPDATE removal_requests SET status = ?, updated_at = ? WHERE id = ?",
    )
      .bind("rejected", now, id)
      .run();
    // Recompute number status from unique reporter count
    const countRes = await env.DB.prepare(
      "SELECT COUNT(DISTINCT reporter_hash) as unique FROM reports WHERE number_id = ?",
    )
      .bind(rr.number_id)
      .first<{ unique: number }>();
    const unique = countRes?.unique ?? 0;
    let status = "pending";
    if (unique >= 3) status = "verified_spam";
    else if (unique === 2) status = "suspected";
    await env.DB.prepare(
      "UPDATE numbers SET status = ?, removal_request_id = NULL, updated_at = ? WHERE id = ?",
    )
      .bind(status, now, rr.number_id)
      .run();
  } else if (action === "mark_disputed") {
    await env.DB.prepare(
      "UPDATE removal_requests SET status = ?, updated_at = ? WHERE id = ?",
    )
      .bind("contested", now, id)
      .run();
    await env.DB.prepare(
      "UPDATE numbers SET status = ?, updated_at = ? WHERE id = ?",
    )
      .bind("disputed", now, rr.number_id)
      .run();
  }

  return json({ ok: true, action });
}

export async function handleAdminExport(
  request: Request,
  env: Env,
): Promise<Response> {
  if (request.method !== "GET") {
    return jsonError("Method not allowed", 405, "METHOD_NOT_ALLOWED");
  }

  const denied = requireAdmin(request, env);
  if (denied) return denied;

  // Query all verified_spam numbers
  const numbers = await env.DB.prepare(
    `SELECT n.id, n.phone_number_e164, n.display_mask, n.country_code, n.report_count, n.unique_reporter_count,
            n.first_reported_at, n.last_reported_at
     FROM numbers n
     WHERE n.status = 'verified_spam'
     ORDER BY n.unique_reporter_count DESC, n.last_reported_at DESC`,
  ).all<{
    id: number;
    phone_number_e164: string | null;
    display_mask: string;
    country_code: string | null;
    report_count: number;
    unique_reporter_count: number;
    first_reported_at: string;
    last_reported_at: string;
  }>();

  const rows = numbers.results ?? [];

  // For each number, get the most common report category
  const entries = [];
  for (const row of rows) {
    const catRes = await env.DB.prepare(
      `SELECT category, COUNT(*) as cnt
       FROM reports
       WHERE number_id = ?
       GROUP BY category
       ORDER BY cnt DESC
       LIMIT 1`,
    )
      .bind(row.id)
      .first<{ category: string; cnt: number }>();

    entries.push({
      phone_number_e164: row.phone_number_e164 ?? row.display_mask,
      display_mask: row.display_mask,
      category: catRes ? mapCategory(catRes.category) : "unknown",
      confidence: row.unique_reporter_count >= 5 ? "high" : "medium",
      report_count: row.report_count,
      unique_reporter_count: row.unique_reporter_count,
      country_code: row.country_code ?? undefined,
      first_reported_at: row.first_reported_at,
      last_reported_at: row.last_reported_at,
    });
  }

  const exportData = {
    ok: true,
    version: 1,
    generated_at: new Date().toISOString(),
    source: "SpamSniper Verified Spam Export",
    notes: [
      "Auto-generated export of all verified_spam entries from spam-triage.",
      "phone_number_e164 values use stored E.164 numbers.",
      "display_mask values are included for safe admin UI display.",
    ],
    total_entries: entries.length,
    entries,
  };

  return json(exportData);
}
