import { describe, expect, it } from "vitest";
import {
  hashNumber,
  hashNumberCandidates,
  hashReporter,
  hashReporterCandidates,
} from "./hash.ts";

describe("hashReporter", () => {
  it("stays stable across Turnstile solves for same actor", async () => {
    const first = await hashReporter("secret", "203.0.113.10");
    const second = await hashReporter("secret", "203.0.113.10");

    expect(first).toBe(second);
    expect(first).toMatch(/^v2:[0-9a-f]{12}:[0-9a-f]{64}$/);
  });

  it("changes when actor fingerprint changes", async () => {
    const first = await hashReporter("secret", "203.0.113.10");
    const second = await hashReporter("secret", "203.0.113.11");

    expect(first).not.toBe(second);
  });
});

describe("key rotation candidates", () => {
  it("accepts current and previous number hashes", async () => {
    const current = await hashNumber("new-secret", "+15551234567");
    const previous = await hashNumber("old-secret", "+15551234567");
    const candidates = await hashNumberCandidates(
      "new-secret",
      "old-secret",
      "+15551234567",
    );

    expect(candidates).toContain(current);
    expect(candidates).toContain(previous);
    expect(candidates.some((candidate) => candidate.startsWith("v2:"))).toBe(
      true,
    );
    expect(candidates.length).toBeGreaterThan(1);
  });

  it("accepts current and previous reporter hashes", async () => {
    const current = await hashReporter("new-secret", "203.0.113.10");
    const previous = await hashReporter("old-secret", "203.0.113.10");
    const candidates = await hashReporterCandidates(
      "new-secret",
      "old-secret",
      "203.0.113.10",
      "A",
    );

    expect(candidates).toContain(current);
    expect(candidates).toContain(previous);
    expect(candidates.length).toBeGreaterThan(1);
  });
});
