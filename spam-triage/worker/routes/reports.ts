import { hashNumber, hashReporter } from "../lib/hash.ts";
import { json, jsonError } from "../lib/http.ts";
import { normalizePhone } from "../lib/phone.ts";
import { readJsonObject } from "../lib/request.ts";
import { computeNumberStatus } from "../lib/scoring.ts";
import { verifyTurnstile } from "../lib/turnstile.ts";
import { ReportBodySchema } from "../lib/validation.ts";
import type { Env } from "../types.ts";

export async function handleReport(
  request: Request,
  env: Env,
): Promise<Response> {
  if (request.method !== "POST") {
    return jsonError("Method not allowed", 405, "METHOD_NOT_ALLOWED");
  }

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

  // Upsert number
  let numberRow = await db
    .prepare("SELECT * FROM numbers WHERE number_hash = ?")
    .bind(numberHash)
    .first<{
      id: number;
      phone_number_e164: string | null;
      status: string;
      report_count: number;
      unique_reporter_count: number;
      removal_request_id: number | null;
    }>();

  if (!numberRow) {
    const insert = await db
      .prepare(
        "INSERT INTO numbers (number_hash, phone_number_e164, display_mask, country_code, status, first_reported_at, last_reported_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
      )
      .bind(
        numberHash,
        normalized.e164,
        normalized.displayMask,
        normalized.countryCode ?? null,
        "pending",
        now,
        now,
        now,
      )
      .run();
    const id = insert.meta?.last_row_id ?? 0;
    numberRow = {
      id,
      phone_number_e164: normalized.e164,
      status: "pending",
      report_count: 0,
      unique_reporter_count: 0,
      removal_request_id: null,
    };
  } else if (!numberRow.phone_number_e164) {
    await db
      .prepare(
        "UPDATE numbers SET phone_number_e164 = ?, display_mask = ?, country_code = ?, updated_at = ? WHERE id = ?",
      )
      .bind(
        normalized.e164,
        normalized.displayMask,
        normalized.countryCode ?? null,
        now,
        numberRow.id,
      )
      .run();

    numberRow.phone_number_e164 = normalized.e164;
  }

  // Insert report with duplicate guard
  try {
    await db
      .prepare(
        "INSERT INTO reports (number_id, reporter_hash, category, created_at) VALUES (?, ?, ?, ?)",
      )
      .bind(numberRow.id, reporterHash, category, now)
      .run();
  } catch (e) {
    const msg = String(e);
    if (msg.includes("UNIQUE constraint failed")) {
      return json({
        ok: true,
        duplicate: true,
        maskedNumber: normalized.displayMask,
        status: numberRow.status,
        reportCount: numberRow.report_count,
      });
    }
    throw e;
  }

  // Recalculate counts
  const countRes = await db
    .prepare(
      "SELECT COUNT(*) as total, COUNT(DISTINCT reporter_hash) as unique FROM reports WHERE number_id = ?",
    )
    .bind(numberRow.id)
    .first<{ total: number; unique: number }>();

  const reportCount = countRes?.total ?? numberRow.report_count + 1;
  const uniqueReporterCount =
    countRes?.unique ?? numberRow.unique_reporter_count + 1;

  // Check removal state for status computation
  let removalRequestStatus:
    | "open"
    | "approved"
    | "rejected"
    | "contested"
    | null = null;

  if (numberRow.removal_request_id) {
    const rr = await db
      .prepare("SELECT status FROM removal_requests WHERE id = ?")
      .bind(numberRow.removal_request_id)
      .first<{ status: string }>();
    if (
      rr?.status === "open" ||
      rr?.status === "approved" ||
      rr?.status === "rejected" ||
      rr?.status === "contested"
    ) {
      removalRequestStatus = rr.status;
    }
  }

  const newStatus = computeNumberStatus(
    uniqueReporterCount,
    removalRequestStatus,
  );

  await db
    .prepare(
      "UPDATE numbers SET report_count = ?, unique_reporter_count = ?, status = ?, last_reported_at = ?, updated_at = ? WHERE id = ?",
    )
    .bind(reportCount, uniqueReporterCount, newStatus, now, now, numberRow.id)
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
