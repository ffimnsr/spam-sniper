import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Env } from "../types.ts";
import {
  handleContestRemovalRequest,
  handleCreateRemovalRequest,
  handleGetRemovalRequest,
} from "./removal-requests.ts";

class MockStatement {
  private readonly sql: string;
  private readonly state: MockState;
  readonly runResult = { meta: { last_row_id: 0 } };
  private params: unknown[] = [];

  constructor(sql: string, state: MockState) {
    this.sql = sql;
    this.state = state;
  }

  bind(...params: unknown[]) {
    this.params = params;
    return this;
  }

  async first<T>(): Promise<T | null> {
    if (this.sql.includes("FROM numbers WHERE number_hash = ?")) {
      return this.state.numberRow as T;
    }

    if (
      this.sql.includes("WHERE rr.id = ?") ||
      this.sql.includes("FROM removal_requests WHERE id = ?")
    ) {
      const id = Number(this.params[0]);
      const rr = this.state.removalRequests.find((r) => r.id === id);
      if (!rr) return null as T;
      return {
        id: rr.id,
        number_id: rr.numberId,
        reason: rr.reason,
        status: rr.status,
        contest_deadline: rr.contestDeadline,
        created_at: rr.createdAt,
        display_mask: rr.displayMask,
      } as T;
    }

    if (
      this.sql.includes("FROM removal_contests WHERE removal_request_id = ?")
    ) {
      const rrId = Number(this.params[0]);
      const count = this.state.contests.filter(
        (c) => c.removalRequestId === rrId,
      ).length;
      return { count } as T;
    }

    if (
      this.sql.includes("FROM removal_requests") &&
      this.sql.includes("contest_deadline")
    ) {
      const rr = this.state.removalRequests.find((r) => r.status === "open");
      if (rr) {
        return {
          id: rr.id,
          status: rr.status,
          contest_deadline: rr.contestDeadline,
        } as T;
      }
      return null as T;
    }

    return null as T;
  }

  async run() {
    if (this.sql.startsWith("INSERT INTO removal_requests")) {
      const numberId = Number(this.params[0]);
      const reason = String(this.params[2]);
      const deadline = String(this.params[4]);
      const now = String(this.params[5]);
      const id = this.state.nextRRId++;
      this.state.removalRequests.push({
        id,
        numberId,
        reason,
        status: "open",
        contestDeadline: deadline,
        createdAt: now,
        displayMask: "+63917 *** 4567",
      });
      this.runResult.meta.last_row_id = id;
      return this.runResult;
    }

    if (this.sql.startsWith("INSERT INTO removal_contests")) {
      const rrId = Number(this.params[0]);
      const contestantHash = String(this.params[1]);
      const reason = String(this.params[2]);

      const exists = this.state.contests.some(
        (c) =>
          c.removalRequestId === rrId && c.contestantHash === contestantHash,
      );
      if (exists) {
        throw new Error(
          "UNIQUE constraint failed: removal_contests(removal_request_id, contestant_hash)",
        );
      }

      this.state.contests.push({
        removalRequestId: rrId,
        contestantHash,
        reason,
      });

      // Do NOT set RR status here — real code does it via separate UPDATE
      if (this.state.numberRow) {
        this.state.numberRow.status = "disputed";
      }
      return this.runResult;
    }

    if (
      this.sql.includes("UPDATE numbers SET status = ?, removal_request_id = ?")
    ) {
      if (this.state.numberRow) {
        this.state.numberRow.status = String(this.params[0]);
        this.state.numberRow.removal_request_id = Number(this.params[1]);
      }
      return this.runResult;
    }

    if (this.sql.includes("UPDATE numbers SET status = ?")) {
      if (this.state.numberRow) {
        this.state.numberRow.status = String(this.params[0]);
      }
      return this.runResult;
    }

    if (this.sql.includes("UPDATE removal_requests SET status = ?")) {
      const newStatus = String(this.params[0]);
      const id = Number(this.params[2]);
      const rr = this.state.removalRequests.find((r) => r.id === id);
      if (rr) rr.status = newStatus;
      return this.runResult;
    }

    return this.runResult;
  }

  async all<T>() {
    return { results: [] as T[] };
  }
}

interface MockState {
  numberRow: {
    id: number;
    status: string;
    report_count: number;
    removal_request_id: number | null;
  } | null;
  removalRequests: {
    id: number;
    numberId: number;
    reason: string;
    status: string;
    contestDeadline: string;
    createdAt: string;
    displayMask: string;
  }[];
  contests: {
    removalRequestId: number;
    contestantHash: string;
    reason: string;
  }[];
  nextRRId: number;
}

class MockDb {
  private readonly state: MockState;

  constructor(state: MockState) {
    this.state = state;
  }

  prepare(sql: string) {
    return new MockStatement(sql, this.state);
  }
}

function makeMockState(): MockState {
  return {
    numberRow: {
      id: 1,
      status: "verified_spam",
      report_count: 3,
      removal_request_id: null,
    },
    removalRequests: [],
    contests: [],
    nextRRId: 100,
  };
}

function makeEnv(state: MockState): Env {
  return {
    DB: new MockDb(state) as unknown as D1Database,
    ASSETS: { fetch: vi.fn() } as unknown as Fetcher,
    HASH_SECRET: "secret",
    TURNSTILE_SECRET_KEY: "turnstile",
    ADMIN_PASSWORD: "admin",
  };
}

describe("handleCreateRemovalRequest", () => {
  let env: Env;
  let state: MockState;

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
    state = makeMockState();
    env = makeEnv(state);
  });

  it("rejects removal requests for numbers never reported", async () => {
    state.numberRow = null;

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

  it("creates removal request and sets 7-day deadline", async () => {
    const before = Date.now();

    const request = new Request("https://example.com/api/removal-requests", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "cf-connecting-ip": "203.0.113.1",
      },
      body: JSON.stringify({
        phoneNumber: "+639171234567",
        country: "PH",
        reason: "personal_number",
        turnstileToken: "token",
      }),
    });

    const response = await handleCreateRemovalRequest(request, env);
    const body = (await response.json()) as Record<string, unknown>;

    expect(response.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.removalRequestId).toBe(100);
    expect(body.maskedNumber).toBe("+63917 *** 4567");

    // Verify 7-day deadline
    const deadline = new Date(body.contestDeadline as string);
    const after = Date.now() + 7 * 24 * 60 * 60 * 1000 + 1000;
    expect(deadline.getTime()).toBeGreaterThanOrEqual(
      before + 7 * 24 * 60 * 60 * 1000 - 1000,
    );
    expect(deadline.getTime()).toBeLessThanOrEqual(after);

    // Verify number status changed
    expect(state.numberRow?.status).toBe("under_removal_review");
  });

  it("prevents duplicate open removal request", async () => {
    // First request
    const req1 = new Request("https://example.com/api/removal-requests", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "cf-connecting-ip": "203.0.113.1",
      },
      body: JSON.stringify({
        phoneNumber: "+639171234567",
        country: "PH",
        reason: "personal_number",
        turnstileToken: "token",
      }),
    });
    await handleCreateRemovalRequest(req1, env);

    // Set up state to simulate existing open removal
    state.numberRow = {
      id: 1,
      status: "under_removal_review",
      report_count: 3,
      removal_request_id: 100,
    };

    // Second request — should fail
    const req2 = new Request("https://example.com/api/removal-requests", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "cf-connecting-ip": "203.0.113.2",
      },
      body: JSON.stringify({
        phoneNumber: "+639171234567",
        country: "PH",
        reason: "incorrect_report",
        turnstileToken: "token",
      }),
    });

    const res2 = await handleCreateRemovalRequest(req2, env);
    const body2 = (await res2.json()) as { error?: { code?: string } };
    expect(res2.status).toBe(409);
    expect(body2.error?.code).toBe("DUPLICATE_REMOVAL_REQUEST");
  });
});

describe("handleGetRemovalRequest", () => {
  let env: Env;
  let state: MockState;

  beforeEach(() => {
    vi.restoreAllMocks();
    state = makeMockState();
    env = makeEnv(state);

    // Seed a removal request
    state.removalRequests.push({
      id: 100,
      numberId: 1,
      reason: "personal_number",
      status: "open",
      contestDeadline: new Date(
        Date.now() + 7 * 24 * 60 * 60 * 1000,
      ).toISOString(),
      createdAt: new Date().toISOString(),
      displayMask: "+63917 *** 4567",
    });
  });

  it("returns removal request details with contest window open", async () => {
    const request = new Request("https://example.com/api/removal-requests/100");
    const response = await handleGetRemovalRequest(request, env);
    const body = (await response.json()) as Record<string, unknown>;

    expect(response.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.removalRequestId).toBe(100);
    expect(body.maskedNumber).toBe("+63917 *** 4567");
    expect(body.reason).toBe("personal_number");
    expect(body.status).toBe("open");
    expect(body.contestCount).toBe(0);
    expect(body.contestWindowOpen).toBe(true);
  });

  it("returns 404 for non-existent removal request", async () => {
    const request = new Request("https://example.com/api/removal-requests/999");
    const response = await handleGetRemovalRequest(request, env);
    expect(response.status).toBe(404);
  });
});

describe("handleContestRemovalRequest", () => {
  let env: Env;
  let state: MockState;

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
    state = makeMockState();
    env = makeEnv(state);

    // Seed an open removal request
    state.removalRequests.push({
      id: 100,
      numberId: 1,
      reason: "personal_number",
      status: "open",
      contestDeadline: new Date(
        Date.now() + 7 * 24 * 60 * 60 * 1000,
      ).toISOString(),
      createdAt: new Date().toISOString(),
      displayMask: "+63917 *** 4567",
    });
    state.numberRow = {
      id: 1,
      status: "under_removal_review",
      report_count: 3,
      removal_request_id: 100,
    };
  });

  it("contests open removal and marks number as disputed", async () => {
    const request = new Request(
      "https://example.com/api/removal-requests/100/contest",
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "cf-connecting-ip": "203.0.113.1",
        },
        body: JSON.stringify({
          reason: "still_spam",
          turnstileToken: "token",
        }),
      },
    );

    const response = await handleContestRemovalRequest(request, env);
    const body = (await response.json()) as Record<string, unknown>;

    expect(response.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.contestCount).toBe(1);
    expect(body.status).toBe("disputed");
    expect(state.numberRow?.status).toBe("disputed");
  });

  it("rejects contest when removal request is no longer open", async () => {
    const req1 = new Request(
      "https://example.com/api/removal-requests/100/contest",
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "cf-connecting-ip": "203.0.113.1",
        },
        body: JSON.stringify({
          reason: "still_spam",
          turnstileToken: "token",
        }),
      },
    );
    await handleContestRemovalRequest(req1, env);

    const req2 = new Request(
      "https://example.com/api/removal-requests/100/contest",
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "cf-connecting-ip": "203.0.113.1",
        },
        body: JSON.stringify({
          reason: "recent_spam_call",
          turnstileToken: "token",
        }),
      },
    );

    const res2 = await handleContestRemovalRequest(req2, env);
    const body2 = (await res2.json()) as { error?: { code?: string } };
    expect(res2.status).toBe(409);
    expect(body2.error?.code).toBe("NOT_CONTESTABLE");
  });

  it("rejects contest for non-existent removal request", async () => {
    const request = new Request(
      "https://example.com/api/removal-requests/999/contest",
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "cf-connecting-ip": "203.0.113.1",
        },
        body: JSON.stringify({
          reason: "still_spam",
          turnstileToken: "token",
        }),
      },
    );

    const response = await handleContestRemovalRequest(request, env);
    expect(response.status).toBe(404);
  });

  it("rejects contest for non-open removal request", async () => {
    // Make it non-open
    state.removalRequests[0].status = "approved";

    const request = new Request(
      "https://example.com/api/removal-requests/100/contest",
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "cf-connecting-ip": "203.0.113.1",
        },
        body: JSON.stringify({
          reason: "still_spam",
          turnstileToken: "token",
        }),
      },
    );

    const response = await handleContestRemovalRequest(request, env);
    expect(response.status).toBe(409);
  });
});
