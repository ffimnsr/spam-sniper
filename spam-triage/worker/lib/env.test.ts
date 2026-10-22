import { describe, expect, it, vi } from "vitest";
import type { Env } from "../types.ts";
import { findMissingEnv } from "./env.ts";

function makeEnv(): Env {
  return {
    DB: {} as D1Database,
    ASSETS: { fetch: vi.fn() } as unknown as Fetcher,
    HASH_SECRET: "secret",
    TURNSTILE_SECRET_KEY: "turnstile",
    HIDDEN_ADMIN_PATH: "/hidden",
  };
}

describe("findMissingEnv", () => {
  it("returns no keys for a complete environment", () => {
    expect(findMissingEnv(makeEnv())).toEqual([]);
  });

  it("reports missing secret names without values", () => {
    const env = { ...makeEnv(), HASH_SECRET: "" };

    expect(findMissingEnv(env)).toEqual(["HASH_SECRET"]);
  });
});
