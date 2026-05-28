import { describe, expect, it } from "vitest";
import { normalizePhone } from "./phone.ts";

describe("normalizePhone", () => {
  it("accepts valid Philippine mobile numbers", () => {
    expect(normalizePhone("09171234567", "PH")).toMatchObject({
      e164: "+639171234567",
      countryCode: "PH",
      displayMask: "+63917 *** 4567",
    });
  });

  it("accepts valid international E.164 numbers", () => {
    expect(normalizePhone("+14155552671")).toMatchObject({
      e164: "+14155552671",
      countryCode: "US",
      displayMask: "+415 *** 2671",
    });
  });

  it.each([
    "12345",
    "abcde",
    "",
  ])("rejects invalid phone input: %p", (input) => {
    expect(() => normalizePhone(input, "PH")).toThrowError(
      "INVALID_PHONE_NUMBER",
    );
  });

  it("accepts number with spaces and dashes", () => {
    expect(normalizePhone("+63 917-123-4567", "PH")).toMatchObject({
      e164: "+639171234567",
      displayMask: "+63917 *** 4567",
    });
  });

  it("never exposes the full phone number in the display mask", () => {
    const result = normalizePhone("09171234567", "PH");
    // Mask should only show prefix and last 4, not the middle digits
    expect(result.displayMask).not.toContain("1234567");
    expect(result.displayMask).not.toContain("171234567");
    expect(result.displayMask).toContain("***");
    expect(result.displayMask).toContain("4567");

    const intl = normalizePhone("+14155552671");
    expect(intl.displayMask).not.toContain("4155552671");
    expect(intl.displayMask).not.toContain("5552671");
    expect(intl.displayMask).toContain("***");
    expect(intl.displayMask).toContain("2671");
  });
});
