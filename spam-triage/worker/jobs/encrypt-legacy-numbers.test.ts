import { describe, expect, it } from "vitest";
import { decryptE164 } from "../lib/encryption.ts";
import type { Env } from "../types.ts";
import { encryptLegacyPhoneNumbers } from "./encrypt-legacy-numbers.ts";

type Row = { id: number; phone_number_e164: string };

interface MockState {
  rows: Row[];
  encrypted: string | null;
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

  async all<T>() {
    return { results: this.state.rows.map((row) => ({ ...row })) as T[] };
  }

  async run() {
    if (this.sql.startsWith("UPDATE numbers SET phone_number_enc")) {
      this.state.encrypted = String(this.params[0]);
      const id = Number(this.params[2]);
      this.state.rows = this.state.rows.filter((row) => row.id !== id);
    }
    return { meta: {} };
  }
}

class MockDb {
  readonly state: MockState;

  constructor(state: MockState) {
    this.state = state;
  }

  prepare(sql: string) {
    return new MockStatement(sql, this.state);
  }
}

function makeEnv(state: MockState): Env {
  return {
    DB: new MockDb(state) as unknown as D1Database,
    ASSETS: { fetch: async () => new Response() } as unknown as Fetcher,
    HASH_SECRET: "secret",
    TURNSTILE_SECRET_KEY: "turnstile",
    ADMIN_PASSWORD: "admin",
    HIDDEN_ADMIN_PATH: "/hidden",
  };
}

describe("encryptLegacyPhoneNumbers", () => {
  it("encrypts plaintext rows and clears them from the plaintext set", async () => {
    const state: MockState = {
      rows: [{ id: 1, phone_number_e164: "+15551234567" }],
      encrypted: null,
    };

    const migrated = await encryptLegacyPhoneNumbers(makeEnv(state));

    expect(migrated).toBe(1);
    expect(state.rows).toHaveLength(0);
    expect(await decryptE164("secret", state.encrypted)).toBe("+15551234567");
  });

  it("does nothing when no plaintext rows remain", async () => {
    const state: MockState = { rows: [], encrypted: null };

    expect(await encryptLegacyPhoneNumbers(makeEnv(state))).toBe(0);
    expect(state.encrypted).toBeNull();
  });
});
