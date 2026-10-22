import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { describe, expect, it } from "vitest";

function applyMigrations(db: DatabaseSync, upTo?: string) {
  const dir = join(process.cwd(), "migrations");
  const files = readdirSync(dir)
    .filter((file) => file.endsWith(".sql"))
    .sort();

  for (const file of files) {
    db.exec(readFileSync(join(dir, file), "utf8"));
    if (file === upTo) break;
  }
}

function insertNumber(
  db: DatabaseSync,
  options: {
    id: number;
    status: string;
    removalRequestId?: number | null;
  },
) {
  db.prepare(
    `INSERT INTO numbers
      (id, number_hash, display_mask, status, removal_request_id,
       first_reported_at, last_reported_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    options.id,
    `legacy-${options.id}`,
    `+1 555 *** 000${options.id}`,
    options.status,
    options.removalRequestId ?? null,
    "2025-01-01T00:00:00.000Z",
    "2025-01-01T00:00:00.000Z",
    "2025-01-01T00:00:00.000Z",
  );
}

function insertRemovalRequest(
  db: DatabaseSync,
  options: { id: number; numberId: number; status: string },
) {
  db.prepare(
    `INSERT INTO removal_requests
      (id, number_id, requester_hash, reason, status, contest_deadline,
       created_at, updated_at, public_token)
     VALUES (?, ?, 'legacy-requester', 'personal_number', ?, ?, ?, ?, ?)`,
  ).run(
    options.id,
    options.numberId,
    options.status,
    "2025-01-01T00:00:00.000Z",
    "2025-01-01T00:00:00.000Z",
    "2025-01-01T00:00:00.000Z",
    `legacy-token-${options.id}`,
  );
}

describe("migration 0005 legacy removal backfill", () => {
  it("relinks approved removals and preserves removed status", () => {
    const db = new DatabaseSync(":memory:");
    applyMigrations(db, "0004_encrypt_e164_and_unique_open.sql");

    insertNumber(db, { id: 1, status: "removed" });
    insertNumber(db, { id: 2, status: "removed" });
    insertNumber(db, { id: 3, status: "pending" });
    insertRemovalRequest(db, { id: 10, numberId: 1, status: "approved" });
    insertRemovalRequest(db, { id: 11, numberId: 2, status: "rejected" });

    db.exec(
      readFileSync(
        join(
          process.cwd(),
          "migrations/0005_recent_status_audit_and_integrity.sql",
        ),
        "utf8",
      ),
    );

    const rows = db
      .prepare("SELECT id, status, removal_request_id FROM numbers ORDER BY id")
      .all() as Array<{
      id: number;
      status: string;
      removal_request_id: number | null;
    }>;

    expect(rows[0]).toEqual({
      id: 1,
      status: "removed",
      removal_request_id: 10,
    });
    expect(rows[1]).toEqual({
      id: 2,
      status: "removed",
      removal_request_id: null,
    });
    expect(rows[2]).toEqual({
      id: 3,
      status: "pending",
      removal_request_id: null,
    });
  });
});
