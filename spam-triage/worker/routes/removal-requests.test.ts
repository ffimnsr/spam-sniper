import { beforeEach, describe, expect, it, vi } from "vitest";
import { encryptE164 } from "../lib/encryption.ts";
import { hashNumber, hashReporter } from "../lib/hash.ts";
import { createTestDb, makeTestEnv } from "../test/sqlite-d1.ts";
import type { Env } from "../types.ts";
import {
  handleContestRemovalRequest,
  handleCreateRemovalRequest,
  handleGetRemovalRequest,
} from "./removal-requests.ts";

const E164 = "+639171234567";

function stubTurnstile(action: string, success = true) {
  vi.stubGlobal(
    "fetch",
    vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            success,
            action,
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

function createRequest(ip = "203.0.113.1"): Request {
  return new Request("https://example.com/api/removal-requests", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "cf-connecting-ip": ip,
      "user-agent": "vitest",
    },
    body: JSON.stringify({
      phoneNumber: E164,
      country: "PH",
      reason: "personal_number",
      turnstileToken: "token",
    }),
  });
}

function contestRequest(token: string, ip = "203.0.113.9"): Request {
  return new Request(
    `https://example.com/api/removal-requests/${token}/contest`,
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "cf-connecting-ip": ip,
        "user-agent": "vitest",
      },
      body: JSON.stringify({ reason: "still_spam", turnstileToken: "token" }),
    },
  );
}

async function insertNumber(
  db: ReturnType<typeof createTestDb>,
  options: {
    id?: number;
    reportCount?: number;
    recentUnique?: number;
    status?: string;
    removalRequestId?: number | null;
  } = {},
) {
  const now = new Date().toISOString();
  db.raw()
    .prepare(
      `INSERT INTO numbers
        (id, number_hash, phone_number_enc, display_mask, country_code, status,
         report_count, unique_reporter_count, recent_unique_reporter_count,
         removal_request_id, first_reported_at, last_reported_at, updated_at, status_checked_at)
       VALUES (?, ?, ?, ?, 'PH', ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      options.id ?? 1,
      await hashNumber(
        "test-secret",
        options.id && options.id !== 1 ? `${E164}#${options.id}` : E164,
      ),
      await encryptE164("test-secret", E164),
      "+63 917 *** 4567",
      options.status ?? "pending",
      options.reportCount ?? 1,
      options.reportCount ?? options.recentUnique ?? 1,
      options.recentUnique ?? 1,
      options.removalRequestId ?? null,
      now,
      now,
      now,
      now,
    );

  const numberId = options.id ?? 1;
  for (let index = 0; index < (options.recentUnique ?? 1); index++) {
    db.raw()
      .prepare(
        "INSERT INTO reports (number_id, reporter_hash, category, created_at) VALUES (?, ?, 'scam', ?)",
      )
      .run(numberId, `v2:seed-${numberId}-${index}`, now);
  }
}

describe("removal request flow", () => {
  let env: Env;
  let db: ReturnType<typeof createTestDb>;

  beforeEach(() => {
    vi.restoreAllMocks();
    stubTurnstile("removal_request");
    db = createTestDb();
    env = makeTestEnv(db);
  });

  it("rejects removal requests for numbers never reported", async () => {
    const response = await handleCreateRemovalRequest(createRequest(), env);
    const body = (await response.json()) as { error?: { code?: string } };
    expect(response.status).toBe(404);
    expect(body.error?.code).toBe("NUMBER_NOT_REPORTED");
  });

  it("creates a low-confidence request with a 7-day deadline", async () => {
    await insertNumber(db, { reportCount: 1, recentUnique: 1 });
    const before = Date.now();

    const response = await handleCreateRemovalRequest(createRequest(), env);
    const body = (await response.json()) as Record<string, unknown>;
    const deadline = new Date(String(body.contestDeadline)).getTime();

    expect(response.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.reviewRequired).toBe(false);
    expect(body.publicToken).toMatch(/^[0-9a-f]{32}$/);
    expect(deadline - before).toBeGreaterThan(6.9 * 24 * 60 * 60 * 1000);

    const number = db
      .raw()
      .prepare("SELECT status, removal_request_id FROM numbers WHERE id = 1")
      .get() as { status: string; removal_request_id: number };
    expect(number.status).toBe("under_removal_review");
    expect(number.removal_request_id).toBe(1);
  });

  it("flags verified numbers for operator review", async () => {
    await insertNumber(db, { reportCount: 3, recentUnique: 3 });

    const response = await handleCreateRemovalRequest(createRequest(), env);
    const body = (await response.json()) as Record<string, unknown>;
    expect(body.reviewRequired).toBe(true);
  });

  it("prevents duplicate open removal requests", async () => {
    await insertNumber(db);
    expect(
      (await handleCreateRemovalRequest(createRequest(), env)).status,
    ).toBe(200);

    const response = await handleCreateRemovalRequest(createRequest(), env);
    const body = (await response.json()) as { error?: { code?: string } };
    expect(response.status).toBe(409);
    expect(body.error?.code).toBe("DUPLICATE_REMOVAL_REQUEST");
  });

  it("enforces a cooldown after a rejected request", async () => {
    await insertNumber(db);
    const now = new Date().toISOString();
    db.raw()
      .prepare(
        `INSERT INTO removal_requests
          (id, number_id, requester_hash, reason, status, contest_deadline, created_at, updated_at, public_token)
         VALUES (1, 1, 'v2:old', 'personal_number', 'rejected', ?, ?, ?, 'abcdef0123456789abcdef0123456789')`,
      )
      .run(now, now, now);

    const response = await handleCreateRemovalRequest(createRequest(), env);
    const body = (await response.json()) as { error?: { code?: string } };
    expect(response.status).toBe(409);
    expect(body.error?.code).toBe("REMOVAL_COOLDOWN");
  });

  it("limits removal requests per reporter per day", async () => {
    const requesterHash = await hashReporter("test-secret", "203.0.113.1");
    const now = new Date().toISOString();
    for (let index = 1; index <= 5; index++) {
      await insertNumber(db, { id: index });
      db.raw()
        .prepare(
          `INSERT INTO removal_requests
            (id, number_id, requester_hash, reason, status, contest_deadline, created_at, updated_at, public_token)
           VALUES (?, ?, ?, 'personal_number', 'rejected', ?, ?, ?, ?)`,
        )
        .run(
          index,
          index,
          requesterHash,
          now,
          now,
          now,
          `abcdef0123456789abcdef01234567${index}`,
        );
    }

    const response = await handleCreateRemovalRequest(createRequest(), env);
    const body = (await response.json()) as { error?: { code?: string } };
    expect(response.status).toBe(429);
    expect(body.error?.code).toBe("REMOVAL_RATE_LIMITED");
  });

  it("contests an open removal and marks the number disputed", async () => {
    await insertNumber(db);
    const created = (await (
      await handleCreateRemovalRequest(createRequest(), env)
    ).json()) as { publicToken: string };

    stubTurnstile("removal_contest");
    const response = await handleContestRemovalRequest(
      contestRequest(created.publicToken),
      env,
    );
    const body = (await response.json()) as Record<string, unknown>;

    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      ok: true,
      contestCount: 1,
      status: "disputed",
    });

    const request = db
      .raw()
      .prepare("SELECT status FROM removal_requests WHERE id = 1")
      .get() as { status: string };
    const number = db
      .raw()
      .prepare("SELECT status FROM numbers WHERE id = 1")
      .get() as { status: string };
    expect(request.status).toBe("contested");
    expect(number.status).toBe("disputed");
  });

  it("does not un-remove a removed number on contest", async () => {
    await insertNumber(db, { status: "removed", removalRequestId: 1 });
    const deadline = new Date(Date.now() + 86_400_000).toISOString();
    const token = "abcdef0123456789abcdef0123456789";
    db.raw()
      .prepare(
        `INSERT INTO removal_requests
          (id, number_id, requester_hash, reason, status, contest_deadline, created_at, updated_at, public_token)
         VALUES (1, 1, 'v2:requester', 'personal_number', 'open', ?, ?, ?, ?)`,
      )
      .run(deadline, deadline, deadline, token);

    stubTurnstile("removal_contest");
    const response = await handleContestRemovalRequest(
      contestRequest(token),
      env,
    );

    expect(response.status).toBe(200);
    const number = db
      .raw()
      .prepare("SELECT status FROM numbers WHERE id = 1")
      .get() as { status: string };
    expect(number.status).toBe("removed");
  });

  it("rejects duplicate contests from the same reporter", async () => {
    await insertNumber(db);
    const created = (await (
      await handleCreateRemovalRequest(createRequest(), env)
    ).json()) as { publicToken: string };

    stubTurnstile("removal_contest");
    await handleContestRemovalRequest(contestRequest(created.publicToken), env);
    const response = await handleContestRemovalRequest(
      contestRequest(created.publicToken),
      env,
    );
    const body = (await response.json()) as { error?: { code?: string } };
    expect(response.status).toBe(409);
    expect(body.error?.code).toBe("ALREADY_CONTESTED");
  });

  it("returns removal detail with review guidance", async () => {
    await insertNumber(db, { reportCount: 3, recentUnique: 3 });
    const created = (await (
      await handleCreateRemovalRequest(createRequest(), env)
    ).json()) as { publicToken: string };

    const request = new Request(
      `https://example.com/api/removal-requests/${created.publicToken}`,
    );
    const response = await handleGetRemovalRequest(request, env);
    const body = (await response.json()) as Record<string, unknown>;

    expect(response.status).toBe(200);
    expect(body.reviewRequired).toBe(true);
    expect(body.status).toBe("open");
  });

  it("rejects contest for non-existent requests", async () => {
    stubTurnstile("removal_contest");
    const response = await handleContestRemovalRequest(
      contestRequest("abcdef0123456789abcdef0123456789"),
      env,
    );
    expect(response.status).toBe(404);
  });

  it("rejects Turnstile failure on removal creation", async () => {
    stubTurnstile("removal_request", false);
    const response = await handleCreateRemovalRequest(createRequest(), env);
    expect(response.status).toBe(400);
  });

  it("returns 429 when the write limiter rejects creation", async () => {
    env.RATE_LIMITER_WRITE = { limit: vi.fn(async () => ({ success: false })) };
    const response = await handleCreateRemovalRequest(createRequest(), env);
    expect(response.status).toBe(429);
  });
});
