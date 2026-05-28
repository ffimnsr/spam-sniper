import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Env } from "../types.ts";
import { handleAdminResolve } from "./admin.ts";

class MockStatement {
  private readonly sql: string;
  private readonly state: {
    removalRequest: { id: number; numberId: number; status: string };
    number: { id: number; status: string; removalRequestId: number | null };
    uniqueReporters: number;
  };

  constructor(
    sql: string,
    state: {
      removalRequest: { id: number; numberId: number; status: string };
      number: { id: number; status: string; removalRequestId: number | null };
      uniqueReporters: number;
    },
  ) {
    this.sql = sql;
    this.state = state;
  }

  private params: unknown[] = [];

  bind(...params: unknown[]) {
    this.params = params;
    return this;
  }

  async first<T>() {
    if (this.sql.includes("SELECT id, number_id FROM removal_requests")) {
      return {
        id: this.state.removalRequest.id,
        number_id: this.state.removalRequest.numberId,
      } as T;
    }

    if (
      this.sql.includes(
        "SELECT COUNT(DISTINCT reporter_hash) as unique FROM reports",
      )
    ) {
      return { unique: this.state.uniqueReporters } as T;
    }

    return null as T;
  }

  async run() {
    if (this.sql.includes("UPDATE removal_requests SET status = ?")) {
      this.state.removalRequest.status = String(this.params[0]);
      return { meta: {} };
    }

    if (
      this.sql.includes(
        "UPDATE numbers SET status = ?, removal_request_id = NULL",
      )
    ) {
      this.state.number.status = String(this.params[0]);
      this.state.number.removalRequestId = null;
      return { meta: {} };
    }

    if (this.sql.includes("UPDATE numbers SET status = ?, updated_at = ?")) {
      this.state.number.status = String(this.params[0]);
      return { meta: {} };
    }

    return { meta: {} };
  }
}

class MockDb {
  private readonly state: {
    removalRequest: { id: number; numberId: number; status: string };
    number: { id: number; status: string; removalRequestId: number | null };
    uniqueReporters: number;
  };

  constructor(
    state: {
      removalRequest: { id: number; numberId: number; status: string };
      number: { id: number; status: string; removalRequestId: number | null };
      uniqueReporters: number;
    },
  ) {
    this.state = state;
  }

  prepare(sql: string) {
    return new MockStatement(sql, this.state);
  }
}

describe("handleAdminResolve", () => {
  let env: Env;
  let state: {
    removalRequest: { id: number; numberId: number; status: string };
    number: { id: number; status: string; removalRequestId: number | null };
    uniqueReporters: number;
  };

  beforeEach(() => {
    vi.restoreAllMocks();
    state = {
      removalRequest: { id: 7, numberId: 11, status: "open" },
      number: { id: 11, status: "under_removal_review", removalRequestId: 7 },
      uniqueReporters: 3,
    };

    env = {
      DB: new MockDb(state) as unknown as D1Database,
      ASSETS: { fetch: vi.fn() } as unknown as Fetcher,
      HASH_SECRET: "secret",
      TURNSTILE_SECRET_KEY: "turnstile",
      ADMIN_PASSWORD: "admin",
    };
  });

  it("clears active removal linkage when admin rejects removal", async () => {
    const request = new Request(
      "https://example.com/api/admin/removal-requests/7/resolve",
      {
        method: "POST",
        headers: {
          Authorization: "Bearer admin",
          "content-type": "application/json",
        },
        body: JSON.stringify({ action: "reject_removal" }),
      },
    );

    const response = await handleAdminResolve(request, env);

    expect(response.status).toBe(200);
    expect(state.removalRequest.status).toBe("rejected");
    expect(state.number.status).toBe("verified_spam");
    expect(state.number.removalRequestId).toBeNull();
  });
});
