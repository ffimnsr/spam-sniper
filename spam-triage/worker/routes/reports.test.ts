import { beforeEach, describe, expect, it, vi } from "vitest";
import { encryptE164 } from "../lib/encryption.ts";
import { hashNumber, hmacSha256 } from "../lib/hash.ts";
import { createTestDb, makeTestEnv } from "../test/sqlite-d1.ts";
import type { Env } from "../types.ts";
import { handleReport } from "./reports.ts";

function stubTurnstile(
  options: { success?: boolean; action?: string; hostname?: string } = {},
) {
  vi.stubGlobal(
    "fetch",
    vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            success: options.success ?? true,
            action: options.action ?? "report",
            hostname: options.hostname ?? "example.com",
          }),
          {
            status: 200,
            headers: { "content-type": "application/json" },
          },
        ),
    ),
  );
}

function reportRequest(
  body: Record<string, unknown>,
  ip = "203.0.113.1",
  userAgent = "vitest",
): Request {
  return new Request("https://example.com/api/reports", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "cf-connecting-ip": ip,
      "user-agent": userAgent,
    },
    body: JSON.stringify({
      phoneNumber: "+639171234567",
      country: "PH",
      category: "scam",
      turnstileToken: "token",
      ...body,
    }),
  });
}

describe("handleReport", () => {
  let env: Env;
  let db: ReturnType<typeof createTestDb>;

  beforeEach(() => {
    vi.restoreAllMocks();
    stubTurnstile();
    db = createTestDb();
    env = makeTestEnv(db);
  });

  it("creates first report and returns pending status", async () => {
    const response = await handleReport(reportRequest({}), env);
    const body = (await response.json()) as Record<string, unknown>;

    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      ok: true,
      duplicate: false,
      status: "pending",
      reportCount: 1,
      uniqueReporterCount: 1,
      recentUniqueReporterCount: 1,
    });

    const row = db.raw().prepare("SELECT * FROM numbers").get() as {
      phone_number_e164: string | null;
      phone_number_enc: string | null;
      number_hash: string;
    };
    expect(row.phone_number_e164).toBeNull();
    expect(row.phone_number_enc).toMatch(/^v1\.[0-9a-f]+\.[0-9a-f]+$/);
    expect(row.number_hash).toMatch(/^v2:/);
  });

  it("reports a duplicate without increasing counts", async () => {
    await handleReport(reportRequest({}), env);
    const response = await handleReport(
      reportRequest({ category: "phishing" }),
      env,
    );
    const body = (await response.json()) as Record<string, unknown>;

    expect(body.duplicate).toBe(true);
    expect(body.reportCount).toBe(1);
    const count = db
      .raw()
      .prepare("SELECT COUNT(*) AS count FROM reports")
      .get() as { count: number };
    expect(count.count).toBe(1);
  });

  it("does not let user-agent rotation create duplicate reporters", async () => {
    await handleReport(reportRequest({}, "203.0.113.1", "Agent/A"), env);
    const response = await handleReport(
      reportRequest({}, "203.0.113.1", "Agent/B"),
      env,
    );
    const body = (await response.json()) as Record<string, unknown>;

    expect(body.duplicate).toBe(true);
    expect(body.uniqueReporterCount).toBe(1);
  });

  it("advances status with multiple unique reporters", async () => {
    const first = (await (
      await handleReport(reportRequest({}, "203.0.113.1"), env)
    ).json()) as Record<string, unknown>;
    const second = (await (
      await handleReport(reportRequest({}, "203.0.113.2"), env)
    ).json()) as Record<string, unknown>;
    const third = (await (
      await handleReport(reportRequest({}, "203.0.113.3"), env)
    ).json()) as Record<string, unknown>;

    expect(first.status).toBe("pending");
    expect(second.status).toBe("suspected");
    expect(third.status).toBe("verified_spam");
  });

  it("ignores reports outside the recent confidence window", async () => {
    await handleReport(reportRequest({}, "203.0.113.1"), env);
    db.raw()
      .prepare(
        "UPDATE reports SET created_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now', '-120 days')",
      )
      .run();

    const response = await handleReport(reportRequest({}, "203.0.113.2"), env);
    const body = (await response.json()) as Record<string, unknown>;

    expect(body.status).toBe("pending");
    expect(body.recentUniqueReporterCount).toBe(1);
    expect(body.reportCount).toBe(2);
  });

  it("migrates a legacy hash during key rotation", async () => {
    const previousSecret = "old-secret";
    const e164 = "+639171234567";
    const legacyHash = await hmacSha256(previousSecret, e164);
    const legacyCiphertext = await encryptE164(previousSecret, e164);

    db.raw()
      .prepare(
        `INSERT INTO numbers
          (number_hash, phone_number_e164, phone_number_enc, display_mask, country_code, status, first_reported_at, last_reported_at, updated_at)
         VALUES (?, NULL, ?, ?, ?, 'pending', ?, ?, ?)`,
      )
      .run(
        legacyHash,
        legacyCiphertext,
        "+63 917 *** 4567",
        "PH",
        "2026-01-01T00:00:00.000Z",
        "2026-01-01T00:00:00.000Z",
        "2026-01-01T00:00:00.000Z",
      );

    env.HASH_SECRET_PREVIOUS = previousSecret;
    const response = await handleReport(reportRequest({}), env);
    const body = (await response.json()) as Record<string, unknown>;

    expect(response.status).toBe(200);
    expect(body.reportCount).toBe(1);
    const row = db
      .raw()
      .prepare("SELECT number_hash, phone_number_enc FROM numbers")
      .get() as { number_hash: string; phone_number_enc: string };
    expect(row.number_hash).toBe(await hashNumber("test-secret", e164));
    expect(row.phone_number_enc).not.toBe(legacyCiphertext);
  });

  it("rejects invalid phone numbers", async () => {
    const response = await handleReport(
      reportRequest({ phoneNumber: "123" }),
      env,
    );
    expect(response.status).toBe(400);
  });

  it("rejects Turnstile verification failure", async () => {
    stubTurnstile({ success: false });
    const response = await handleReport(reportRequest({}), env);
    const body = (await response.json()) as { error?: { code?: string } };
    expect(response.status).toBe(400);
    expect(body.error?.code).toBe("TURNSTILE_FAILED");
  });

  it("rejects a token minted for another action", async () => {
    stubTurnstile({ action: "numbers_check" });
    const response = await handleReport(reportRequest({}), env);
    expect(response.status).toBe(400);
  });

  it("rejects a token solved on another hostname", async () => {
    stubTurnstile({ hostname: "evil.example" });
    const response = await handleReport(reportRequest({}), env);
    expect(response.status).toBe(400);
  });

  it("returns 429 when the write rate limiter rejects the request", async () => {
    env.RATE_LIMITER_WRITE = { limit: vi.fn(async () => ({ success: false })) };
    const response = await handleReport(reportRequest({}), env);
    const body = (await response.json()) as { error?: { code?: string } };

    expect(response.status).toBe(429);
    expect(body.error?.code).toBe("RATE_LIMITED");
  });
});
