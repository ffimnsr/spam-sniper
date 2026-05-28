import { describe, expect, it } from "vitest";
import {
  AdminResolveBodySchema,
  CheckQuerySchema,
  ContestBodySchema,
  RemovalRequestBodySchema,
  ReportBodySchema,
} from "./validation.ts";

describe("ReportBodySchema", () => {
  it("accepts valid report body", () => {
    const result = ReportBodySchema.safeParse({
      phoneNumber: "+639171234567",
      country: "PH",
      category: "scam",
      turnstileToken: "token",
    });
    expect(result.success).toBe(true);
  });

  it("accepts report without country", () => {
    const result = ReportBodySchema.safeParse({
      phoneNumber: "+639171234567",
      category: "unknown",
      turnstileToken: "token",
    });
    expect(result.success).toBe(true);
  });

  it("rejects invalid category", () => {
    const result = ReportBodySchema.safeParse({
      phoneNumber: "+639171234567",
      country: "PH",
      category: "invalid_category",
      turnstileToken: "token",
    });
    expect(result.success).toBe(false);
  });

  it("rejects missing turnstileToken", () => {
    const result = ReportBodySchema.safeParse({
      phoneNumber: "+639171234567",
      category: "scam",
    });
    expect(result.success).toBe(false);
  });

  it("rejects empty turnstileToken", () => {
    const result = ReportBodySchema.safeParse({
      phoneNumber: "+639171234567",
      category: "scam",
      turnstileToken: "",
    });
    expect(result.success).toBe(false);
  });

  it("rejects unknown fields due to strict mode", () => {
    const result = ReportBodySchema.safeParse({
      phoneNumber: "+639171234567",
      category: "scam",
      turnstileToken: "token",
      extraField: "should not be here",
    });
    expect(result.success).toBe(false);
  });
});

describe("CheckQuerySchema", () => {
  it("accepts valid check query", () => {
    const result = CheckQuerySchema.safeParse({
      number: "+639171234567",
      country: "PH",
      turnstileToken: "token",
    });
    expect(result.success).toBe(true);
  });

  it("accepts check query without country", () => {
    const result = CheckQuerySchema.safeParse({
      number: "+639171234567",
      turnstileToken: "token",
    });
    expect(result.success).toBe(true);
  });

  it("rejects missing number", () => {
    const result = CheckQuerySchema.safeParse({ country: "PH" });
    expect(result.success).toBe(false);
  });

  it("rejects empty number", () => {
    const result = CheckQuerySchema.safeParse({
      number: "",
      turnstileToken: "token",
    });
    expect(result.success).toBe(false);
  });

  it("rejects missing turnstileToken", () => {
    const result = CheckQuerySchema.safeParse({ number: "+639171234567" });
    expect(result.success).toBe(false);
  });
});

describe("RemovalRequestBodySchema", () => {
  it("accepts valid removal request body", () => {
    const result = RemovalRequestBodySchema.safeParse({
      phoneNumber: "+639171234567",
      country: "PH",
      reason: "personal_number",
      turnstileToken: "token",
    });
    expect(result.success).toBe(true);
  });

  it("rejects invalid removal reason", () => {
    const result = RemovalRequestBodySchema.safeParse({
      phoneNumber: "+639171234567",
      country: "PH",
      reason: "invalid_reason",
      turnstileToken: "token",
    });
    expect(result.success).toBe(false);
  });

  it("rejects missing turnstileToken", () => {
    const result = RemovalRequestBodySchema.safeParse({
      phoneNumber: "+639171234567",
      reason: "recycled_number",
    });
    expect(result.success).toBe(false);
  });
});

describe("ContestBodySchema", () => {
  it("accepts valid contest body", () => {
    const result = ContestBodySchema.safeParse({
      reason: "still_spam",
      turnstileToken: "token",
    });
    expect(result.success).toBe(true);
  });

  it("rejects invalid contest reason", () => {
    const result = ContestBodySchema.safeParse({
      reason: "not_a_real_reason",
      turnstileToken: "token",
    });
    expect(result.success).toBe(false);
  });

  it("rejects missing turnstileToken", () => {
    const result = ContestBodySchema.safeParse({ reason: "other" });
    expect(result.success).toBe(false);
  });
});

describe("AdminResolveBodySchema", () => {
  it("accepts all valid actions", () => {
    for (const action of [
      "approve_removal",
      "reject_removal",
      "mark_disputed",
    ]) {
      const result = AdminResolveBodySchema.safeParse({ action });
      expect(result.success).toBe(true);
    }
  });

  it("rejects invalid action", () => {
    const result = AdminResolveBodySchema.safeParse({
      action: "delete_everything",
    });
    expect(result.success).toBe(false);
  });
});
