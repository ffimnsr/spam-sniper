import { beforeEach, describe, expect, it } from "vitest";
import {
  buildAdminResolveApiPath,
  getAdminExportApiPath,
  getAdminRemovalRequestsApiPath,
  getAdminSummaryApiPath,
} from "../../shared/admin-paths.ts";
import { encryptE164 } from "../lib/encryption.ts";
import { hashNumber } from "../lib/hash.ts";
import { createAccessToken } from "../test/access-token.ts";
import { accessHeaders, createTestDb, makeTestEnv } from "../test/sqlite-d1.ts";
import type { Env } from "../types.ts";
import {
  handleAdminExport,
  handleAdminRemovalRequests,
  handleAdminResolve,
  handleAdminSummary,
} from "./admin.ts";

const ADMIN_PATH = "/f4c9";
const NOW = new Date().toISOString();
const PAST = new Date(Date.now() - 60_000).toISOString();

function adminRequest(
  path: string,
  options: { method?: string; body?: unknown; access?: boolean } = {},
): Request {
  const headers: Record<string, string> = {
    ...(options.access === false ? {} : accessHeaders()),
  };
  if (options.body !== undefined) {
    headers["content-type"] = "application/json";
  }

  return new Request(`https://example.com${path}`, {
    method: options.method ?? "GET",
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });
}

async function insertNumber(
  db: ReturnType<typeof createTestDb>,
  options: {
    id: number;
    status?: string;
    recentUnique?: number;
    uniqueReporters?: number;
    removalRequestId?: number | null;
  },
) {
  const numberHash = await hashNumber("test-secret", `+1555000${options.id}`);
  const encrypted = await encryptE164("test-secret", `+1555000${options.id}`);
  db.raw()
    .prepare(
      `INSERT INTO numbers
        (id, number_hash, phone_number_enc, display_mask, country_code, status,
         report_count, unique_reporter_count, recent_unique_reporter_count,
         removal_request_id, first_reported_at, last_reported_at, updated_at, status_checked_at)
       VALUES (?, ?, ?, ?, 'US', ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      options.id,
      numberHash,
      encrypted,
      `+1 555 *** 000${options.id}`,
      options.status ?? "pending",
      options.uniqueReporters ?? options.recentUnique ?? 1,
      options.uniqueReporters ?? options.recentUnique ?? 1,
      options.recentUnique ?? 1,
      options.removalRequestId ?? null,
      NOW,
      NOW,
      NOW,
      NOW,
    );
}

function insertRequest(
  db: ReturnType<typeof createTestDb>,
  options: {
    id: number;
    numberId: number;
    status?: string;
    deadline?: string;
    reason?: string;
  },
) {
  db.raw()
    .prepare(
      `INSERT INTO removal_requests
        (id, number_id, requester_hash, reason, status, contest_deadline, created_at, updated_at, public_token)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      options.id,
      options.numberId,
      "v2:requester",
      options.reason ?? "personal_number",
      options.status ?? "open",
      options.deadline ?? PAST,
      NOW,
      NOW,
      `abcdef0123456789abcdef01234567${options.id}`,
    );
}

describe("admin API with Cloudflare Access", () => {
  let env: Env;
  let db: ReturnType<typeof createTestDb>;

  beforeEach(() => {
    db = createTestDb();
    env = makeTestEnv(db);
  });

  it("rejects requests without Access headers", async () => {
    const response = await handleAdminSummary(
      adminRequest(getAdminSummaryApiPath(ADMIN_PATH), { access: false }),
      env,
    );
    expect(response.status).toBe(401);
  });

  it("rejects a token issued for another Access application", async () => {
    const response = await handleAdminSummary(
      new Request(`https://example.com${getAdminSummaryApiPath(ADMIN_PATH)}`, {
        headers: {
          ...accessHeaders(),
          "cf-access-jwt-assertion": createAccessToken({
            aud: ["another-application"],
          }),
        },
      }),
      env,
    );

    expect(response.status).toBe(401);
  });

  it("returns summary counts and maintenance state", async () => {
    await insertNumber(db, { id: 1, status: "pending" });
    await insertNumber(db, {
      id: 2,
      status: "verified_spam",
      recentUnique: 3,
      uniqueReporters: 3,
      removalRequestId: 7,
    });
    insertRequest(db, { id: 7, numberId: 2, status: "pending_review" });
    db.raw()
      .prepare(
        "INSERT INTO system_state (key, value, updated_at) VALUES ('finalizer_last_run', '2026-10-01T00:00:00.000Z', ?)",
      )
      .run(NOW);

    const response = await handleAdminSummary(
      adminRequest(getAdminSummaryApiPath(ADMIN_PATH)),
      env,
    );
    const body = (await response.json()) as Record<string, unknown>;

    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      totalNumbers: 2,
      pending: 1,
      verifiedSpam: 1,
      pendingReviewRemovalRequests: 1,
      openRemovalRequests: 0,
    });
    expect(body.maintenance).toEqual({
      finalizer_last_run: "2026-10-01T00:00:00.000Z",
    });
    expect(body.recentAudit).toEqual([]);
  });

  it("approves removal and keeps the audit trail", async () => {
    await insertNumber(db, {
      id: 11,
      status: "under_removal_review",
      recentUnique: 1,
      removalRequestId: 7,
    });
    insertRequest(db, { id: 7, numberId: 11, status: "open" });

    const response = await handleAdminResolve(
      adminRequest(buildAdminResolveApiPath(ADMIN_PATH, 7), {
        method: "POST",
        body: { action: "approve_removal" },
      }),
      env,
    );

    expect(response.status).toBe(200);
    const request = db
      .raw()
      .prepare("SELECT status FROM removal_requests WHERE id = 7")
      .get() as { status: string };
    const number = db
      .raw()
      .prepare("SELECT status, removal_request_id FROM numbers WHERE id = 11")
      .get() as { status: string; removal_request_id: number };
    const audit = db
      .raw()
      .prepare("SELECT actor, action FROM admin_audit_log")
      .get() as { actor: string; action: string };

    expect(request.status).toBe("approved");
    expect(number.status).toBe("removed");
    expect(number.removal_request_id).toBe(7);
    expect(audit).toEqual({
      actor: "operator@example.com",
      action: "approve_removal",
    });
  });

  it("rejects removal and recomputes status from recent reports", async () => {
    await insertNumber(db, {
      id: 11,
      status: "under_removal_review",
      recentUnique: 3,
      uniqueReporters: 4,
      removalRequestId: 7,
    });
    insertRequest(db, { id: 7, numberId: 11, status: "pending_review" });
    for (let reporter = 0; reporter < 3; reporter++) {
      db.raw()
        .prepare(
          "INSERT INTO reports (number_id, reporter_hash, category, created_at) VALUES (11, ?, 'scam', ?)",
        )
        .run(`v2:reject-${reporter}`, NOW);
    }

    const response = await handleAdminResolve(
      adminRequest(buildAdminResolveApiPath(ADMIN_PATH, 7), {
        method: "POST",
        body: { action: "reject_removal" },
      }),
      env,
    );

    expect(response.status).toBe(200);
    const number = db
      .raw()
      .prepare("SELECT status, removal_request_id FROM numbers WHERE id = 11")
      .get() as { status: string; removal_request_id: number | null };
    expect(number.status).toBe("verified_spam");
    expect(number.removal_request_id).toBeNull();
  });

  it("does not un-remove a legacy removed number on rejection", async () => {
    await insertNumber(db, {
      id: 11,
      status: "removed",
      recentUnique: 1,
      removalRequestId: 7,
    });
    insertRequest(db, { id: 7, numberId: 11, status: "pending_review" });

    const response = await handleAdminResolve(
      adminRequest(buildAdminResolveApiPath(ADMIN_PATH, 7), {
        method: "POST",
        body: { action: "reject_removal" },
      }),
      env,
    );
    const body = (await response.json()) as { numberStatus: string };

    expect(response.status).toBe(200);
    expect(body.numberStatus).toBe("removed");
    const number = db
      .raw()
      .prepare("SELECT status FROM numbers WHERE id = 11")
      .get() as { status: string };
    expect(number.status).toBe("removed");
  });

  it("marks a request disputed", async () => {
    await insertNumber(db, {
      id: 11,
      status: "under_removal_review",
      removalRequestId: 7,
    });
    insertRequest(db, { id: 7, numberId: 11, status: "open" });

    const response = await handleAdminResolve(
      adminRequest(buildAdminResolveApiPath(ADMIN_PATH, 7), {
        method: "POST",
        body: { action: "mark_disputed" },
      }),
      env,
    );

    expect(response.status).toBe(200);
    const number = db
      .raw()
      .prepare("SELECT status FROM numbers WHERE id = 11")
      .get() as { status: string };
    expect(number.status).toBe("disputed");
  });

  it("rejects invalid state transitions", async () => {
    await insertNumber(db, {
      id: 11,
      status: "under_removal_review",
      removalRequestId: 7,
    });
    insertRequest(db, { id: 7, numberId: 11, status: "approved" });

    const response = await handleAdminResolve(
      adminRequest(buildAdminResolveApiPath(ADMIN_PATH, 7), {
        method: "POST",
        body: { action: "mark_disputed" },
      }),
      env,
    );
    expect(response.status).toBe(409);
  });

  it("lists pending review requests with contest reasons", async () => {
    await insertNumber(db, {
      id: 11,
      status: "under_removal_review",
      removalRequestId: 7,
    });
    insertRequest(db, { id: 7, numberId: 11, status: "pending_review" });
    db.raw()
      .prepare(
        "INSERT INTO removal_contests (removal_request_id, contestant_hash, reason, created_at) VALUES (7, 'v2:a', 'still_spam', ?), (7, 'v2:b', 'known_scam_number', ?)",
      )
      .run(NOW, NOW);

    const response = await handleAdminRemovalRequests(
      adminRequest(
        `${getAdminRemovalRequestsApiPath(ADMIN_PATH)}?status=pending_review`,
      ),
      env,
    );
    const body = (await response.json()) as {
      requests: Array<{ contest_reasons: string; contest_count: number }>;
      total: number;
    };

    expect(response.status).toBe(200);
    expect(body.total).toBe(1);
    expect(body.requests[0]?.contest_count).toBe(2);
    expect(body.requests[0]?.contest_reasons).toContain("still_spam");
  });

  it("paginates and decrypts the verified export", async () => {
    for (const id of [1, 2]) {
      await insertNumber(db, {
        id,
        status: "verified_spam",
        recentUnique: 3,
        uniqueReporters: 3,
      });
      for (let reporter = 0; reporter < 3; reporter++) {
        db.raw()
          .prepare(
            "INSERT INTO reports (number_id, reporter_hash, category, created_at) VALUES (?, ?, 'bank_scam', ?)",
          )
          .run(id, `v2:reporter-${id}-${reporter}`, NOW);
      }
    }

    const first = await handleAdminExport(
      adminRequest(`${getAdminExportApiPath(ADMIN_PATH)}?limit=1&offset=0`),
      env,
    );
    const firstBody = (await first.json()) as {
      total_entries: number;
      has_more: boolean;
      next_offset: number | null;
      entries: Array<{ phone_number_e164: string; category: string }>;
    };

    expect(first.status).toBe(200);
    expect(firstBody.total_entries).toBe(2);
    expect(firstBody.entries).toHaveLength(1);
    expect(firstBody.has_more).toBe(true);
    expect(firstBody.next_offset).toBe(1);
    expect(firstBody.entries[0]?.phone_number_e164).toMatch(/^\+1555/);
    expect(firstBody.entries[0]?.category).toBe("bank scam");

    const second = await handleAdminExport(
      adminRequest(`${getAdminExportApiPath(ADMIN_PATH)}?limit=1&offset=1`),
      env,
    );
    const secondBody = (await second.json()) as {
      has_more: boolean;
      entries: Array<{ phone_number_e164: string }>;
    };
    expect(secondBody.has_more).toBe(false);
    expect(secondBody.entries).toHaveLength(1);
    expect(secondBody.entries[0]?.phone_number_e164).not.toBe(
      firstBody.entries[0]?.phone_number_e164,
    );

    const auditCount = db
      .raw()
      .prepare(
        "SELECT COUNT(*) AS count FROM admin_audit_log WHERE action = 'export_verified_spam'",
      )
      .get() as { count: number };
    expect(auditCount.count).toBe(2);
  });

  it("skips rows that cannot be decrypted instead of exporting the mask", async () => {
    await insertNumber(db, {
      id: 3,
      status: "verified_spam",
      recentUnique: 3,
      uniqueReporters: 3,
    });
    for (let reporter = 0; reporter < 3; reporter++) {
      db.raw()
        .prepare(
          "INSERT INTO reports (number_id, reporter_hash, category, created_at) VALUES (3, ?, 'scam', ?)",
        )
        .run(`v2:skip-${reporter}`, NOW);
    }
    db.raw()
      .prepare(
        "UPDATE numbers SET phone_number_enc = 'v1.bad.bad', phone_number_e164 = NULL WHERE id = 3",
      )
      .run();

    const response = await handleAdminExport(
      adminRequest(getAdminExportApiPath(ADMIN_PATH)),
      env,
    );
    const body = (await response.json()) as {
      total_entries: number;
      returned_entries: number;
      skipped_entries: number;
      entries: unknown[];
    };

    expect(response.status).toBe(200);
    expect(body.total_entries).toBe(1);
    expect(body.returned_entries).toBe(0);
    expect(body.skipped_entries).toBe(1);
    expect(body.entries).toEqual([]);
  });

  it("rejects invalid export query parameters", async () => {
    const response = await handleAdminExport(
      adminRequest(`${getAdminExportApiPath(ADMIN_PATH)}?limit=5000`),
      env,
    );
    expect(response.status).toBe(400);
  });
});
