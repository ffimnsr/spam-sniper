import { getAdminRemovalRequestsApiPath } from "../../shared/admin-paths.ts";
import {
  constantTimeEqual,
  createAdminToken,
  verifyAdminToken,
} from "../lib/admin-auth.ts";
import { createE164Cipher } from "../lib/encryption.ts";
import { json, jsonError } from "../lib/http.ts";
import { enforceRateLimit } from "../lib/rate-limit.ts";
import { readJsonObject } from "../lib/request.ts";
import { computeNumberStatus } from "../lib/scoring.ts";
import { turnstileOptions, verifyTurnstile } from "../lib/turnstile.ts";
import {
  AdminLoginBodySchema,
  AdminResolveBodySchema,
} from "../lib/validation.ts";
import type { Env } from "../types.ts";

type ResolveAction = "approve_removal" | "reject_removal" | "mark_disputed";

const ALLOWED_TRANSITIONS: Record<ResolveAction, readonly string[]> = {
  approve_removal: ["open", "contested"],
  reject_removal: ["open", "contested"],
  mark_disputed: ["open"],
};

export function matchAdminResolvePath(
  pathname: string,
  removalRequestsApiPath: string,
): number | null {
  const prefix = `${removalRequestsApiPath}/`;
  const suffix = "/resolve";

  if (!pathname.startsWith(prefix) || !pathname.endsWith(suffix)) {
    return null;
  }

  const rawId = pathname.slice(prefix.length, -suffix.length);
  if (!/^[1-9]\d*$/.test(rawId)) {
    return null;
  }

  const id = Number(rawId);
  return Number.isSafeInteger(id) ? id : null;
}

async function requireAdmin(
  request: Request,
  env: Env,
): Promise<Response | null> {
  const authorization = request.headers.get("Authorization") ?? "";
  const token = /^Bearer\s+(\S+)$/i.exec(authorization)?.[1] ?? "";

  if (!token || !(await verifyAdminToken(env.HASH_SECRET, token))) {
    return jsonError("Unauthorized", 401, "UNAUTHORIZED");
  }

  return null;
}

async function getAdminSummaryData(env: Env) {
  const counts = await env.DB.prepare(
    `SELECT
       COUNT(*) AS total,
       COALESCE(SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END), 0) AS pending,
       COALESCE(SUM(CASE WHEN status = 'suspected' THEN 1 ELSE 0 END), 0) AS suspected,
       COALESCE(SUM(CASE WHEN status = 'verified_spam' THEN 1 ELSE 0 END), 0) AS verified_spam,
       COALESCE(SUM(CASE WHEN status = 'under_removal_review' THEN 1 ELSE 0 END), 0) AS under_removal_review,
       COALESCE(SUM(CASE WHEN status = 'disputed' THEN 1 ELSE 0 END), 0) AS disputed,
       COALESCE(SUM(CASE WHEN status = 'removed' THEN 1 ELSE 0 END), 0) AS removed,
       (SELECT COUNT(*) FROM removal_requests WHERE status = 'open') AS open_removal_requests,
       (SELECT COUNT(*) FROM removal_requests WHERE status = 'contested') AS contested_removal_requests
     FROM numbers`,
  ).first<{
    total: number;
    pending: number;
    suspected: number;
    verified_spam: number;
    under_removal_review: number;
    disputed: number;
    removed: number;
    open_removal_requests: number;
    contested_removal_requests: number;
  }>();

  return {
    ok: true as const,
    totalNumbers: counts?.total ?? 0,
    pending: counts?.pending ?? 0,
    suspected: counts?.suspected ?? 0,
    verifiedSpam: counts?.verified_spam ?? 0,
    underRemovalReview: counts?.under_removal_review ?? 0,
    disputed: counts?.disputed ?? 0,
    removed: counts?.removed ?? 0,
    openRemovalRequests: counts?.open_removal_requests ?? 0,
    contestedRemovalRequests: counts?.contested_removal_requests ?? 0,
  };
}

async function getAdminRemovalRequestsData(env: Env) {
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

  return rows.results ?? [];
}

export async function handleAdminLogin(
  request: Request,
  env: Env,
): Promise<Response> {
  if (request.method !== "POST") {
    return jsonError("Method not allowed", 405, "METHOD_NOT_ALLOWED");
  }

  const limited = await enforceRateLimit(env, request, "admin-login");
  if (limited) return limited;

  const bodyResult = await readJsonObject(request);
  if (!bodyResult.ok) {
    return bodyResult.response;
  }

  const parsed = AdminLoginBodySchema.safeParse(bodyResult.value);
  if (!parsed.success) {
    return jsonError("Invalid request body", 400, "VALIDATION_ERROR");
  }

  if (!env.HASH_SECRET || !env.ADMIN_PASSWORD) {
    return jsonError(
      "Admin authentication is not configured",
      500,
      "CONFIG_ERROR",
    );
  }

  const ip = request.headers.get("CF-Connecting-IP") ?? undefined;

  // Verify Turnstile before touching the password so unverified callers cannot
  // use this endpoint as a cheap password oracle.
  const turnstileOk = await verifyTurnstile(
    env.TURNSTILE_SECRET_KEY,
    parsed.data.turnstileToken,
    ip,
    turnstileOptions(env, request, "admin_login"),
  );
  if (!turnstileOk) {
    return jsonError("Turnstile verification failed", 400, "TURNSTILE_FAILED");
  }

  if (!(await constantTimeEqual(parsed.data.password, env.ADMIN_PASSWORD))) {
    return jsonError("Unauthorized", 401, "UNAUTHORIZED");
  }

  const { token, expiresAt } = await createAdminToken(env.HASH_SECRET);

  const [summary, requests] = await Promise.all([
    getAdminSummaryData(env),
    getAdminRemovalRequestsData(env),
  ]);

  return json({
    ok: true,
    token,
    expiresAt,
    summary,
    requests,
  });
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

  const denied = await requireAdmin(request, env);
  if (denied) return denied;

  return json(await getAdminSummaryData(env));
}

export async function handleAdminRemovalRequests(
  request: Request,
  env: Env,
): Promise<Response> {
  if (request.method !== "GET") {
    return jsonError("Method not allowed", 405, "METHOD_NOT_ALLOWED");
  }

  const denied = await requireAdmin(request, env);
  if (denied) return denied;

  return json({ ok: true, requests: await getAdminRemovalRequestsData(env) });
}

export async function handleAdminResolve(
  request: Request,
  env: Env,
): Promise<Response> {
  if (request.method !== "POST") {
    return jsonError("Method not allowed", 405, "METHOD_NOT_ALLOWED");
  }

  const denied = await requireAdmin(request, env);
  if (denied) return denied;

  const url = new URL(request.url);
  const id = matchAdminResolvePath(
    url.pathname,
    getAdminRemovalRequestsApiPath(env.HIDDEN_ADMIN_PATH),
  );
  if (id === null) {
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
    "SELECT id, number_id, status FROM removal_requests WHERE id = ?",
  )
    .bind(id)
    .first<{ id: number; number_id: number; status: string }>();

  if (!rr) {
    return jsonError("Removal request not found", 404, "NOT_FOUND");
  }

  if (!ALLOWED_TRANSITIONS[action].includes(rr.status)) {
    return jsonError(
      `Cannot apply ${action} to a removal request in status ${rr.status}`,
      409,
      "INVALID_STATE",
    );
  }

  const statements: D1PreparedStatement[] = [];
  let nextRemovalStatus: string;

  if (action === "approve_removal") {
    nextRemovalStatus = "approved";
    statements.push(
      env.DB.prepare(
        "UPDATE numbers SET status = ?, removal_request_id = NULL, updated_at = ? WHERE id = ?",
      ).bind("removed", now, rr.number_id),
    );
  } else if (action === "reject_removal") {
    nextRemovalStatus = "rejected";
    const countRes = await env.DB.prepare(
      "SELECT COUNT(DISTINCT reporter_hash) as unique FROM reports WHERE number_id = ?",
    )
      .bind(rr.number_id)
      .first<{ unique: number }>();

    statements.push(
      env.DB.prepare(
        "UPDATE numbers SET status = ?, removal_request_id = NULL, updated_at = ? WHERE id = ?",
      ).bind(
        computeNumberStatus(countRes?.unique ?? 0, "rejected"),
        now,
        rr.number_id,
      ),
    );
  } else {
    nextRemovalStatus = "contested";
    statements.push(
      env.DB.prepare(
        "UPDATE numbers SET status = ?, updated_at = ? WHERE id = ?",
      ).bind("disputed", now, rr.number_id),
    );
  }

  statements.unshift(
    env.DB.prepare(
      "UPDATE removal_requests SET status = ?, updated_at = ? WHERE id = ?",
    ).bind(nextRemovalStatus, now, id),
  );

  await env.DB.batch(statements);

  return json({ ok: true, action });
}

export async function handleAdminExport(
  request: Request,
  env: Env,
): Promise<Response> {
  if (request.method !== "GET") {
    return jsonError("Method not allowed", 405, "METHOD_NOT_ALLOWED");
  }

  const denied = await requireAdmin(request, env);
  if (denied) return denied;

  // Single round-trip: the correlated subquery picks the most common report
  // category per verified number instead of issuing one query per row.
  const numbers = await env.DB.prepare(
    `SELECT n.id, n.phone_number_enc, n.phone_number_e164, n.display_mask, n.country_code, n.report_count, n.unique_reporter_count,
            n.first_reported_at, n.last_reported_at,
            (SELECT r.category
               FROM reports r
              WHERE r.number_id = n.id
              GROUP BY r.category
              ORDER BY COUNT(*) DESC, r.category ASC
              LIMIT 1) AS top_category
     FROM numbers n
     WHERE n.status = 'verified_spam'
     ORDER BY n.unique_reporter_count DESC, n.last_reported_at DESC`,
  ).all<{
    id: number;
    phone_number_enc: string | null;
    phone_number_e164: string | null;
    display_mask: string;
    country_code: string | null;
    report_count: number;
    unique_reporter_count: number;
    first_reported_at: string;
    last_reported_at: string;
    top_category: string | null;
  }>();

  const cipher = createE164Cipher(env.HASH_SECRET);

  const entries = await Promise.all(
    (numbers.results ?? []).map(async (row) => {
      const decrypted = await cipher.decrypt(row.phone_number_enc);
      const e164 = decrypted ?? row.phone_number_e164 ?? row.display_mask;

      return {
        phone_number_e164: e164,
        display_mask: row.display_mask,
        category: row.top_category ? mapCategory(row.top_category) : "unknown",
        confidence: row.unique_reporter_count >= 5 ? "high" : "medium",
        report_count: row.report_count,
        unique_reporter_count: row.unique_reporter_count,
        country_code: row.country_code ?? undefined,
        first_reported_at: row.first_reported_at,
        last_reported_at: row.last_reported_at,
      };
    }),
  );

  const exportData = {
    ok: true,
    version: 1,
    generated_at: new Date().toISOString(),
    source: "SpamSniper Verified Spam Export",
    notes: [
      "Auto-generated export of all verified_spam entries from spam-triage.",
      "phone_number_e164 values are decrypted in memory for this export.",
      "display_mask values are included for safe admin UI display.",
    ],
    total_entries: entries.length,
    entries,
  };

  return json(exportData);
}
