import { beforeEach, describe, expect, it, vi } from "vitest";
import { encryptE164 } from "../lib/encryption.ts";
import { hashNumber, hmacSha256 } from "../lib/hash.ts";
import { createTestDb, makeTestEnv } from "../test/sqlite-d1.ts";
import type { Env } from "../types.ts";
import { handleCheckNumber } from "./numbers.ts";

const E164 = "+639171234567";

function checkRequest(number = E164): Request {
  return new Request("https://example.com/api/numbers/check", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "cf-connecting-ip": "203.0.113.1",
    },
    body: JSON.stringify({
      number,
      country: "PH",
      turnstileToken: "token",
    }),
  });
}

function stubTurnstile(success = true) {
  vi.stubGlobal(
    "fetch",
    vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            success,
            action: "check",
            hostname: "example.com",
          }),
          {
            status: 200,
            headers: { "content-type": "application/json" },
          },
        ),
    ),
  );
}

async function insertNumber(
  db: ReturnType<typeof createTestDb>,
  options: {
    hash?: string;
    status?: string;
    removalRequestId?: number | null;
    recentUnique?: number;
    withReports?: boolean;
  } = {},
) {
  const numberHash = options.hash ?? (await hashNumber("test-secret", E164));
  const encrypted = await encryptE164("test-secret", E164);
  const now = new Date().toISOString();
  db.raw()
    .prepare(
      `INSERT INTO numbers
        (number_hash, phone_number_enc, display_mask, country_code, status,
         report_count, unique_reporter_count, recent_unique_reporter_count,
         removal_request_id, first_reported_at, last_reported_at, updated_at, status_checked_at)
       VALUES (?, ?, ?, 'PH', ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      numberHash,
      encrypted,
      "+63 917 *** 4567",
      options.status ?? "verified_spam",
      options.recentUnique ?? 3,
      options.recentUnique ?? 3,
      options.recentUnique ?? 3,
      options.removalRequestId ?? null,
      now,
      now,
      now,
      now,
    );

  const recent = options.recentUnique ?? 3;
  if (options.withReports === false) return;
  for (let index = 0; index < recent; index++) {
    db.raw()
      .prepare(
        "INSERT INTO reports (number_id, reporter_hash, category, created_at) VALUES (?, ?, 'scam', ?)",
      )
      .run(1, `v2:seed-${index}`, now);
  }
}

describe("handleCheckNumber", () => {
  let env: Env;
  let db: ReturnType<typeof createTestDb>;

  beforeEach(() => {
    vi.restoreAllMocks();
    stubTurnstile();
    db = createTestDb();
    env = makeTestEnv(db);
  });

  it("returns found: false for unreported number", async () => {
    const response = await handleCheckNumber(checkRequest(), env);
    const body = (await response.json()) as Record<string, unknown>;

    expect(response.status).toBe(200);
    expect(body).toMatchObject({ ok: true, found: false });
  });

  it("returns masked number and status for reported number", async () => {
    await insertNumber(db);
    const response = await handleCheckNumber(checkRequest(), env);
    const body = (await response.json()) as Record<string, unknown>;

    expect(body).toMatchObject({
      ok: true,
      found: true,
      maskedNumber: "+63 917 *** 4567",
      status: "verified_spam",
      reportCount: 3,
      uniqueReporterCount: 3,
      recentUniqueReporterCount: 3,
    });
  });

  it("derives public status from fresh recent reports", async () => {
    await insertNumber(db, {
      status: "verified_spam",
      recentUnique: 3,
      withReports: false,
    });

    const response = await handleCheckNumber(checkRequest(), env);
    const body = (await response.json()) as Record<string, unknown>;

    expect(body.status).toBe("pending");
    expect(body.recentUniqueReporterCount).toBe(0);
  });

  it("includes removal info from one joined lookup", async () => {
    await insertNumber(db, {
      status: "under_removal_review",
      removalRequestId: 5,
      recentUnique: 1,
    });
    const deadline = new Date(Date.now() + 86_400_000).toISOString();
    db.raw()
      .prepare(
        `INSERT INTO removal_requests
          (id, number_id, requester_hash, reason, status, contest_deadline, created_at, updated_at, public_token)
         VALUES (5, 1, 'v2:requester', 'personal_number', 'open', ?, ?, ?, 'abcdef0123456789abcdef0123456789')`,
      )
      .run(deadline, deadline, deadline);

    const response = await handleCheckNumber(checkRequest(), env);
    const body = (await response.json()) as Record<string, unknown>;

    expect(body.removalStatus).toBe("open");
    expect(body.contestWindowOpen).toBe(true);
  });

  it("accepts a legacy hash during rotation", async () => {
    await insertNumber(db, {
      hash: await hmacSha256("old-secret", E164),
    });
    env.HASH_SECRET_PREVIOUS = "old-secret";

    const response = await handleCheckNumber(checkRequest(), env);
    const body = (await response.json()) as Record<string, unknown>;
    expect(body.found).toBe(true);
  });

  it("rejects missing number parameter", async () => {
    const request = new Request("https://example.com/api/numbers/check", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ turnstileToken: "token" }),
    });
    const response = await handleCheckNumber(request, env);
    expect(response.status).toBe(400);
  });

  it("rejects invalid phone number", async () => {
    const response = await handleCheckNumber(checkRequest("123"), env);
    expect(response.status).toBe(400);
  });

  it("rejects Turnstile verification failure", async () => {
    stubTurnstile(false);
    const response = await handleCheckNumber(checkRequest(), env);
    const body = (await response.json()) as { error?: { code?: string } };
    expect(response.status).toBe(400);
    expect(body.error?.code).toBe("TURNSTILE_FAILED");
  });
});
