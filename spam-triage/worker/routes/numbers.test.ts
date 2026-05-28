import { beforeEach, describe, expect, it, vi } from "vitest";
import { handleCheckNumber } from "./numbers.ts";

class MockStatement {
  private readonly sql: string;
  private readonly state: {
    numberRow: Record<string, unknown> | null;
  };

  constructor(
    sql: string,
    state: {
      numberRow: Record<string, unknown> | null;
    },
  ) {
    this.sql = sql;
    this.state = state;
  }

  bind(..._params: unknown[]) {
    return this;
  }

  async first<T>() {
    if (this.sql.includes("FROM numbers WHERE number_hash = ?")) {
      return this.state.numberRow as T;
    }
    if (this.sql.includes("FROM removal_requests WHERE id = ?")) {
      if (this.state.numberRow?.removal_request_id) {
        return {
          status: "open",
          contest_deadline: new Date(
            Date.now() + 7 * 24 * 60 * 60 * 1000,
          ).toISOString(),
        } as T;
      }
    }
    return null as T;
  }

  async run() {
    return { meta: {} };
  }
}

class MockDb {
  private readonly state: {
    numberRow: Record<string, unknown> | null;
  };

  constructor(state: {
    numberRow: Record<string, unknown> | null;
  }) {
    this.state = state;
  }

  prepare(sql: string) {
    return new MockStatement(sql, this.state);
  }
}

describe("handleCheckNumber", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ success: true }),
      } satisfies Partial<Response>),
    );
  });

  it("returns found: false for unreported number", async () => {
    const env = {
      DB: new MockDb({ numberRow: null }) as unknown as D1Database,
      ASSETS: { fetch: vi.fn() } as unknown as Fetcher,
      HASH_SECRET: "test-secret",
      TURNSTILE_SECRET_KEY: "test-turnstile",
      ADMIN_PASSWORD: "admin",
      HIDDEN_ADMIN_PATH: "/hidden-review-path",
    };

    const request = new Request("https://example.com/api/numbers/check", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        number: "+639171234567",
        country: "PH",
        turnstileToken: "token",
      }),
    });

    const response = await handleCheckNumber(request, env);
    const body = (await response.json()) as Record<string, unknown>;

    expect(response.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.found).toBe(false);
  });

  it("returns masked number and status for reported number", async () => {
    const env = {
      DB: new MockDb({
        numberRow: {
          id: 1,
          display_mask: "+63917 *** 4567",
          status: "verified_spam",
          report_count: 3,
          unique_reporter_count: 3,
          removal_request_id: null,
        },
      }) as unknown as D1Database,
      ASSETS: { fetch: vi.fn() } as unknown as Fetcher,
      HASH_SECRET: "test-secret",
      TURNSTILE_SECRET_KEY: "test-turnstile",
      ADMIN_PASSWORD: "admin",
      HIDDEN_ADMIN_PATH: "/hidden-review-path",
    };

    const request = new Request("https://example.com/api/numbers/check", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        number: "+639171234567",
        country: "PH",
        turnstileToken: "token",
      }),
    });

    const response = await handleCheckNumber(request, env);
    const body = (await response.json()) as Record<string, unknown>;

    expect(response.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.found).toBe(true);
    expect(body.maskedNumber).toBe("+63917 *** 4567");
    expect(body.status).toBe("verified_spam");
    expect(body.reportCount).toBe(3);
    expect(body.uniqueReporterCount).toBe(3);
    expect(body.removalStatus).toBeUndefined();
  });

  it("includes removal info when number is under review", async () => {
    const env = {
      DB: new MockDb({
        numberRow: {
          id: 1,
          display_mask: "+63917 *** 4567",
          status: "under_removal_review",
          report_count: 1,
          unique_reporter_count: 1,
          removal_request_id: 5,
        },
      }) as unknown as D1Database,
      ASSETS: { fetch: vi.fn() } as unknown as Fetcher,
      HASH_SECRET: "test-secret",
      TURNSTILE_SECRET_KEY: "test-turnstile",
      ADMIN_PASSWORD: "admin",
      HIDDEN_ADMIN_PATH: "/hidden-review-path",
    };

    const request = new Request("https://example.com/api/numbers/check", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        number: "+639171234567",
        country: "PH",
        turnstileToken: "token",
      }),
    });

    const response = await handleCheckNumber(request, env);
    const body = (await response.json()) as Record<string, unknown>;

    expect(body.found).toBe(true);
    expect(body.removalStatus).toBe("open");
    expect(body.contestWindowOpen).toBe(true);
  });

  it("rejects missing number parameter", async () => {
    const env = {
      DB: new MockDb({ numberRow: null }) as unknown as D1Database,
      ASSETS: { fetch: vi.fn() } as unknown as Fetcher,
      HASH_SECRET: "test-secret",
      TURNSTILE_SECRET_KEY: "test-turnstile",
      ADMIN_PASSWORD: "admin",
      HIDDEN_ADMIN_PATH: "/hidden-review-path",
    };

    const request = new Request("https://example.com/api/numbers/check", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ turnstileToken: "token" }),
    });

    const response = await handleCheckNumber(request, env);
    expect(response.status).toBe(400);
    const body = (await response.json()) as Record<string, unknown>;
    expect(body.ok).toBe(false);
  });

  it("rejects invalid phone number", async () => {
    const env = {
      DB: new MockDb({ numberRow: null }) as unknown as D1Database,
      ASSETS: { fetch: vi.fn() } as unknown as Fetcher,
      HASH_SECRET: "test-secret",
      TURNSTILE_SECRET_KEY: "test-turnstile",
      ADMIN_PASSWORD: "admin",
      HIDDEN_ADMIN_PATH: "/hidden-review-path",
    };

    const request = new Request("https://example.com/api/numbers/check", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        number: "123",
        country: "PH",
        turnstileToken: "token",
      }),
    });

    const response = await handleCheckNumber(request, env);
    expect(response.status).toBe(400);
    const body = (await response.json()) as Record<string, unknown>;
    expect(body.ok).toBe(false);
  });

  it("rejects Turnstile verification failure", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ success: false }),
      } satisfies Partial<Response>),
    );

    const env = {
      DB: new MockDb({ numberRow: null }) as unknown as D1Database,
      ASSETS: { fetch: vi.fn() } as unknown as Fetcher,
      HASH_SECRET: "test-secret",
      TURNSTILE_SECRET_KEY: "test-turnstile",
      ADMIN_PASSWORD: "admin",
      HIDDEN_ADMIN_PATH: "/hidden-review-path",
    };

    const request = new Request("https://example.com/api/numbers/check", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        number: "+639171234567",
        country: "PH",
        turnstileToken: "bad-token",
      }),
    });

    const response = await handleCheckNumber(request, env);
    const body = (await response.json()) as Record<string, unknown>;

    expect(response.status).toBe(400);
    expect(body.ok).toBe(false);
    expect(body.error).toEqual({
      code: "TURNSTILE_FAILED",
      message: "Turnstile verification failed",
    });
  });
});
