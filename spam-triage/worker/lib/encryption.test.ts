import { describe, expect, it } from "vitest";
import { decryptE164, encryptE164 } from "./encryption.ts";

const SECRET = "test-secret";
const PHONE = "+639171234567";

describe("E.164 encryption", () => {
  it("round-trips a number", async () => {
    const payload = await encryptE164(SECRET, PHONE);

    expect(payload).toMatch(/^v1\.[0-9a-f]{24}\.[0-9a-f]+$/);
    expect(payload).not.toContain(PHONE);
    expect(await decryptE164(SECRET, payload)).toBe(PHONE);
  });

  it("uses a fresh IV per encryption", async () => {
    const first = await encryptE164(SECRET, PHONE);
    const second = await encryptE164(SECRET, PHONE);

    expect(first).not.toBe(second);
  });

  it("fails to decrypt with a different secret", async () => {
    const payload = await encryptE164(SECRET, PHONE);

    expect(await decryptE164("other-secret", payload)).toBeNull();
  });

  it("rejects malformed payloads", async () => {
    for (const payload of [null, "", "v2.00.00", "v1.zz.00", "v1.00"]) {
      expect(await decryptE164(SECRET, payload)).toBeNull();
    }
  });
});
