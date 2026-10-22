import { describe, expect, it } from "vitest";
import type { Env } from "../types.ts";
import { turnstileOptions } from "./turnstile.ts";

function env(environment: string): Env {
  return { ENVIRONMENT: environment } as Env;
}

describe("turnstileOptions", () => {
  it("skips action/hostname checks only for local development", () => {
    const local = new Request("http://127.0.0.1:8787/api/reports");
    const remote = new Request("https://example.com/api/reports");

    expect(turnstileOptions(env("development"), local, "report")).toEqual({});
    expect(turnstileOptions(env("development"), remote, "report")).toEqual({
      expectedAction: "report",
      expectedHostname: "example.com",
    });
  });

  it("always binds production tokens to the action and hostname", () => {
    const local = new Request("http://localhost:8787/api/reports");

    expect(turnstileOptions(env("production"), local, "report")).toEqual({
      expectedAction: "report",
      expectedHostname: "localhost",
    });
  });
});
