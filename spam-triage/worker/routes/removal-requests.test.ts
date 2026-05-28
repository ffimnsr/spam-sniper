import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Env } from "../types.ts";
import { handleCreateRemovalRequest } from "./removal-requests.ts";

class MockStatement {
  private readonly sql: string;
  private readonly state: {
    numberRow: {
      id: number;
      status: string;
      report_count: number;
      removal_request_id: number | null;
    } | null;
  };

  constructor(
    sql: string,
    state: {
      numberRow: {
        id: number;
        status: string;
        report_count: number;
        removal_request_id: number | null;
      } | null;
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

    return null as T;
  }
}

class MockDb {
  private readonly state: {
    numberRow: {
      id: number;
      status: string;
      report_count: number;
      removal_request_id: number | null;
    } | null;
  };

  constructor(
    state: {
      numberRow: {
        id: number;
        status: string;
        report_count: number;
        removal_request_id: number | null;
      } | null;
    },
  ) {
    this.state = state;
  }

  prepare(sql: string) {
    return new MockStatement(sql, this.state);
  }
}

describe("handleCreateRemovalRequest", () => {
  let env: Env;

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

    env = {
      DB: new MockDb({ numberRow: null }) as unknown as D1Database,
      ASSETS: { fetch: vi.fn() } as unknown as Fetcher,
      HASH_SECRET: "secret",
      TURNSTILE_SECRET_KEY: "turnstile",
      ADMIN_PASSWORD: "admin",
    };
  });

  it("rejects removal requests for numbers never reported", async () => {
    const request = new Request("https://example.com/api/removal-requests", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        phoneNumber: "+639171234567",
        country: "PH",
        reason: "personal_number",
        turnstileToken: "token",
      }),
    });

    const response = await handleCreateRemovalRequest(request, env);
    const body = (await response.json()) as {
      ok: boolean;
      error?: { code?: string };
    };

    expect(response.status).toBe(404);
    expect(body.ok).toBe(false);
    expect(body.error?.code).toBe("NUMBER_NOT_REPORTED");
  });
});
