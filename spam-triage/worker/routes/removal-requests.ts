import { isUniqueConstraintError } from "../lib/d1.ts";
import { hashNumber, hashReporter } from "../lib/hash.ts";
import { json, jsonError } from "../lib/http.ts";
import { normalizePhone } from "../lib/phone.ts";
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

  const limited = await enforceRateLimit(env, request, "removal-create");
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

  const numberHash = await hashNumber(env.HASH_SECRET, normalized.e164);
  const requesterHash = await hashReporter(env.HASH_SECRET, ip, userAgent);
  const now = new Date();
  const nowIso = now.toISOString();
  const deadline = new Date(
    now.getTime() + 7 * 24 * 60 * 60 * 1000,
  ).toISOString();
  const publicToken = createPublicToken();

  const db = env.DB;

  // Look up or create number
  const numberRow = await db
    .prepare(
      "SELECT id, status, report_count, removal_request_id FROM numbers WHERE number_hash = ?",
    )
    .bind(numberHash)
    .first<{
      id: number;
      status: string;
      report_count: number;
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
      .prepare(
        "SELECT id, status, contest_deadline FROM removal_requests WHERE id = ?",
      )
      .bind(numberRow.removal_request_id)
      .first<{ id: number; status: string; contest_deadline: string }>();

    if (existing?.status === "open") {
      return jsonError(
        "An open removal request already exists for this number",
        409,
        "DUPLICATE_REMOVAL_REQUEST",
      );
    }

    // A contested request is waiting on operator review. Opening another
    // request now would orphan the disputed record.
    if (existing?.status === "contested") {
      return jsonError(
        "Removal request is already under review",
        409,
        "REMOVAL_UNDER_REVIEW",
      );
    }
  }

  // Insert the request and point the number at it in one transaction. The
  // partial unique index on open requests also closes the check-then-insert
  // race between concurrent submissions.
  try {
    await db.batch([
      db
        .prepare(
          "INSERT INTO removal_requests (number_id, requester_hash, reason, status, contest_deadline, created_at, updated_at, public_token) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
        )
        .bind(
          numberRow.id,
          requesterHash,
          reason,
          "open",
          deadline,
          nowIso,
          nowIso,
          publicToken,
        ),
      db
        .prepare(
          "UPDATE numbers SET status = ?, removal_request_id = (SELECT id FROM removal_requests WHERE public_token = ?), updated_at = ? WHERE id = ?",
        )
        .bind("under_removal_review", publicToken, nowIso, numberRow.id),
    ]);
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

  return json({
    ok: true,
    publicToken,
    maskedNumber: normalized.displayMask,
    contestDeadline: deadline,
  });
}

export async function handleGetRemovalRequest(
  request: Request,
  env: Env,
): Promise<Response> {
  if (request.method !== "GET") {
    return jsonError("Method not allowed", 405, "METHOD_NOT_ALLOWED");
  }

  const publicToken = parsePublicToken(
    new URL(request.url).pathname,
    REMOVAL_REQUEST_PATH_RE,
  );
  if (!publicToken) {
    return jsonError("Invalid removal request token", 400, "VALIDATION_ERROR");
  }

  const rr = await env.DB.prepare(
    "SELECT rr.id, rr.reason, rr.status, rr.contest_deadline, rr.created_at, n.display_mask FROM removal_requests rr JOIN numbers n ON rr.number_id = n.id WHERE rr.public_token = ?",
  )
    .bind(publicToken)
    .first<{
      id: number;
      reason: string;
      status: string;
      contest_deadline: string;
      created_at: string;
      display_mask: string;
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
  });
}

export async function handleContestRemovalRequest(
  request: Request,
  env: Env,
): Promise<Response> {
  if (request.method !== "POST") {
    return jsonError("Method not allowed", 405, "METHOD_NOT_ALLOWED");
  }

  const limited = await enforceRateLimit(env, request, "removal-contest");
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

  const contestantHash = await hashReporter(env.HASH_SECRET, ip, userAgent);
  const now = new Date().toISOString();

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
        "UPDATE numbers SET status = ?, updated_at = ? WHERE id = ? AND EXISTS (SELECT 1 FROM removal_requests WHERE id = ? AND status = ?)",
      ).bind("disputed", now, rr.number_id, rr.id, "contested"),
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
