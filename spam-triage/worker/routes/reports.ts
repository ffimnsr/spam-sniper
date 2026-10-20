import { isUniqueConstraintError } from "../lib/d1.ts";
import { encryptE164 } from "../lib/encryption.ts";
import { hashNumber, hashReporter } from "../lib/hash.ts";
import { json, jsonError } from "../lib/http.ts";
import { normalizePhone } from "../lib/phone.ts";
import { enforceRateLimit } from "../lib/rate-limit.ts";
import { readJsonObject } from "../lib/request.ts";
import {
  computeNumberStatus,
  type RemovalRequestStatus,
} from "../lib/scoring.ts";
import { turnstileOptions, verifyTurnstile } from "../lib/turnstile.ts";
import { ReportBodySchema } from "../lib/validation.ts";
import type { Env } from "../types.ts";

const REMOVAL_STATUSES = new Set<string>([
  "open",
  "approved",
  "rejected",
  "contested",
]);

function toRemovalStatus(value: string | null): RemovalRequestStatus | null {
  if (!value || !REMOVAL_STATUSES.has(value)) return null;
  return value as RemovalRequestStatus;
}

export async function handleReport(
  request: Request,
  env: Env,
): Promise<Response> {
  if (request.method !== "POST") {
    return jsonError("Method not allowed", 405, "METHOD_NOT_ALLOWED");
  }

  const limited = await enforceRateLimit(env, request, "reports");
  if (limited) return limited;

  const bodyResult = await readJsonObject(request);
  if (!bodyResult.ok) {
    return bodyResult.response;
  }

  const parsed = ReportBodySchema.safeParse(bodyResult.value);
  if (!parsed.success) {
    return jsonError("Invalid request body", 400, "VALIDATION_ERROR");
  }

  const { phoneNumber, country, category, turnstileToken } = parsed.data;

  const ip = request.headers.get("CF-Connecting-IP") ?? undefined;
  const userAgent = request.headers.get("User-Agent") ?? undefined;
  const turnstileOk = await verifyTurnstile(
    env.TURNSTILE_SECRET_KEY,
    turnstileToken,
    ip,
    turnstileOptions(env, request, "report"),
  );
  if (!turnstileOk) {
    return jsonError("Turnstile verification failed", 400, "TURNSTILE_FAILED");
  }

  let normalized: {
    e164: string;
    countryCode: string | undefined;
    displayMask: string;
  };
  try {
    normalized = normalizePhone(phoneNumber, country);
  } catch {
    return jsonError("Invalid phone number", 400, "INVALID_PHONE_NUMBER");
  }

  const numberHash = await hashNumber(env.HASH_SECRET, normalized.e164);
  const reporterHash = await hashReporter(env.HASH_SECRET, ip, userAgent);
  const now = new Date().toISOString();

  const db = env.DB;

  // One lookup resolves both the number and its linked removal-request state.
  const numberRow = await db
    .prepare(
      `SELECT n.id, n.phone_number_enc, n.phone_number_e164, n.status, n.report_count,
              n.unique_reporter_count, n.removal_request_id, rr.status AS removal_status
         FROM numbers n
         LEFT JOIN removal_requests rr ON rr.id = n.removal_request_id
        WHERE n.number_hash = ?`,
    )
    .bind(numberHash)
    .first<{
      id: number;
      phone_number_enc: string | null;
      phone_number_e164: string | null;
      status: string;
      report_count: number;
      unique_reporter_count: number;
      removal_request_id: number | null;
      removal_status: string | null;
    }>();

  let numberId: number;

  if (!numberRow) {
    const encryptedNumber = await encryptE164(env.HASH_SECRET, normalized.e164);
    const insert = await db
      .prepare(
        "INSERT INTO numbers (number_hash, phone_number_e164, phone_number_enc, display_mask, country_code, status, first_reported_at, last_reported_at, updated_at) VALUES (?, NULL, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(number_hash) DO NOTHING",
      )
      .bind(
        numberHash,
        encryptedNumber,
        normalized.displayMask,
        normalized.countryCode ?? null,
        "pending",
        now,
        now,
        now,
      )
      .run();

    const insertedId =
      (insert.meta?.changes ?? 1) > 0 ? insert.meta?.last_row_id : undefined;
    if (insertedId) {
      numberId = insertedId;
    } else {
      // Another writer inserted this number between our lookup and insert.
      const raced = await db
        .prepare("SELECT id FROM numbers WHERE number_hash = ?")
        .bind(numberHash)
        .first<{ id: number }>();
      if (!raced) {
        throw new Error("NUMBER_INSERT_RACE");
      }
      numberId = raced.id;
    }
  } else {
    numberId = numberRow.id;

    // Rows created before at-rest encryption still carry plaintext. Encrypt on
    // first touch so the daily migration only handles cold rows.
    if (!numberRow.phone_number_enc) {
      const encryptedNumber = await encryptE164(
        env.HASH_SECRET,
        numberRow.phone_number_e164 ?? normalized.e164,
      );
      await db
        .prepare(
          "UPDATE numbers SET phone_number_enc = ?, phone_number_e164 = NULL, display_mask = ?, country_code = ?, updated_at = ? WHERE id = ?",
        )
        .bind(
          encryptedNumber,
          normalized.displayMask,
          normalized.countryCode ?? null,
          now,
          numberId,
        )
        .run();
    }
  }

  // Insert the report and read the fresh counts in one transaction. A
  // duplicate reporter aborts the batch before counts are recalculated.
  let counts: { total: number; unique: number } | null = null;
  try {
    const [, countResult] = await db.batch([
      db
        .prepare(
          "INSERT INTO reports (number_id, reporter_hash, category, created_at) VALUES (?, ?, ?, ?)",
        )
        .bind(numberId, reporterHash, category, now),
      db
        .prepare(
          "SELECT COUNT(*) as total, COUNT(DISTINCT reporter_hash) as unique FROM reports WHERE number_id = ?",
        )
        .bind(numberId),
    ]);

    counts =
      (countResult?.results?.[0] as
        | { total: number; unique: number }
        | undefined) ?? null;
  } catch (e) {
    if (isUniqueConstraintError(e)) {
      return json({
        ok: true,
        duplicate: true,
        maskedNumber: normalized.displayMask,
        status: numberRow?.status ?? "pending",
        reportCount: numberRow?.report_count ?? 0,
        uniqueReporterCount: numberRow?.unique_reporter_count ?? 0,
      });
    }
    throw e;
  }

  const reportCount = counts?.total ?? (numberRow?.report_count ?? 0) + 1;
  const uniqueReporterCount =
    counts?.unique ?? (numberRow?.unique_reporter_count ?? 0) + 1;

  const newStatus = computeNumberStatus(
    uniqueReporterCount,
    toRemovalStatus(numberRow?.removal_status ?? null),
  );

  await db
    .prepare(
      "UPDATE numbers SET report_count = ?, unique_reporter_count = ?, status = ?, last_reported_at = ?, updated_at = ? WHERE id = ?",
    )
    .bind(reportCount, uniqueReporterCount, newStatus, now, now, numberId)
    .run();

  return json({
    ok: true,
    duplicate: false,
    maskedNumber: normalized.displayMask,
    status: newStatus,
    reportCount,
    uniqueReporterCount,
  });
}
