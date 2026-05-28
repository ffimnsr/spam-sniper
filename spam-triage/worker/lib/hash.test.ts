import { describe, expect, it } from "vitest";
import { hashReporter } from "./hash.ts";

describe("hashReporter", () => {
  it("stays stable across Turnstile solves for same actor", async () => {
    const first = await hashReporter("secret", "203.0.113.10", "Agent/1.0");
    const second = await hashReporter("secret", "203.0.113.10", "Agent/1.0");

    expect(first).toBe(second);
  });

  it("changes when actor fingerprint changes", async () => {
    const first = await hashReporter("secret", "203.0.113.10", "Agent/1.0");
    const second = await hashReporter("secret", "203.0.113.11", "Agent/1.0");

    expect(first).not.toBe(second);
  });
});
