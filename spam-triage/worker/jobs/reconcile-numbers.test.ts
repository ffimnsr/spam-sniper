import { describe, expect, it } from "vitest";
import { createTestDb, makeTestEnv } from "../test/sqlite-d1.ts";
import { reconcileNumbers } from "./reconcile-numbers.ts";

const OLD = "2025-01-01T00:00:00.000Z";
const NOW = new Date().toISOString();

function insertNumber(
  db: ReturnType<typeof createTestDb>,
  options: {
    id: number;
    status: string;
    reportCount: number;
    unique: number;
    recent: number;
    removalRequestId?: number | null;
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
      options.id,
      `v2:number-${options.id}`,
      `+1 555 *** 000${options.id}`,
      options.status,
      options.reportCount,
      options.unique,
      options.recent,
      options.removalRequestId ?? null,
      OLD,
      OLD,
      OLD,
      OLD,
    );
}

function insertReport(
  db: ReturnType<typeof createTestDb>,
  numberId: number,
  reporter: string,
  createdAt: string,
) {
  db.raw()
    .prepare(
      "INSERT INTO reports (number_id, reporter_hash, category, created_at) VALUES (?, ?, 'scam', ?)",
    )
    .run(numberId, reporter, createdAt);
}

describe("reconcileNumbers", () => {
  it("rebuilds counters and status from current reports", async () => {
    const db = createTestDb();
    insertNumber(db, {
      id: 1,
      status: "verified_spam",
      reportCount: 99,
      unique: 99,
      recent: 99,
    });
    insertReport(db, 1, "v2:a", NOW);
    insertReport(db, 1, "v2:b", NOW);

    db.resetQueryCount();
    const result = await reconcileNumbers(makeTestEnv(db));

    expect(db.queryCount).toBeLessThan(50);
    expect(result).toMatchObject({ checked: 1 });
    const number = db
      .raw()
      .prepare("SELECT * FROM numbers WHERE id = 1")
      .get() as {
      status: string;
      report_count: number;
      unique_reporter_count: number;
      recent_unique_reporter_count: number;
    };
    expect(number).toMatchObject({
      status: "suspected",
      report_count: 2,
      unique_reporter_count: 2,
      recent_unique_reporter_count: 2,
    });
  });

  it("drops stale status when reports fall outside the recent window", async () => {
    const db = createTestDb();
    insertNumber(db, {
      id: 1,
      status: "verified_spam",
      reportCount: 3,
      unique: 3,
      recent: 3,
    });
    for (const reporter of ["a", "b", "c"]) {
      insertReport(db, 1, `v2:${reporter}`, "2025-01-01T00:00:00.000Z");
    }

    await reconcileNumbers(makeTestEnv(db));

    const number = db
      .raw()
      .prepare(
        "SELECT status, recent_unique_reporter_count FROM numbers WHERE id = 1",
      )
      .get() as { status: string; recent_unique_reporter_count: number };
    expect(number.status).toBe("pending");
    expect(number.recent_unique_reporter_count).toBe(0);
  });

  it("keeps legacy removed status without a removal pointer", async () => {
    const db = createTestDb();
    insertNumber(db, {
      id: 1,
      status: "removed",
      reportCount: 0,
      unique: 0,
      recent: 0,
    });

    await reconcileNumbers(makeTestEnv(db));

    const number = db
      .raw()
      .prepare("SELECT status, removal_request_id FROM numbers WHERE id = 1")
      .get() as { status: string; removal_request_id: number | null };
    expect(number.status).toBe("removed");
    expect(number.removal_request_id).toBeNull();
  });

  it("preserves active removal status", async () => {
    const db = createTestDb();
    insertNumber(db, {
      id: 1,
      status: "under_removal_review",
      reportCount: 1,
      unique: 1,
      recent: 1,
      removalRequestId: 5,
    });
    db.raw()
      .prepare(
        `INSERT INTO removal_requests
          (id, number_id, requester_hash, reason, status, contest_deadline, created_at, updated_at, public_token)
         VALUES (5, 1, 'v2:r', 'personal_number', 'open', ?, ?, ?, 'abcdef0123456789abcdef0123456789')`,
      )
      .run(NOW, NOW, NOW);

    await reconcileNumbers(makeTestEnv(db));

    const number = db
      .raw()
      .prepare("SELECT status FROM numbers WHERE id = 1")
      .get() as { status: string };
    expect(number.status).toBe("under_removal_review");
  });
});
