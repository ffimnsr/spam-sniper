import { isUniqueConstraintError } from "../lib/d1.ts";
import { encryptE164 } from "../lib/encryption.ts";
import {
  hashNumber,
  hashNumberCandidates,
  hashReporter,
  hashReporterCandidates,
} from "../lib/hash.ts";
import { json, jsonError } from "../lib/http.ts";
import {
  bindRefreshNumberStats,
  REFRESH_NUMBER_STATS_SQL,
} from "../lib/number-stats.ts";
import { normalizePhone } from "../lib/phone.ts";
import { isoDaysAgo, RECENT_REPORT_WINDOW_DAYS } from "../lib/policy.ts";
import { enforceRateLimit } from "../lib/rate-limit.ts";
import { readJsonObject } from "../lib/request.ts";
import { turnstileOptions, verifyTurnstile } from "../lib/turnstile.ts";
import { ReportBodySchema } from "../lib/validation.ts";
import type { Env } from "../types.ts";

interface NumberRow {
  id: number;
  number_hash: string;
  phone_number_enc: string | null;
  phone_number_e164: string | null;
  status: string;
  report_count: number;
  unique_reporter_count: number;
  recent_unique_reporter_count: number;
}

interface NumberStats {
  report_count: number;
  unique_reporter_count: number;
  recent_unique_reporter_count: number;
  status: string;
}

function placeholders(count: number): string {
  return Array.from({ length: count }, () => "?").join(", ");
}

async function findNumber(
  env: Env,
  candidates: string[],
  currentHash: string,
): Promise<NumberRow | null> {
  return env.DB.prepare(
    `SELECT id, number_hash, phone_number_enc, phone_number_e164, status,
            report_count, unique_reporter_count, recent_unique_reporter_count
       FROM numbers
      WHERE number_hash IN (${placeholders(candidates.length)})
      ORDER BY CASE WHEN number_hash = ? THEN 0 ELSE 1 END
      LIMIT 1`,
  )
    .bind(...candidates, currentHash)
    .first<NumberRow>();
}

async function getNumberStats(
  env: Env,
  numberId: number,
): Promise<NumberStats | null> {
  return env.DB.prepare(
    "SELECT report_count, unique_reporter_count, recent_unique_reporter_count, status FROM numbers WHERE id = ?",
  )
    .bind(numberId)
    .first<NumberStats>();
}

function duplicateResponse(stats: NumberStats, displayMask: string): Response {
  return json({
    ok: true,
    duplicate: true,
    maskedNumber: displayMask,
    status: stats.status,
    reportCount: stats.report_count,
    uniqueReporterCount: stats.unique_reporter_count,
    recentUniqueReporterCount: stats.recent_unique_reporter_count,
  });
}

export async function handleReport(
  request: Request,
  env: Env,
): Promise<Response> {
  if (request.method !== "POST") {
    return jsonError("Method not allowed", 405, "METHOD_NOT_ALLOWED");
  }

  const limited = await enforceRateLimit(env, request, "reports", "write");
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

  const nowMs = Date.now();
  const now = new Date(nowMs).toISOString();
  const recentCutoff = isoDaysAgo(RECENT_REPORT_WINDOW_DAYS, nowMs);
  const currentNumberHash = await hashNumber(env.HASH_SECRET, normalized.e164);
  const numberHashes = await hashNumberCandidates(
    env.HASH_SECRET,
    env.HASH_SECRET_PREVIOUS,
    normalized.e164,
  );

  const db = env.DB;
  let numberRow = await findNumber(env, numberHashes, currentNumberHash);

  if (!numberRow) {
    const encryptedNumber = await encryptE164(env.HASH_SECRET, normalized.e164);
    await db
      .prepare(
        "INSERT INTO numbers (number_hash, phone_number_e164, phone_number_enc, display_mask, country_code, status, first_reported_at, last_reported_at, updated_at, status_checked_at) VALUES (?, NULL, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(number_hash) DO NOTHING",
      )
      .bind(
        currentNumberHash,
        encryptedNumber,
        normalized.displayMask,
        normalized.countryCode ?? null,
        "pending",
        now,
        now,
        now,
        now,
      )
      .run();

    // The insert may have lost a race with another writer. Re-read either way,
    // because the winning row is the one that owns the reports table.
    numberRow = await findNumber(env, numberHashes, currentNumberHash);
    if (!numberRow) {
      throw new Error("NUMBER_INSERT_RACE");
    }
  } else {
    // Lazy migration: rehash legacy formats and encrypt plaintext/legacy
    // ciphertext with the current key.
    if (
      numberRow.number_hash !== currentNumberHash ||
      !numberRow.phone_number_enc ||
      numberRow.phone_number_e164 !== null
    ) {
      const encryptedNumber = await encryptE164(
        env.HASH_SECRET,
        normalized.e164,
      );
      try {
        await db
          .prepare(
            "UPDATE numbers SET number_hash = ?, phone_number_enc = ?, phone_number_e164 = NULL, display_mask = ?, country_code = ?, updated_at = ? WHERE id = ? AND number_hash = ?",
          )
          .bind(
            currentNumberHash,
            encryptedNumber,
            normalized.displayMask,
            normalized.countryCode ?? null,
            now,
            numberRow.id,
            numberRow.number_hash,
          )
          .run();
        numberRow.number_hash = currentNumberHash;
        numberRow.phone_number_enc = encryptedNumber;
        numberRow.phone_number_e164 = null;
      } catch (error) {
        if (!isUniqueConstraintError(error)) throw error;
        // A concurrent writer already owns the current hash. Keep the legacy
        // hash for now, but never leave a plaintext value behind.
        if (
          numberRow.phone_number_e164 !== null ||
          !numberRow.phone_number_enc
        ) {
          await db
            .prepare(
              "UPDATE numbers SET phone_number_enc = ?, phone_number_e164 = NULL, display_mask = ?, country_code = ?, updated_at = ? WHERE id = ? AND number_hash = ?",
            )
            .bind(
              encryptedNumber,
              normalized.displayMask,
              normalized.countryCode ?? null,
              now,
              numberRow.id,
              numberRow.number_hash,
            )
            .run();
          numberRow.phone_number_enc = encryptedNumber;
          numberRow.phone_number_e164 = null;
        }
      }
    }
  }

  const reporterHash = await hashReporter(env.HASH_SECRET, ip);
  const reporterHashes = await hashReporterCandidates(
    env.HASH_SECRET,
    env.HASH_SECRET_PREVIOUS,
    ip,
    userAgent,
  );

  const existingReport = await db
    .prepare(
      `SELECT 1 AS found FROM reports
        WHERE number_id = ? AND reporter_hash IN (${placeholders(reporterHashes.length)})
        LIMIT 1`,
    )
    .bind(numberRow.id, ...reporterHashes)
    .first<{ found: number }>();

  if (existingReport) {
    const stats = await getNumberStats(env, numberRow.id);
    return duplicateResponse(
      stats ?? {
        report_count: numberRow.report_count,
        unique_reporter_count: numberRow.unique_reporter_count,
        recent_unique_reporter_count: numberRow.recent_unique_reporter_count,
        status: numberRow.status,
      },
      normalized.displayMask,
    );
  }

  let stats: NumberStats | null = null;
  try {
    const results = await db.batch([
      db
        .prepare(
          "INSERT INTO reports (number_id, reporter_hash, category, created_at) VALUES (?, ?, ?, ?)",
        )
        .bind(numberRow.id, reporterHash, category, now),
      bindRefreshNumberStats(
        db.prepare(REFRESH_NUMBER_STATS_SQL),
        numberRow.id,
        recentCutoff,
        now,
      ),
      db
        .prepare(
          "SELECT report_count, unique_reporter_count, recent_unique_reporter_count, status FROM numbers WHERE id = ?",
        )
        .bind(numberRow.id),
    ]);

    stats =
      (results[2]?.results?.[0] as NumberStats | undefined) ??
      (await getNumberStats(env, numberRow.id));
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      const fresh = await getNumberStats(env, numberRow.id);
      return duplicateResponse(
        fresh ?? {
          report_count: numberRow.report_count,
          unique_reporter_count: numberRow.unique_reporter_count,
          recent_unique_reporter_count: numberRow.recent_unique_reporter_count,
          status: numberRow.status,
        },
        normalized.displayMask,
      );
    }
    throw error;
  }

  if (!stats) {
    throw new Error("NUMBER_STATS_MISSING");
  }

  return json({
    ok: true,
    duplicate: false,
    maskedNumber: normalized.displayMask,
    status: stats.status,
    reportCount: stats.report_count,
    uniqueReporterCount: stats.unique_reporter_count,
    recentUniqueReporterCount: stats.recent_unique_reporter_count,
  });
}
