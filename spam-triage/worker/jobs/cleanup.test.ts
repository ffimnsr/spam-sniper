import { describe, expect, it } from "vitest";
import { createTestDb, makeTestEnv } from "../test/sqlite-d1.ts";
import { cleanupRetainedData } from "./cleanup.ts";

const OLD = "2024-01-01T00:00:00.000Z";
const NOW = new Date().toISOString();

function seedNumber(db: ReturnType<typeof createTestDb>, id: number) {
  db.raw()
    .prepare(
      `INSERT INTO numbers
        (id, number_hash, display_mask, status, report_count, unique_reporter_count,
         recent_unique_reporter_count, first_reported_at, last_reported_at, updated_at, status_checked_at)
       VALUES (?, ?, ?, 'pending', 1, 1, 0, ?, ?, ?, ?)`,
    )
    .run(id, `v2:number-${id}`, `+1 555 *** 000${id}`, OLD, OLD, OLD, OLD);
}

describe("cleanupRetainedData", () => {
  it("purges old reports and rebuilds aggregates", async () => {
    const db = createTestDb();
    seedNumber(db, 1);
    db.raw()
      .prepare(
        "INSERT INTO reports (number_id, reporter_hash, category, created_at) VALUES (1, 'v2:a', 'scam', ?)",
      )
      .run(OLD);

    db.resetQueryCount();
    const result = await cleanupRetainedData(makeTestEnv(db));

    expect(db.queryCount).toBeLessThan(50);
    expect(result.reportsDeleted).toBe(1);
    const reports = db
      .raw()
      .prepare("SELECT COUNT(*) AS count FROM reports")
      .get() as { count: number };
    const number = db
      .raw()
      .prepare(
        "SELECT report_count, unique_reporter_count, status FROM numbers WHERE id = 1",
      )
      .get() as {
      report_count: number;
      unique_reporter_count: number;
      status: string;
    };
    expect(reports.count).toBe(0);
    expect(number).toMatchObject({
      report_count: 0,
      unique_reporter_count: 0,
      status: "pending",
    });
  });

  it("purges old resolved moderation records and audit rows", async () => {
    const db = createTestDb();
    seedNumber(db, 99);
    db.raw()
      .prepare(
        `INSERT INTO removal_requests
          (id, number_id, requester_hash, reason, status, contest_deadline, created_at, updated_at, public_token)
         VALUES (9, 99, 'v2:r', 'personal_number', 'rejected', ?, ?, ?, 'abcdef0123456789abcdef0123456789')`,
      )
      .run(OLD, OLD, OLD);
    db.raw()
      .prepare(
        "INSERT INTO removal_contests (removal_request_id, contestant_hash, reason, created_at) VALUES (9, 'v2:c', 'still_spam', ?)",
      )
      .run(OLD);
    db.raw()
      .prepare(
        "INSERT INTO admin_audit_log (actor, action, target_type, target_id, metadata, created_at) VALUES ('system', 'test', 'removal_request', 9, NULL, ?)",
      )
      .run(OLD);
    db.raw()
      .prepare(
        "INSERT INTO admin_audit_log (actor, action, target_type, target_id, metadata, created_at) VALUES ('system', 'recent', 'removal_request', 10, NULL, ?)",
      )
      .run(NOW);

    const result = await cleanupRetainedData(makeTestEnv(db));

    expect(result.contestsDeleted).toBe(1);
    expect(result.removalRequestsDeleted).toBe(1);
    expect(result.auditRowsDeleted).toBe(1);
    const requests = db
      .raw()
      .prepare("SELECT COUNT(*) AS count FROM removal_requests")
      .get() as { count: number };
    const audit = db
      .raw()
      .prepare("SELECT COUNT(*) AS count FROM admin_audit_log")
      .get() as { count: number };
    expect(requests.count).toBe(0);
    expect(audit.count).toBe(1);
  });
});
