import { isUniqueConstraintError } from "../lib/d1.ts";
import {
  hashNumber,
  hashNumberCandidates,
  hashReporter,
  hashReporterCandidates,
} from "../lib/hash.ts";
import { json, jsonError } from "../lib/http.ts";
import { normalizePhone } from "../lib/phone.ts";
import {
  isoDaysAgo,
  isoDaysFromNow,
  RECENT_REPORT_WINDOW_DAYS,
  REMOVAL_REJECT_COOLDOWN_DAYS,
  REMOVAL_REQUESTS_PER_DAY,
  VERIFIED_UNIQUE_REPORTERS,
} from "../lib/policy.ts";
import { enforceRateLimit } from "../lib/rate-limit.ts";
import { readJsonObject } from "../lib/request.ts";
import { createPublicToken, PUBLIC_TOKEN_PATTERN } from "../lib/tokens.ts";
import { turnstileOptions, verifyTurnstile } from "../lib/turnstile.ts";
import {
  ContestBodySchema,
  RemovalRequestBodySchema,
} from "../lib/validation.ts";
import type { Env } from "../types.ts";

export const REMOVAL_REQUEST_PATH_RE = new RegExp(
  `^/api/removal-requests/(${PUBLIC_TOKEN_PATTERN})$`,
);
export const REMOVAL_REQUEST_CONTEST_PATH_RE = new RegExp(
  `^/api/removal-requests/(${PUBLIC_TOKEN_PATTERN})/contest$`,
);

const DUPLICATE_OPEN_STATUSES = new Set([
  "open",
  "pending_review",
  "contested",
]);

function placeholders(count: number): string {
  return Array.from({ length: count }, () => "?").join(", ");
}

function parsePublicToken(pathname: string, pattern: RegExp): string | null {
  const match = pathname.match(pattern);
  return match?.[1] ?? null;
}

export async function handleCreateRemovalRequest(
  request: Request,
  env: Env,
): Promise<Response> {
  if (request.method !== "POST") {
    return jsonError("Method not allowed", 405, "METHOD_NOT_ALLOWED");
  }

  const limited = await enforceRateLimit(
    env,
    request,
    "removal-create",
    "write",
  );
  if (limited) return limited;

  const bodyResult = await readJsonObject(request);
  if (!bodyResult.ok) {
    return bodyResult.response;
  }

  const parsed = RemovalRequestBodySchema.safeParse(bodyResult.value);
  if (!parsed.success) {
    return jsonError("Invalid request body", 400, "VALIDATION_ERROR");
  }

  const { phoneNumber, country, reason, turnstileToken } = parsed.data;

  const ip = request.headers.get("CF-Connecting-IP") ?? undefined;
  const userAgent = request.headers.get("User-Agent") ?? undefined;
  const turnstileOk = await verifyTurnstile(
    env.TURNSTILE_SECRET_KEY,
    turnstileToken,
    ip,
    turnstileOptions(env, request, "removal_request"),
  );
  if (!turnstileOk) {
    return jsonError("Turnstile verification failed", 400, "TURNSTILE_FAILED");
  }

  let normalized: { e164: string; displayMask: string };
  try {
    normalized = normalizePhone(phoneNumber, country);
  } catch {
    return jsonError("Invalid phone number", 400, "INVALID_PHONE_NUMBER");
  }

  const nowMs = Date.now();
  const now = new Date(nowMs).toISOString();
  const deadline = isoDaysFromNow(7, nowMs);
  const currentNumberHash = await hashNumber(env.HASH_SECRET, normalized.e164);
  const numberHashes = await hashNumberCandidates(
    env.HASH_SECRET,
    env.HASH_SECRET_PREVIOUS,
    normalized.e164,
  );
  const requesterHash = await hashReporter(env.HASH_SECRET, ip);
  const requesterHashes = await hashReporterCandidates(
    env.HASH_SECRET,
    env.HASH_SECRET_PREVIOUS,
    ip,
    userAgent,
  );
  const publicToken = createPublicToken();
  const db = env.DB;

  const recentCutoff = isoDaysAgo(RECENT_REPORT_WINDOW_DAYS, nowMs);
  const numberRow = await db
    .prepare(
      `SELECT id, status, report_count, unique_reporter_count,
              (
                SELECT COUNT(DISTINCT reporter_hash) FROM reports
                WHERE number_id = numbers.id AND created_at >= ?
              ) AS recent_unique_reporter_count,
              removal_request_id
         FROM numbers
        WHERE number_hash IN (${placeholders(numberHashes.length)})
        ORDER BY CASE WHEN number_hash = ? THEN 0 ELSE 1 END
        LIMIT 1`,
    )
    .bind(recentCutoff, ...numberHashes, currentNumberHash)
    .first<{
      id: number;
      status: string;
      report_count: number;
      unique_reporter_count: number;
      recent_unique_reporter_count: number;
      removal_request_id: number | null;
    }>();

  if (!numberRow || numberRow.report_count <= 0) {
    return jsonError(
      "Number has not been reported",
      404,
      "NUMBER_NOT_REPORTED",
    );
  }

  if (numberRow.status === "removed") {
    return jsonError("Number is already removed", 409, "ALREADY_REMOVED");
  }

  if (numberRow.removal_request_id) {
    const existing = await db
      .prepare("SELECT id, status FROM removal_requests WHERE id = ?")
      .bind(numberRow.removal_request_id)
      .first<{ id: number; status: string }>();

    if (existing && DUPLICATE_OPEN_STATUSES.has(existing.status)) {
      const code =
        existing.status === "open"
          ? "DUPLICATE_REMOVAL_REQUEST"
          : "REMOVAL_UNDER_REVIEW";
      return jsonError(
        existing.status === "open"
          ? "An open removal request already exists for this number"
          : "Removal request is already under review",
        409,
        code,
      );
    }

    if (existing?.status === "approved") {
      return jsonError("Number is already removed", 409, "ALREADY_REMOVED");
    }
  }

  const dailyCount = await db
    .prepare(
      `SELECT COUNT(*) AS count FROM removal_requests
        WHERE requester_hash IN (${placeholders(requesterHashes.length)})
          AND created_at >= ?`,
    )
    .bind(...requesterHashes, isoDaysAgo(1, nowMs))
    .first<{ count: number }>();

  if ((dailyCount?.count ?? 0) >= REMOVAL_REQUESTS_PER_DAY) {
    return jsonError(
      "Too many removal requests from this reporter",
      429,
      "REMOVAL_RATE_LIMITED",
    );
  }

  // A rejected request cannot be immediately re-opened by rotating IPs.
  const recentRejection = await db
    .prepare(
      "SELECT id FROM removal_requests WHERE number_id = ? AND status = 'rejected' AND updated_at >= ? ORDER BY updated_at DESC LIMIT 1",
    )
    .bind(numberRow.id, isoDaysAgo(REMOVAL_REJECT_COOLDOWN_DAYS, nowMs))
    .first<{ id: number }>();

  if (recentRejection) {
    return jsonError(
      "A recent removal request for this number was rejected",
      409,
      "REMOVAL_COOLDOWN",
    );
  }

  // The insert predicates repeat the active-request, daily-limit, and cooldown
  // checks inside one statement so a concurrent writer cannot slip past the
  // pre-checks above. The number update only runs if the insert won.
  let inserted = 0;
  try {
    const results = await db.batch([
      db
        .prepare(
          `INSERT INTO removal_requests
             (number_id, requester_hash, reason, status, contest_deadline, created_at, updated_at, public_token)
           SELECT ?, ?, ?, 'open', ?, ?, ?, ?
            WHERE NOT EXISTS (
              SELECT 1 FROM removal_requests
              WHERE number_id = ?
                AND status IN ('open', 'pending_review', 'contested')
            )
              AND (
                SELECT COUNT(*) FROM removal_requests
                WHERE requester_hash IN (${placeholders(requesterHashes.length)})
                  AND created_at >= ?
              ) < ?
              AND NOT EXISTS (
                SELECT 1 FROM removal_requests
                WHERE number_id = ?
                  AND status = 'rejected'
                  AND updated_at >= ?
              )
              AND NOT EXISTS (
                SELECT 1 FROM numbers WHERE id = ? AND status = 'removed'
              )
              AND NOT EXISTS (
                SELECT 1 FROM removal_requests
                WHERE number_id = ? AND status = 'approved'
              )`,
        )
        .bind(
          numberRow.id,
          requesterHash,
          reason,
          deadline,
          now,
          now,
          publicToken,
          numberRow.id,
          ...requesterHashes,
          isoDaysAgo(1, nowMs),
          REMOVAL_REQUESTS_PER_DAY,
          numberRow.id,
          isoDaysAgo(REMOVAL_REJECT_COOLDOWN_DAYS, nowMs),
          numberRow.id,
          numberRow.id,
        ),
      db
        .prepare(
          "UPDATE numbers SET status = ?, removal_request_id = (SELECT id FROM removal_requests WHERE public_token = ?), updated_at = ?, status_checked_at = ? WHERE id = ? AND status != 'removed' AND EXISTS (SELECT 1 FROM removal_requests WHERE public_token = ?)",
        )
        .bind(
          "under_removal_review",
          publicToken,
          now,
          now,
          numberRow.id,
          publicToken,
        ),
    ]);
    inserted = results[0]?.meta?.changes ?? 0;
  } catch (e) {
    if (isUniqueConstraintError(e)) {
      return jsonError(
        "An open removal request already exists for this number",
        409,
        "DUPLICATE_REMOVAL_REQUEST",
      );
    }
    throw e;
  }

  if (inserted === 0) {
    return describeRemovalConflict(db, numberRow.id, requesterHashes, nowMs);
  }

  return json({
    ok: true,
    publicToken,
    maskedNumber: normalized.displayMask,
    contestDeadline: deadline,
    reviewRequired:
      numberRow.recent_unique_reporter_count >= VERIFIED_UNIQUE_REPORTERS,
  });
}

async function describeRemovalConflict(
  db: D1Database,
  numberId: number,
  requesterHashes: string[],
  nowMs: number,
): Promise<Response> {
  const number = await db
    .prepare("SELECT status FROM numbers WHERE id = ?")
    .bind(numberId)
    .first<{ status: string }>();

  if (number?.status === "removed") {
    return jsonError("Number is already removed", 409, "ALREADY_REMOVED");
  }

  const approved = await db
    .prepare(
      "SELECT 1 AS found FROM removal_requests WHERE number_id = ? AND status = 'approved' LIMIT 1",
    )
    .bind(numberId)
    .first<{ found: number }>();

  if (approved) {
    return jsonError("Number is already removed", 409, "ALREADY_REMOVED");
  }

  const active = await db
    .prepare(
      "SELECT status FROM removal_requests WHERE number_id = ? AND status IN ('open', 'pending_review', 'contested') LIMIT 1",
    )
    .bind(numberId)
    .first<{ status: string }>();

  if (active) {
    return jsonError(
      active.status === "open"
        ? "An open removal request already exists for this number"
        : "Removal request is already under review",
      409,
      active.status === "open"
        ? "DUPLICATE_REMOVAL_REQUEST"
        : "REMOVAL_UNDER_REVIEW",
    );
  }

  const dailyCount = await db
    .prepare(
      `SELECT COUNT(*) AS count FROM removal_requests
        WHERE requester_hash IN (${placeholders(requesterHashes.length)})
          AND created_at >= ?`,
    )
    .bind(...requesterHashes, isoDaysAgo(1, nowMs))
    .first<{ count: number }>();

  if ((dailyCount?.count ?? 0) >= REMOVAL_REQUESTS_PER_DAY) {
    return jsonError(
      "Too many removal requests from this reporter",
      429,
      "REMOVAL_RATE_LIMITED",
    );
  }

  const recentRejection = await db
    .prepare(
      "SELECT id FROM removal_requests WHERE number_id = ? AND status = 'rejected' AND updated_at >= ? ORDER BY updated_at DESC LIMIT 1",
    )
    .bind(numberId, isoDaysAgo(REMOVAL_REJECT_COOLDOWN_DAYS, nowMs))
    .first<{ id: number }>();

  if (recentRejection) {
    return jsonError(
      "A recent removal request for this number was rejected",
      409,
      "REMOVAL_COOLDOWN",
    );
  }

  return jsonError(
    "An open removal request already exists for this number",
    409,
    "DUPLICATE_REMOVAL_REQUEST",
  );
}

export async function handleGetRemovalRequest(
  request: Request,
  env: Env,
): Promise<Response> {
  if (request.method !== "GET") {
    return jsonError("Method not allowed", 405, "METHOD_NOT_ALLOWED");
  }

  const limited = await enforceRateLimit(
    env,
    request,
    "removal-detail",
    "read",
  );
  if (limited) return limited;

  const publicToken = parsePublicToken(
    new URL(request.url).pathname,
    REMOVAL_REQUEST_PATH_RE,
  );
  if (!publicToken) {
    return jsonError("Invalid removal request token", 400, "VALIDATION_ERROR");
  }

  const rr = await env.DB.prepare(
    `SELECT rr.id, rr.reason, rr.status, rr.contest_deadline, rr.created_at,
            n.display_mask,
            (
              SELECT COUNT(DISTINCT reporter_hash) FROM reports
              WHERE number_id = n.id AND created_at >= ?
            ) AS recent_unique_reporter_count
       FROM removal_requests rr
       JOIN numbers n ON rr.number_id = n.id
      WHERE rr.public_token = ?`,
  )
    .bind(isoDaysAgo(RECENT_REPORT_WINDOW_DAYS), publicToken)
    .first<{
      id: number;
      reason: string;
      status: string;
      contest_deadline: string;
      created_at: string;
      display_mask: string;
      recent_unique_reporter_count: number;
    }>();

  if (!rr) {
    return jsonError("Removal request not found", 404, "NOT_FOUND");
  }

  const contestCountRes = await env.DB.prepare(
    "SELECT COUNT(*) as count FROM removal_contests WHERE removal_request_id = ?",
  )
    .bind(rr.id)
    .first<{ count: number }>();

  const contestCount = contestCountRes?.count ?? 0;
  const contestWindowOpen =
    rr.status === "open" && new Date(rr.contest_deadline) > new Date();

  return json({
    ok: true,
    maskedNumber: rr.display_mask,
    reason: rr.reason,
    status: rr.status,
    contestDeadline: rr.contest_deadline,
    contestCount,
    contestWindowOpen,
    reviewRequired:
      rr.recent_unique_reporter_count >= VERIFIED_UNIQUE_REPORTERS,
  });
}

export async function handleContestRemovalRequest(
  request: Request,
  env: Env,
): Promise<Response> {
  if (request.method !== "POST") {
    return jsonError("Method not allowed", 405, "METHOD_NOT_ALLOWED");
  }

  const limited = await enforceRateLimit(
    env,
    request,
    "removal-contest",
    "write",
  );
  if (limited) return limited;

  const publicToken = parsePublicToken(
    new URL(request.url).pathname,
    REMOVAL_REQUEST_CONTEST_PATH_RE,
  );
  if (!publicToken) {
    return jsonError("Invalid removal request token", 400, "VALIDATION_ERROR");
  }

  const bodyResult = await readJsonObject(request);
  if (!bodyResult.ok) {
    return bodyResult.response;
  }

  const parsed = ContestBodySchema.safeParse(bodyResult.value);
  if (!parsed.success) {
    return jsonError("Invalid request body", 400, "VALIDATION_ERROR");
  }

  const { reason, turnstileToken } = parsed.data;

  const ip = request.headers.get("CF-Connecting-IP") ?? undefined;
  const userAgent = request.headers.get("User-Agent") ?? undefined;
  const turnstileOk = await verifyTurnstile(
    env.TURNSTILE_SECRET_KEY,
    turnstileToken,
    ip,
    turnstileOptions(env, request, "removal_contest"),
  );
  if (!turnstileOk) {
    return jsonError("Turnstile verification failed", 400, "TURNSTILE_FAILED");
  }

  const rr = await env.DB.prepare(
    "SELECT id, number_id, status, contest_deadline FROM removal_requests WHERE public_token = ?",
  )
    .bind(publicToken)
    .first<{
      id: number;
      number_id: number;
      status: string;
      contest_deadline: string;
    }>();

  if (!rr) {
    return jsonError("Removal request not found", 404, "NOT_FOUND");
  }

  const contestantHash = await hashReporter(env.HASH_SECRET, ip);
  const contestantHashes = await hashReporterCandidates(
    env.HASH_SECRET,
    env.HASH_SECRET_PREVIOUS,
    ip,
    userAgent,
  );
  const now = new Date().toISOString();

  const existingContest = await env.DB.prepare(
    `SELECT 1 AS found FROM removal_contests
      WHERE removal_request_id = ? AND contestant_hash IN (${placeholders(contestantHashes.length)})
      LIMIT 1`,
  )
    .bind(rr.id, ...contestantHashes)
    .first<{ found: number }>();

  if (existingContest) {
    return jsonError(
      "You have already contested this removal request",
      409,
      "ALREADY_CONTESTED",
    );
  }

  if (rr.status !== "open") {
    return jsonError(
      "Removal request is not open for contest",
      409,
      "NOT_CONTESTABLE",
    );
  }
  if (new Date(rr.contest_deadline) <= new Date()) {
    return jsonError("Contest deadline has passed", 409, "DEADLINE_PASSED");
  }

  // The INSERT is guarded by the same open+deadline predicate as the status
  // updates, so a cron run cannot approve the request between check and write.
  let insertedContests = 0;
  try {
    const results = await env.DB.batch([
      env.DB.prepare(
        `INSERT INTO removal_contests (removal_request_id, contestant_hash, reason, created_at)
         SELECT ?, ?, ?, ?
         WHERE EXISTS (
           SELECT 1 FROM removal_requests
           WHERE id = ? AND status = 'open' AND contest_deadline > ?
         )`,
      ).bind(rr.id, contestantHash, reason, now, rr.id, now),
      env.DB.prepare(
        "UPDATE removal_requests SET status = ?, updated_at = ? WHERE id = ? AND status = 'open' AND contest_deadline > ?",
      ).bind("contested", now, rr.id, now),
      env.DB.prepare(
        "UPDATE numbers SET status = ?, updated_at = ?, status_checked_at = ? WHERE id = ? AND status != 'removed' AND EXISTS (SELECT 1 FROM removal_requests WHERE id = ? AND status = ?)",
      ).bind("disputed", now, now, rr.number_id, rr.id, "contested"),
    ]);

    insertedContests = results[0]?.meta?.changes ?? 0;
  } catch (e) {
    if (isUniqueConstraintError(e)) {
      return jsonError(
        "You have already contested this removal request",
        409,
        "ALREADY_CONTESTED",
      );
    }
    throw e;
  }

  if (insertedContests === 0) {
    return jsonError(
      "Removal request is not open for contest",
      409,
      "NOT_CONTESTABLE",
    );
  }

  const countRes = await env.DB.prepare(
    "SELECT COUNT(*) as count FROM removal_contests WHERE removal_request_id = ?",
  )
    .bind(rr.id)
    .first<{ count: number }>();

  return json({
    ok: true,
    contestCount: countRes?.count ?? 0,
    status: "disputed",
  });
}
