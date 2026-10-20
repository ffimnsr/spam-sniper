import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Env } from "../types.ts";
import { finalizeRemovalRequests } from "./finalize-removals.ts";

type NumberRow = {
  id: number;
  status: string;
  removal_request_id: number | null;
  updated_at: string;
};

type RemovalRequestRow = {
  id: number;
  number_id: number;
  status: string;
  updated_at: string;
};

interface MockState {
  numbers: NumberRow[];
  removalRequests: RemovalRequestRow[];
  contests: { removalRequestId: number }[];
}

class MockStatement {
  private readonly sql: string;
  private readonly state: MockState;
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
    if (
      this.sql.includes("FROM removal_contests WHERE removal_request_id = ?")
    ) {
      const rrId = Number(this.params[0]);
      const count = this.state.contests.filter(
        (c) => c.removalRequestId === rrId,
      ).length;
      return { count } as T;
    }
    return null as T;
  }

  async run() {
    if (this.sql.includes("UPDATE removal_requests SET status = ?")) {
      const newStatus = String(this.params[0]);
      const id = Number(this.params[2]);
      const rr = this.state.removalRequests.find((r) => r.id === id);
      const hasContests = this.state.contests.some(
        (c) => c.removalRequestId === id,
      );
      const wantsApproved = this.sql.includes("NOT EXISTS");
      const wantsContested = this.sql.includes("EXISTS") && !wantsApproved;
      const eligible =
        rr?.status === "open" &&
        ((wantsApproved && !hasContests) || (wantsContested && hasContests));

      if (rr && eligible) {
        rr.status = newStatus;
        rr.updated_at = String(this.params[1]);
        return { meta: { changes: 1 } };
      }

      return { meta: { changes: 0 } };
    }

    if (
      this.sql.startsWith(
        "UPDATE numbers SET status = ?, removal_request_id = NULL, updated_at = ? WHERE id = ?",
      )
    ) {
      const newStatus = String(this.params[0]);
      const id = Number(this.params[2]);
      const num = this.state.numbers.find((n) => n.id === id);
      if (num) {
        num.status = newStatus;
        num.removal_request_id = null;
        num.updated_at = String(this.params[1]);
      }
      return { meta: {} };
    }

    if (
      this.sql.startsWith(
        "UPDATE numbers SET status = ?, updated_at = ? WHERE id = ?",
      )
    ) {
      const newStatus = String(this.params[0]);
      const id = Number(this.params[2]);
      const num = this.state.numbers.find((n) => n.id === id);
      if (num) {
        num.status = newStatus;
        num.updated_at = String(this.params[1]);
      }
      return { meta: {} };
    }

    return { meta: {} };
  }

  async all<T>(): Promise<{ results: T[] }> {
    if (this.sql.includes("FROM removal_requests")) {
      const due = this.state.removalRequests.filter((r) => r.status === "open");
      return {
        results: due.map((r) => ({
          id: r.id,
          number_id: r.number_id,
        })) as T[],
      };
    }
    return { results: [] as T[] };
  }
}

class MockDb {
  private readonly state: MockState;

  constructor(state: MockState) {
    this.state = state;
  }

  prepare(sql: string) {
    return new MockStatement(sql, this.state);
  }

  async batch(statements: MockStatement[]) {
    const results = [];
    for (const statement of statements) {
      results.push(await statement.run());
    }
    return results;
  }
}

function makeEnv(state: MockState): Env {
  return {
    DB: new MockDb(state) as unknown as D1Database,
    ASSETS: { fetch: vi.fn() } as unknown as Fetcher,
    HASH_SECRET: "secret",
    TURNSTILE_SECRET_KEY: "turnstile",
    ADMIN_PASSWORD: "admin",
    HIDDEN_ADMIN_PATH: "/hidden-review-path",
  };
}

describe("finalizeRemovalRequests", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("approves removal when no contests exist", async () => {
    const state: MockState = {
      numbers: [
        {
          id: 1,
          status: "under_removal_review",
          removal_request_id: 10,
          updated_at: "",
        },
      ],
      removalRequests: [
        { id: 10, number_id: 1, status: "open", updated_at: "" },
      ],
      contests: [],
    };

    await finalizeRemovalRequests(makeEnv(state));

    // Removal request should be approved
    const rr = state.removalRequests.find((r) => r.id === 10);
    expect(rr?.status).toBe("approved");

    // Number should be removed
    const num = state.numbers.find((n) => n.id === 1);
    expect(num?.status).toBe("removed");
    expect(num?.removal_request_id).toBeNull();
  });

  it("marks as contested/removed when contests exist", async () => {
    const state: MockState = {
      numbers: [
        {
          id: 1,
          status: "under_removal_review",
          removal_request_id: 10,
          updated_at: "",
        },
      ],
      removalRequests: [
        { id: 10, number_id: 1, status: "open", updated_at: "" },
      ],
      contests: [{ removalRequestId: 10 }],
    };

    await finalizeRemovalRequests(makeEnv(state));

    // Removal request should be contested
    const rr = state.removalRequests.find((r) => r.id === 10);
    expect(rr?.status).toBe("contested");

    // Number should be disputed
    const num = state.numbers.find((n) => n.id === 1);
    expect(num?.status).toBe("disputed");
  });

  it("processes only open removal requests with passed deadline", async () => {
    const state: MockState = {
      numbers: [
        {
          id: 1,
          status: "under_removal_review",
          removal_request_id: 10,
          updated_at: "",
        },
        {
          id: 2,
          status: "under_removal_review",
          removal_request_id: 11,
          updated_at: "",
        },
      ],
      removalRequests: [
        { id: 10, number_id: 1, status: "open", updated_at: "" },
        { id: 11, number_id: 2, status: "open", updated_at: "" },
      ],
      contests: [{ removalRequestId: 11 }],
    };

    await finalizeRemovalRequests(makeEnv(state));

    // RR 10 (no contests) → approved
    const rr10 = state.removalRequests.find((r) => r.id === 10);
    expect(rr10?.status).toBe("approved");

    // RR 11 (has contests) → contested
    const rr11 = state.removalRequests.find((r) => r.id === 11);
    expect(rr11?.status).toBe("contested");

    // Number 1 → removed
    const n1 = state.numbers.find((n) => n.id === 1);
    expect(n1?.status).toBe("removed");

    // Number 2 → disputed
    const n2 = state.numbers.find((n) => n.id === 2);
    expect(n2?.status).toBe("disputed");
  });

  it("leaves already-resolved requests untouched", async () => {
    const state: MockState = {
      numbers: [
        {
          id: 1,
          status: "disputed",
          removal_request_id: 10,
          updated_at: "",
        },
      ],
      // Already contested by another writer after the cron read.
      removalRequests: [
        { id: 10, number_id: 1, status: "contested", updated_at: "" },
      ],
      contests: [],
    };

    await finalizeRemovalRequests(makeEnv(state));

    expect(state.removalRequests[0]?.status).toBe("contested");
    expect(state.numbers[0]?.status).toBe("disputed");
    expect(state.numbers[0]?.removal_request_id).toBe(10);
  });
});
