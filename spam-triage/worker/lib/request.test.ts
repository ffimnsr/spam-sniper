import { describe, expect, it } from "vitest";
import { readJsonObject } from "./request.ts";

describe("readJsonObject", () => {
  it("rejects arrays", async () => {
    const request = new Request("https://example.com/api/reports", {
      method: "POST",
      body: JSON.stringify(["bad"]),
      headers: { "content-type": "application/json" },
    });

    const result = await readJsonObject(request);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.response.status).toBe(400);
    }
  });

  it("rejects payloads over 10kb", async () => {
    const request = new Request("https://example.com/api/reports", {
      method: "POST",
      body: JSON.stringify({ payload: "x".repeat(10_500) }),
      headers: { "content-type": "application/json" },
    });

    const result = await readJsonObject(request);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.response.status).toBe(413);
    }
  });

  it("returns a validation error for malformed JSON", async () => {
    const request = new Request("https://example.com/api/reports", {
      method: "POST",
      body: '{"broken":',
      headers: { "content-type": "application/json" },
    });

    const result = await readJsonObject(request);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.response.status).toBe(400);
      const body = (await result.response.json()) as {
        error?: { code?: string };
      };
      expect(body.error?.code).toBe("INVALID_JSON");
    }
  });
});
