import { hashNumber } from "../lib/hash.ts";
import { json, jsonError } from "../lib/http.ts";
import { normalizePhone } from "../lib/phone.ts";
import { readJsonObject } from "../lib/request.ts";
import { verifyTurnstile } from "../lib/turnstile.ts";
import { CheckQuerySchema } from "../lib/validation.ts";
import type { Env } from "../types.ts";

export async function handleCheckNumber(
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

  const parsed = CheckQuerySchema.safeParse({
    number: bodyResult.value.number,
    country: bodyResult.value.country,
    turnstileToken: bodyResult.value.turnstileToken,
  });
  if (!parsed.success) {
    return jsonError("Invalid request body", 400, "VALIDATION_ERROR");
  }

  const turnstileOk = await verifyTurnstile(
    env.TURNSTILE_SECRET_KEY,
    parsed.data.turnstileToken,
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

  const numberHash = await hashNumber(env.HASH_SECRET, normalized.e164);

  const row = await env.DB.prepare(
    "SELECT display_mask, status, report_count, unique_reporter_count, removal_request_id FROM numbers WHERE number_hash = ?",
  )
    .bind(numberHash)
    .first<{
      display_mask: string;
      status: string;
      report_count: number;
      unique_reporter_count: number;
      removal_request_id: number | null;
    }>();

  if (!row) {
    return json({ ok: true, found: false });
  }

  const result: Record<string, unknown> = {
    ok: true,
    found: true,
    maskedNumber: row.display_mask,
    status: row.status,
    reportCount: row.report_count,
    uniqueReporterCount: row.unique_reporter_count,
  };

  if (row.removal_request_id) {
    const rr = await env.DB.prepare(
      "SELECT status, contest_deadline FROM removal_requests WHERE id = ?",
    )
      .bind(row.removal_request_id)
      .first<{ status: string; contest_deadline: string }>();
    if (rr) {
      result.removalStatus = rr.status;
      result.contestDeadline = rr.contest_deadline;
      result.contestWindowOpen =
        rr.status === "open" && new Date(rr.contest_deadline) > new Date();
    }
  }

  return json(result);
}
