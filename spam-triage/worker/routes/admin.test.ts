import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  buildAdminResolveApiPath,
  getAdminExportApiPath,
  getAdminLoginApiPath,
  getAdminSummaryApiPath,
} from "../../shared/admin-paths.ts";
import type { Env } from "../types.ts";
import {
  handleAdminExport,
  handleAdminLogin,
  handleAdminResolve,
  handleAdminSummary,
} from "./admin.ts";

const hiddenAdminPath = "/intake/review/queue/manual/escalations/window/f4c9";

class MockStatement {
  private readonly sql: string;
  private readonly state: {
    removalRequest: { id: number; numberId: number; status: string };
    number: { id: number; status: string; removalRequestId: number | null };
    uniqueReporters: number;
    exportRows: Array<{
      id: number;
      phone_number_e164: string | null;
      display_mask: string;
      country_code: string | null;
      report_count: number;
      unique_reporter_count: number;
      first_reported_at: string;
      last_reported_at: string;
    }>;
  };

  constructor(
    sql: string,
    state: {
      removalRequest: { id: number; numberId: number; status: string };
      number: { id: number; status: string; removalRequestId: number | null };
      uniqueReporters: number;
      exportRows: Array<{
        id: number;
        phone_number_e164: string | null;
        display_mask: string;
        country_code: string | null;
        report_count: number;
        unique_reporter_count: number;
        first_reported_at: string;
        last_reported_at: string;
      }>;
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

    if (this.sql.includes("SELECT category, COUNT(*) as cnt")) {
      return { category: "bank_scam", cnt: 3 } as T;
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
    if (this.sql.includes("WHERE n.status = 'verified_spam'")) {
      return { results: this.state.exportRows as T[] };
    }

    return { results: [] as T[] };
  }
}

class MockDb {
  private readonly state: {
    removalRequest: { id: number; numberId: number; status: string };
    number: { id: number; status: string; removalRequestId: number | null };
    uniqueReporters: number;
    exportRows: Array<{
      id: number;
      phone_number_e164: string | null;
      display_mask: string;
      country_code: string | null;
      report_count: number;
      unique_reporter_count: number;
      first_reported_at: string;
      last_reported_at: string;
    }>;
  };

  constructor(state: {
    removalRequest: { id: number; numberId: number; status: string };
    number: { id: number; status: string; removalRequestId: number | null };
    uniqueReporters: number;
    exportRows: Array<{
      id: number;
      phone_number_e164: string | null;
      display_mask: string;
      country_code: string | null;
      report_count: number;
      unique_reporter_count: number;
      first_reported_at: string;
      last_reported_at: string;
    }>;
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
    exportRows: Array<{
      id: number;
      phone_number_e164: string | null;
      display_mask: string;
      country_code: string | null;
      report_count: number;
      unique_reporter_count: number;
      first_reported_at: string;
      last_reported_at: string;
    }>;
  };

  beforeEach(() => {
    vi.restoreAllMocks();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ success: true }),
      } satisfies Partial<Response>),
    );
    state = {
      removalRequest: { id: 7, numberId: 11, status: "open" },
      number: { id: 11, status: "under_removal_review", removalRequestId: 7 },
      uniqueReporters: 3,
      exportRows: [
        {
          id: 11,
          phone_number_e164: "+15551234567",
          display_mask: "+1555 *** 4567",
          country_code: "US",
          report_count: 4,
          unique_reporter_count: 3,
          first_reported_at: "2026-05-01T00:00:00.000Z",
          last_reported_at: "2026-05-02T00:00:00.000Z",
        },
      ],
    };

    env = {
      DB: new MockDb(state) as unknown as D1Database,
      ASSETS: { fetch: vi.fn() } as unknown as Fetcher,
      HASH_SECRET: "secret",
      TURNSTILE_SECRET_KEY: "turnstile",
      ADMIN_PASSWORD: "admin",
      HIDDEN_ADMIN_PATH: hiddenAdminPath,
    };
  });

  it("approves removal", async () => {
    const request = new Request(
      `https://example.com${buildAdminResolveApiPath(hiddenAdminPath, 7)}`,
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
      `https://example.com${buildAdminResolveApiPath(hiddenAdminPath, 7)}`,
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
      `https://example.com${buildAdminResolveApiPath(hiddenAdminPath, 7)}`,
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
      `https://example.com${buildAdminResolveApiPath(hiddenAdminPath, 7)}`,
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
      `https://example.com${buildAdminResolveApiPath(hiddenAdminPath, 7)}`,
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
    exportRows: Array<{
      id: number;
      phone_number_e164: string | null;
      display_mask: string;
      country_code: string | null;
      report_count: number;
      unique_reporter_count: number;
      first_reported_at: string;
      last_reported_at: string;
    }>;
  };

  beforeEach(() => {
    vi.restoreAllMocks();
    state = {
      removalRequest: { id: 7, numberId: 11, status: "open" },
      number: { id: 11, status: "under_removal_review", removalRequestId: 7 },
      uniqueReporters: 3,
      exportRows: [
        {
          id: 11,
          phone_number_e164: "+15551234567",
          display_mask: "+1555 *** 4567",
          country_code: "US",
          report_count: 4,
          unique_reporter_count: 3,
          first_reported_at: "2026-05-01T00:00:00.000Z",
          last_reported_at: "2026-05-02T00:00:00.000Z",
        },
      ],
    };

    env = {
      DB: new MockDb(state) as unknown as D1Database,
      ASSETS: { fetch: vi.fn() } as unknown as Fetcher,
      HASH_SECRET: "secret",
      TURNSTILE_SECRET_KEY: "turnstile",
      ADMIN_PASSWORD: "admin",
      HIDDEN_ADMIN_PATH: hiddenAdminPath,
    };
  });

  it("returns summary counts", async () => {
    const request = new Request(
      `https://example.com${getAdminSummaryApiPath(hiddenAdminPath)}`,
      {
        headers: { Authorization: "Bearer admin" },
      },
    );

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
    const request = new Request(
      `https://example.com${getAdminSummaryApiPath(hiddenAdminPath)}`,
    );
    const response = await handleAdminSummary(request, env);
    expect(response.status).toBe(401);
  });

  it("exports full phone number plus masked display", async () => {
    const request = new Request(
      `https://example.com${getAdminExportApiPath(hiddenAdminPath)}`,
      {
        headers: { Authorization: "Bearer admin" },
      },
    );

    const response = await handleAdminExport(request, env);
    const body = (await response.json()) as {
      ok: boolean;
      entries: Array<Record<string, unknown>>;
    };

    expect(response.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.entries).toHaveLength(1);
    expect(body.entries[0]?.phone_number_e164).toBe("+15551234567");
    expect(body.entries[0]?.display_mask).toBe("+1555 *** 4567");
    expect(body.entries[0]?.category).toBe("bank scam");
  });

  it("allows admin login with Turnstile and returns bootstrap data", async () => {
    const request = new Request(
      `https://example.com${getAdminLoginApiPath(hiddenAdminPath)}`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          password: "admin",
          turnstileToken: "token",
        }),
      },
    );

    const response = await handleAdminLogin(request, env);
    const body = (await response.json()) as Record<string, unknown>;

    expect(response.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.summary).toMatchObject({
      totalNumbers: 5,
      openRemovalRequests: 2,
    });
    expect(body.requests).toEqual([]);
  });

  it("rejects admin login when Turnstile fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ success: false }),
      } satisfies Partial<Response>),
    );

    const request = new Request(
      `https://example.com${getAdminLoginApiPath(hiddenAdminPath)}`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          password: "admin",
          turnstileToken: "bad-token",
        }),
      },
    );

    const response = await handleAdminLogin(request, env);
    expect(response.status).toBe(400);
  });
});
