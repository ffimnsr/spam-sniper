import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Env } from "../types.ts";
import { handleReport } from "./reports.ts";

type NumberRow = {
  id: number;
  number_hash: string;
  display_mask: string;
  country_code: string | null;
  status: string;
  report_count: number;
  unique_reporter_count: number;
  removal_request_id: number | null;
  first_reported_at: string;
  last_reported_at: string;
  updated_at: string;
};

type ReportRow = {
  id: number;
  number_id: number;
  reporter_hash: string;
  category: string;
  created_at: string;
};

type RemovalRequestRow = {
  id: number;
  status: string;
};

class MockStatement {
  private readonly sql: string;
  readonly runResult: { meta: { last_row_id: number } };
  private params: unknown[] = [];
  private readonly state: MockState;
  private readonly db: MockDb;

  constructor(sql: string, state: MockState, db: MockDb) {
    this.sql = sql;
    this.state = state;
    this.db = db;
    this.runResult = { meta: { last_row_id: 0 } };
  }

  bind(...params: unknown[]) {
    this.params = params;
    return this;
  }

  async first<T>(): Promise<T | null> {
    if (this.sql.includes("FROM numbers WHERE number_hash = ?")) {
      return this.state.numberRow as T;
    }
    if (this.sql.includes("SELECT status FROM removal_requests")) {
      if (this.state.numberRow?.removal_request_id) {
        const rr = this.state.removalRequests.find(
          (r) => r.id === this.state.numberRow?.removal_request_id,
        );
        if (rr) return { status: rr.status } as T;
      }
      return null as T;
    }
    if (
      this.sql.includes(
        "SELECT COUNT(*) as total, COUNT(DISTINCT reporter_hash) as unique FROM reports",
      )
    ) {
      const reports = this.state.reports.filter(
        (r) => r.number_id === this.state.numberRow?.id,
      );
      const total = reports.length;
      const unique = new Set(reports.map((r) => r.reporter_hash)).size;
      return { total, unique } as T;
    }
    return null as T;
  }

  async run() {
    if (this.sql.startsWith("INSERT INTO numbers")) {
      this.state.numberRow = {
        id: 1,
        number_hash: String(this.params[0]),
        display_mask: String(this.params[1]),
        country_code: this.params[2] as string | null,
        status: String(this.params[3]),
        report_count: 0,
        unique_reporter_count: 0,
        removal_request_id: null,
        first_reported_at: String(this.params[4]),
        last_reported_at: String(this.params[5]),
        updated_at: String(this.params[6]),
      };
      this.runResult.meta.last_row_id = 1;
      return this.runResult;
    }
    if (this.sql.startsWith("INSERT INTO reports")) {
      const numberId = Number(this.params[0]);
      const reporterHash = String(this.params[1]);

      // Check for duplicate
      const exists = this.state.reports.some(
        (r) => r.number_id === numberId && r.reporter_hash === reporterHash,
      );
      if (exists) {
        throw new Error(
          "UNIQUE constraint failed: reports(number_id, reporter_hash)",
        );
      }

      const report: ReportRow = {
        id: this.state.reports.length + 1,
        number_id: numberId,
        reporter_hash: reporterHash,
        category: String(this.params[2]),
        created_at: String(this.params[3]),
      };
      this.state.reports.push(report);
      this.runResult.meta.last_row_id = report.id;
      return this.runResult;
    }
    if (this.sql.startsWith("UPDATE numbers SET")) {
      if (this.state.numberRow) {
        // find status param index
        const statusIdx = this.sql.includes("report_count = ?") ? 2 : 0;
        if (
          this.params[statusIdx] &&
          typeof this.params[statusIdx] === "string"
        ) {
          this.state.numberRow.status = String(this.params[statusIdx]);
        }
      }
      return this.runResult;
    }
    return this.runResult;
  }
}

interface MockState {
  reports: ReportRow[];
  numberRow: NumberRow | null;
  removalRequests: RemovalRequestRow[];
}

class MockDb {
  readonly state: MockState;

  constructor(state: MockState) {
    this.state = state;
  }

  prepare(sql: string) {
    return new MockStatement(sql, this.state, this);
  }
}

function makeMockState(): MockState {
  return {
    reports: [],
    numberRow: null,
    removalRequests: [],
  };
}

function makeEnv(state: MockState): Env {
  return {
    DB: new MockDb(state) as unknown as D1Database,
    ASSETS: { fetch: vi.fn() } as unknown as Fetcher,
    HASH_SECRET: "test-secret",
    TURNSTILE_SECRET_KEY: "test-turnstile",
    ADMIN_PASSWORD: "admin",
  };
}

describe("handleReport", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(JSON.stringify({ success: true }), {
            status: 200,
            headers: { "content-type": "application/json" },
          }),
      ),
    );
  });

  it("creates first report and returns pending status", async () => {
    const state = makeMockState();
    const env = makeEnv(state);

    const request = new Request("https://example.com/api/reports", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        phoneNumber: "+639171234567",
        country: "PH",
        category: "scam",
        turnstileToken: "token",
      }),
    });

    const response = await handleReport(request, env);
    const body = (await response.json()) as Record<string, unknown>;

    expect(response.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.duplicate).toBe(false);
    expect(body.maskedNumber).toBe("+63917 *** 4567");
    expect(body.status).toBe("pending");
  });

  it("rejects invalid phone numbers", async () => {
    const state = makeMockState();
    const env = makeEnv(state);

    const request = new Request("https://example.com/api/reports", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        phoneNumber: "123",
        country: "PH",
        category: "scam",
        turnstileToken: "token",
      }),
    });

    const response = await handleReport(request, env);
    expect(response.status).toBe(400);
    const body = (await response.json()) as Record<string, unknown>;
    expect(body.ok).toBe(false);
  });

  it("rejects Turnstile verification failure", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(JSON.stringify({ success: false }), {
            status: 200,
            headers: { "content-type": "application/json" },
          }),
      ),
    );

    const state = makeMockState();
    const env = makeEnv(state);

    const request = new Request("https://example.com/api/reports", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        phoneNumber: "+639171234567",
        country: "PH",
        category: "scam",
        turnstileToken: "invalid",
      }),
    });

    const response = await handleReport(request, env);
    expect(response.status).toBe(400);
    const body = (await response.json()) as Record<string, unknown>;
    expect(body.error as Record<string, unknown>).toHaveProperty(
      "code",
      "TURNSTILE_FAILED",
    );
  });

  it("uses method-agnostic turnstile mock for remaining tests", async () => {
    // Re-stub to pass Turnstile by default for the rest of this file
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(JSON.stringify({ success: true }), {
            status: 200,
            headers: { "content-type": "application/json" },
          }),
      ),
    );

    const state = makeMockState();
    const env = makeEnv(state);

    const request = new Request("https://example.com/api/reports", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "cf-connecting-ip": "203.0.113.1",
      },
      body: JSON.stringify({
        phoneNumber: "+639171234567",
        country: "PH",
        category: "scam",
        turnstileToken: "token",
      }),
    });

    const response = await handleReport(request, env);
    expect(response.status).toBe(200);
  });

  it("reports as duplicate when same reporter reports same number", async () => {
    const state = makeMockState();
    const env = makeEnv(state);

    // First report
    const req1 = new Request("https://example.com/api/reports", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "cf-connecting-ip": "203.0.113.1",
      },
      body: JSON.stringify({
        phoneNumber: "+639171234567",
        country: "PH",
        category: "scam",
        turnstileToken: "token",
      }),
    });
    await handleReport(req1, env);

    // Second report — same reporter (same IP) → duplicate
    const req2 = new Request("https://example.com/api/reports", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "cf-connecting-ip": "203.0.113.1",
      },
      body: JSON.stringify({
        phoneNumber: "+639171234567",
        country: "PH",
        category: "phishing",
        turnstileToken: "token",
      }),
    });
    const res2 = await handleReport(req2, env);
    const body2 = (await res2.json()) as Record<string, unknown>;

    expect(body2.ok).toBe(true);
    expect(body2.duplicate).toBe(true);
  });

  it("advances status with multiple unique reporters", async () => {
    const state = makeMockState();
    const env = makeEnv(state);

    // First reporter → pending
    const req1 = new Request("https://example.com/api/reports", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "cf-connecting-ip": "203.0.113.1",
      },
      body: JSON.stringify({
        phoneNumber: "+639171234567",
        country: "PH",
        category: "scam",
        turnstileToken: "token",
      }),
    });
    const res1 = await handleReport(req1, env);
    const body1 = (await res1.json()) as Record<string, unknown>;
    expect(body1.status).toBe("pending");

    // Second unique reporter → suspected
    const req2 = new Request("https://example.com/api/reports", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "cf-connecting-ip": "203.0.113.2",
      },
      body: JSON.stringify({
        phoneNumber: "+639171234567",
        country: "PH",
        category: "robocall",
        turnstileToken: "token",
      }),
    });
    const res2 = await handleReport(req2, env);
    const body2 = (await res2.json()) as Record<string, unknown>;
    expect(body2.status).toBe("suspected");

    // Third unique reporter → verified_spam
    const req3 = new Request("https://example.com/api/reports", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "cf-connecting-ip": "203.0.113.3",
      },
      body: JSON.stringify({
        phoneNumber: "+639171234567",
        country: "PH",
        category: "bank_scam",
        turnstileToken: "token",
      }),
    });
    const res3 = await handleReport(req3, env);
    const body3 = (await res3.json()) as Record<string, unknown>;
    expect(body3.status).toBe("verified_spam");
  });
});
