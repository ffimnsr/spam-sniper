import { describe, expect, it } from "vitest";
import {
  constantTimeEqual,
  createAdminToken,
  verifyAdminToken,
} from "./admin-auth.ts";

const SECRET = "test-secret";

describe("admin auth tokens", () => {
  it("issues a token that verifies before expiry", async () => {
    const now = Date.now();
    const { token, expiresAt } = await createAdminToken(SECRET, now);

    expect(new Date(expiresAt).getTime()).toBeGreaterThan(now);
    expect(await verifyAdminToken(SECRET, token, now)).toBe(true);
  });

  it("rejects an expired token", async () => {
    const now = Date.now();
    const { token } = await createAdminToken(SECRET, now, 1);

    expect(await verifyAdminToken(SECRET, token, now + 2_000)).toBe(false);
  });

  it("rejects a token signed with another secret", async () => {
    const { token } = await createAdminToken(SECRET);

    expect(await verifyAdminToken("other-secret", token)).toBe(false);
  });

  it("rejects tampered expires-at values", async () => {
    const { token } = await createAdminToken(SECRET);
    const [version, expiresAt, signature] = token.split(".");
    const tampered = `${version}.${Number(expiresAt) + 60}.${signature}`;

    expect(await verifyAdminToken(SECRET, tampered)).toBe(false);
  });

  it("rejects malformed tokens", async () => {
    for (const token of ["", "admin", "v1.123", "v1.abc.def", "v2.1.2"]) {
      expect(await verifyAdminToken(SECRET, token)).toBe(false);
    }
  });
});

describe("constantTimeEqual", () => {
  it("matches identical values", async () => {
    expect(await constantTimeEqual("admin", "admin")).toBe(true);
  });

  it("rejects different values, including prefixes", async () => {
    expect(await constantTimeEqual("admin", "admix")).toBe(false);
    expect(await constantTimeEqual("admin", "admin-longer")).toBe(false);
  });
});
