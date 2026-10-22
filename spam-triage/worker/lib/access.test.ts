import { describe, expect, it } from "vitest";
import type { Env } from "../types.ts";
import { getAccessActor } from "./access.ts";

function request(url: string, headers: Record<string, string> = {}): Request {
  return new Request(url, { headers });
}

function env(overrides: Partial<Env> = {}): Env {
  return {
    ENVIRONMENT: "production",
    ...overrides,
  } as Env;
}

describe("getAccessActor", () => {
  it("accepts Cloudflare Access identity headers", () => {
    const actor = getAccessActor(
      request("https://example.com/admin", {
        "cf-access-authenticated-user-email": "Operator@Example.com",
        "cf-access-jwt-assertion": "jwt",
      }),
      env(),
    );

    expect(actor).toEqual({ email: "operator@example.com" });
  });

  it("rejects requests without both Access headers", () => {
    expect(
      getAccessActor(
        request("https://example.com/admin", {
          "cf-access-authenticated-user-email": "operator@example.com",
        }),
        env(),
      ),
    ).toBeNull();
    expect(
      getAccessActor(request("https://example.com/admin"), env()),
    ).toBeNull();
  });

  it("rejects malformed emails", () => {
    expect(
      getAccessActor(
        request("https://example.com/admin", {
          "cf-access-authenticated-user-email": "not-an-email",
          "cf-access-jwt-assertion": "jwt",
        }),
        env(),
      ),
    ).toBeNull();
  });

  it("allows the dev bypass only on local hostnames", () => {
    const headers = {
      "cf-access-authenticated-user-email": "operator@example.com",
      "cf-access-jwt-assertion": "jwt",
    };

    expect(
      getAccessActor(
        request("http://127.0.0.1:8787/admin", {}),
        env({ ENVIRONMENT: "development" }),
      ),
    ).toEqual({ email: "dev@local" });
    expect(
      getAccessActor(
        request("https://example.com/admin", {}),
        env({ ENVIRONMENT: "development" }),
      ),
    ).toBeNull();
    expect(
      getAccessActor(request("https://example.com/admin", headers), env()),
    ).toEqual({ email: "operator@example.com" });
  });
});
