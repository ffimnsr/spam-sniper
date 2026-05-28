import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Env } from "../types.ts";
import { handleAdminResolve, handleAdminSummary } from "./admin.ts";

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

    if (this.sql.includes("FROM numbers WHERE status = ?")) {
      const status = String(this.params[0]);
      const counts: Record<string, number> = {
        pending: 2,
        suspected: 1,
        verified_spam: 1,
        under_removal_review: 1,
        disputed: 0,
        removed: 0,
      };
      return { count: counts[status] ?? 0 } as T;
    }

    if (this.sql.includes("FROM removal_requests WHERE status = ?")) {
      const status = String(this.params[0]);
      const counts: Record<string, number> = {
        open: 2,
        contested: 1,
      };
      return { count: counts[status] ?? 0 } as T;
    }

    if (this.sql.includes("SELECT COUNT(*) as count FROM numbers")) {
      return { count: 5 } as T;
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

  async all<T>(): Promise<{ results: T[] }> {
    return { results: [] as T[] };
  }
}

class MockDb {
  private readonly state: {
    removalRequest: { id: number; numberId: number; status: string };
    number: { id: number; status: string; removalRequestId: number | null };
    uniqueReporters: number;
  };

  constructor(state: {
    removalRequest: { id: number; numberId: number; status: string };
    number: { id: number; status: string; removalRequestId: number | null };
    uniqueReporters: number;
  }) {
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

  it("approves removal", async () => {
    const request = new Request(
      "https://example.com/api/admin/removal-requests/7/resolve",
      {
        method: "POST",
        headers: {
          Authorization: "Bearer admin",
          "content-type": "application/json",
        },
        body: JSON.stringify({ action: "approve_removal" }),
      },
    );

    const response = await handleAdminResolve(request, env);

    expect(response.status).toBe(200);
    expect(state.removalRequest.status).toBe("approved");
    expect(state.number.status).toBe("removed");
    expect(state.number.removalRequestId).toBeNull();
  });

  it("rejects removal and recomputes number status", async () => {
    state.uniqueReporters = 3;

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

  it("marks as disputed", async () => {
    const request = new Request(
      "https://example.com/api/admin/removal-requests/7/resolve",
      {
        method: "POST",
        headers: {
          Authorization: "Bearer admin",
          "content-type": "application/json",
        },
        body: JSON.stringify({ action: "mark_disputed" }),
      },
    );

    const response = await handleAdminResolve(request, env);

    expect(response.status).toBe(200);
    expect(state.removalRequest.status).toBe("contested");
    expect(state.number.status).toBe("disputed");
  });

  it("rejects request without admin auth", async () => {
    const request = new Request(
      "https://example.com/api/admin/removal-requests/7/resolve",
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "approve_removal" }),
      },
    );

    const response = await handleAdminResolve(request, env);
    expect(response.status).toBe(401);
  });

  it("rejects invalid action", async () => {
    const request = new Request(
      "https://example.com/api/admin/removal-requests/7/resolve",
      {
        method: "POST",
        headers: {
          Authorization: "Bearer admin",
          "content-type": "application/json",
        },
        body: JSON.stringify({ action: "delete_everything" }),
      },
    );

    const response = await handleAdminResolve(request, env);
    expect(response.status).toBe(400);
  });
});

describe("handleAdminSummary", () => {
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

  it("returns summary counts", async () => {
    const request = new Request("https://example.com/api/admin/summary", {
      headers: { Authorization: "Bearer admin" },
    });

    const response = await handleAdminSummary(request, env);
    const body = (await response.json()) as Record<string, unknown>;

    expect(response.status).toBe(200);
    expect(body.totalNumbers).toBe(5);
    expect(body.pending).toBe(2);
    expect(body.suspected).toBe(1);
    expect(body.verifiedSpam).toBe(1);
    expect(body.underRemovalReview).toBe(1);
    expect(body.disputed).toBe(0);
    expect(body.removed).toBe(0);
    expect(body.openRemovalRequests).toBe(2);
    expect(body.contestedRemovalRequests).toBe(1);
  });

  it("rejects request without admin auth", async () => {
    const request = new Request("https://example.com/api/admin/summary");
    const response = await handleAdminSummary(request, env);
    expect(response.status).toBe(401);
  });
});
