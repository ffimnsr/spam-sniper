import { hashNumber, hashNumberCandidates } from "../lib/hash.ts";
import { json, jsonError } from "../lib/http.ts";
import { normalizePhone } from "../lib/phone.ts";
import { isoDaysAgo, RECENT_REPORT_WINDOW_DAYS } from "../lib/policy.ts";
import { enforceRateLimit } from "../lib/rate-limit.ts";
import { readJsonObject } from "../lib/request.ts";
import { computeNumberStatus, isRemovalRequestStatus } from "../lib/scoring.ts";
import { turnstileOptions, verifyTurnstile } from "../lib/turnstile.ts";
import { CheckQuerySchema } from "../lib/validation.ts";
import type { Env } from "../types.ts";

interface CheckRow {
  display_mask: string;
  status: string;
  report_count: number;
  unique_reporter_count: number;
  recent_unique_reporter_count: number;
  removal_request_id: number | null;
  removal_status: string | null;
  contest_deadline: string | null;
}

function placeholders(count: number): string {
  return Array.from({ length: count }, () => "?").join(", ");
}

export async function handleCheckNumber(
  request: Request,
  env: Env,
): Promise<Response> {
  if (request.method !== "POST") {
    return jsonError("Method not allowed", 405, "METHOD_NOT_ALLOWED");
  }

  const limited = await enforceRateLimit(env, request, "numbers-check", "read");
  if (limited) return limited;

  const bodyResult = await readJsonObject(request);
  if (!bodyResult.ok) {
    return bodyResult.response;
  }

  const parsed = CheckQuerySchema.safeParse(bodyResult.value);
  if (!parsed.success) {
    return jsonError("Invalid request body", 400, "VALIDATION_ERROR");
  }

  const ip = request.headers.get("CF-Connecting-IP") ?? undefined;
  const turnstileOk = await verifyTurnstile(
    env.TURNSTILE_SECRET_KEY,
    parsed.data.turnstileToken,
    ip,
    turnstileOptions(env, request, "check"),
  );
  if (!turnstileOk) {
    return jsonError("Turnstile verification failed", 400, "TURNSTILE_FAILED");
  }

  let normalized: { e164: string; displayMask: string };
  try {
    normalized = normalizePhone(parsed.data.number, parsed.data.country);
  } catch {
    return jsonError("Invalid phone number", 400, "INVALID_PHONE_NUMBER");
  }

  const currentHash = await hashNumber(env.HASH_SECRET, normalized.e164);
  const hashes = await hashNumberCandidates(
    env.HASH_SECRET,
    env.HASH_SECRET_PREVIOUS,
    normalized.e164,
  );
  const recentCutoff = isoDaysAgo(RECENT_REPORT_WINDOW_DAYS);

  // One indexed lookup resolves number state, a fresh recent-report count, and
  // any linked removal request. Public status is derived from recent activity
  // so it cannot stay stale until the reconcile cursor reaches this row.
  const row = await env.DB.prepare(
    `SELECT n.display_mask, n.status, n.report_count, n.unique_reporter_count,
            (
              SELECT COUNT(DISTINCT reporter_hash) FROM reports
              WHERE number_id = n.id AND created_at >= ?
            ) AS recent_unique_reporter_count,
            n.removal_request_id,
            rr.status AS removal_status, rr.contest_deadline
       FROM numbers n
       LEFT JOIN removal_requests rr ON rr.id = n.removal_request_id
      WHERE n.number_hash IN (${placeholders(hashes.length)})
      ORDER BY CASE WHEN n.number_hash = ? THEN 0 ELSE 1 END
      LIMIT 1`,
  )
    .bind(recentCutoff, ...hashes, currentHash)
    .first<CheckRow>();

  if (!row) {
    return json({ ok: true, found: false });
  }

  const removalStatus = isRemovalRequestStatus(row.removal_status)
    ? row.removal_status
    : null;
  const status =
    row.status === "removed"
      ? "removed"
      : computeNumberStatus(row.recent_unique_reporter_count, removalStatus);

  const result: Record<string, unknown> = {
    ok: true,
    found: true,
    maskedNumber: row.display_mask,
    status,
    reportCount: row.report_count,
    uniqueReporterCount: row.unique_reporter_count,
    recentUniqueReporterCount: row.recent_unique_reporter_count,
  };

  if (row.removal_request_id && row.removal_status) {
    result.removalStatus = row.removal_status;
    result.contestDeadline = row.contest_deadline;
    result.contestWindowOpen =
      row.removal_status === "open" &&
      row.contest_deadline !== null &&
      new Date(row.contest_deadline) > new Date();
  }

  return json(result);
}
