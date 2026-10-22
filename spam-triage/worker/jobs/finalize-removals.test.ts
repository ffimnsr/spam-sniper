import { describe, expect, it } from "vitest";
import { createTestDb, makeTestEnv } from "../test/sqlite-d1.ts";
import { finalizeRemovalRequests } from "./finalize-removals.ts";

const NOW = new Date().toISOString();
const PAST = new Date(Date.now() - 60_000).toISOString();

function seed(
  db: ReturnType<typeof createTestDb>,
  options: {
    numberId: number;
    requestId: number;
    recentUnique: number;
    contests?: number;
    linkNumber?: boolean;
    status?: string;
  },
) {
  db.raw()
    .prepare(
      `INSERT INTO numbers
        (id, number_hash, display_mask, status, report_count, unique_reporter_count,
         recent_unique_reporter_count, removal_request_id, first_reported_at,
         last_reported_at, updated_at, status_checked_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      options.numberId,
      `v2:number-${options.numberId}`,
      "+1 555 *** 4567",
      options.status ?? "under_removal_review",
      options.recentUnique,
      options.recentUnique,
      options.recentUnique,
      options.linkNumber === false ? null : options.requestId,
      NOW,
      NOW,
      NOW,
      NOW,
    );

  db.raw()
    .prepare(
      `INSERT INTO removal_requests
        (id, number_id, requester_hash, reason, status, contest_deadline, created_at, updated_at, public_token)
       VALUES (?, ?, ?, 'personal_number', 'open', ?, ?, ?, ?)`,
    )
    .run(
      options.requestId,
      options.numberId,
      "v2:requester",
      PAST,
      NOW,
      NOW,
      `token-${options.requestId}`,
    );

  for (let index = 0; index < options.recentUnique; index++) {
    db.raw()
      .prepare(
        "INSERT INTO reports (number_id, reporter_hash, category, created_at) VALUES (?, ?, 'scam', ?)",
      )
      .run(options.numberId, `v2:reporter-${options.numberId}-${index}`, NOW);
  }

  for (let index = 0; index < (options.contests ?? 0); index++) {
    db.raw()
      .prepare(
        `INSERT INTO removal_contests
          (removal_request_id, contestant_hash, reason, created_at)
         VALUES (?, ?, 'still_spam', ?)`,
      )
      .run(options.requestId, `v2:contestant-${index}`, NOW);
  }
}

describe("finalizeRemovalRequests", () => {
  it("auto-approves uncontested low-confidence removals", async () => {
    const db = createTestDb();
    seed(db, { numberId: 1, requestId: 10, recentUnique: 2 });

    db.resetQueryCount();
    const result = await finalizeRemovalRequests(makeTestEnv(db));

    expect(db.queryCount).toBeLessThan(50);
    expect(result).toMatchObject({ processed: 1, approved: 1 });
    const request = db
      .raw()
      .prepare("SELECT status FROM removal_requests WHERE id = 10")
      .get() as { status: string };
    const number = db
      .raw()
      .prepare("SELECT status, removal_request_id FROM numbers WHERE id = 1")
      .get() as { status: string; removal_request_id: number };
    expect(request.status).toBe("approved");
    expect(number.status).toBe("removed");
    expect(number.removal_request_id).toBe(10);

    const audit = db
      .raw()
      .prepare(
        "SELECT COUNT(*) AS count FROM admin_audit_log WHERE action = 'finalize_removal'",
      )
      .get() as { count: number };
    expect(audit.count).toBe(1);
  });

  it("links a number when the request pointer was missing", async () => {
    const db = createTestDb();
    seed(db, {
      numberId: 1,
      requestId: 10,
      recentUnique: 1,
      linkNumber: false,
    });

    await finalizeRemovalRequests(makeTestEnv(db));

    const number = db
      .raw()
      .prepare("SELECT status, removal_request_id FROM numbers WHERE id = 1")
      .get() as { status: string; removal_request_id: number };
    expect(number.status).toBe("removed");
    expect(number.removal_request_id).toBe(10);
  });

  it("does not overwrite a removed number with a finalizer decision", async () => {
    const db = createTestDb();
    seed(db, {
      numberId: 1,
      requestId: 10,
      recentUnique: 1,
      linkNumber: false,
      status: "removed",
    });

    await finalizeRemovalRequests(makeTestEnv(db));

    const number = db
      .raw()
      .prepare("SELECT status, removal_request_id FROM numbers WHERE id = 1")
      .get() as { status: string; removal_request_id: number | null };
    expect(number.status).toBe("removed");
    expect(number.removal_request_id).toBeNull();
  });

  it("routes uncontested verified removals to operator review", async () => {
    const db = createTestDb();
    seed(db, { numberId: 1, requestId: 10, recentUnique: 3 });

    const result = await finalizeRemovalRequests(makeTestEnv(db));

    expect(result).toMatchObject({ processed: 1, pendingReview: 1 });
    const request = db
      .raw()
      .prepare("SELECT status FROM removal_requests WHERE id = 10")
      .get() as { status: string };
    const number = db
      .raw()
      .prepare("SELECT status FROM numbers WHERE id = 1")
      .get() as { status: string };
    expect(request.status).toBe("pending_review");
    expect(number.status).toBe("under_removal_review");
  });

  it("marks contested requests as disputed", async () => {
    const db = createTestDb();
    seed(db, { numberId: 1, requestId: 10, recentUnique: 1, contests: 1 });

    const result = await finalizeRemovalRequests(makeTestEnv(db));

    expect(result).toMatchObject({ processed: 1, contested: 1 });
    const request = db
      .raw()
      .prepare("SELECT status FROM removal_requests WHERE id = 10")
      .get() as { status: string };
    const number = db
      .raw()
      .prepare("SELECT status FROM numbers WHERE id = 1")
      .get() as { status: string };
    expect(request.status).toBe("contested");
    expect(number.status).toBe("disputed");
  });

  it("drains more than one bounded batch per run", async () => {
    const db = createTestDb();
    const insertNumber = db.raw().prepare(
      `INSERT INTO numbers
        (id, number_hash, display_mask, status, report_count, unique_reporter_count,
         recent_unique_reporter_count, removal_request_id, first_reported_at,
         last_reported_at, updated_at, status_checked_at)
       VALUES (?, ?, ?, 'under_removal_review', 0, 0, 0, ?, ?, ?, ?, ?)`,
    );
    const insertRequest = db.raw().prepare(
      `INSERT INTO removal_requests
        (id, number_id, requester_hash, reason, status, contest_deadline, created_at, updated_at, public_token)
       VALUES (?, ?, 'v2:requester', 'personal_number', 'open', ?, ?, ?, ?)`,
    );

    // 1,001 rows forces a second batch past FINALIZER_BATCH_SIZE.
    for (let index = 1; index <= 1_001; index++) {
      insertNumber.run(
        index,
        `v2:number-${index}`,
        `+1 555 *** ${String(index).padStart(4, "0")}`,
        index,
        NOW,
        NOW,
        NOW,
        NOW,
      );
      insertRequest.run(
        index,
        index,
        PAST,
        NOW,
        NOW,
        `abcdef0123456789abcdef01234567${index}`,
      );
    }

    db.resetQueryCount();
    const result = await finalizeRemovalRequests(makeTestEnv(db));

    expect(db.queryCount).toBeLessThan(50);
    expect(result).toMatchObject({
      processed: 1_001,
      approved: 1_001,
      pendingReview: 0,
      contested: 0,
    });
    const remaining = db
      .raw()
      .prepare(
        "SELECT COUNT(*) AS count FROM removal_requests WHERE status = 'open'",
      )
      .get() as { count: number };
    expect(remaining.count).toBe(0);
  });

  it("leaves already-resolved requests untouched", async () => {
    const db = createTestDb();
    seed(db, { numberId: 1, requestId: 10, recentUnique: 1 });
    db.raw()
      .prepare("UPDATE removal_requests SET status = 'contested' WHERE id = 10")
      .run();

    const result = await finalizeRemovalRequests(makeTestEnv(db));

    expect(result.processed).toBe(0);
    const number = db
      .raw()
      .prepare("SELECT status FROM numbers WHERE id = 1")
      .get() as { status: string };
    expect(number.status).toBe("under_removal_review");
  });
});
