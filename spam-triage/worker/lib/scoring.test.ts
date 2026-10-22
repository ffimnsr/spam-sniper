import { describe, expect, it } from "vitest";
import { computeNumberStatus } from "./scoring.ts";

describe("computeNumberStatus", () => {
  it("uses recent report thresholds when no removal request is active", () => {
    expect(computeNumberStatus(1, null)).toBe("pending");
    expect(computeNumberStatus(2, null)).toBe("suspected");
    expect(computeNumberStatus(3, null)).toBe("verified_spam");
    expect(computeNumberStatus(0, null)).toBe("pending");
  });

  it("prioritizes active removal states", () => {
    expect(computeNumberStatus(5, "open")).toBe("under_removal_review");
    expect(computeNumberStatus(5, "pending_review")).toBe(
      "under_removal_review",
    );
    expect(computeNumberStatus(5, "contested")).toBe("disputed");
    expect(computeNumberStatus(5, "approved")).toBe("removed");
    expect(computeNumberStatus(5, "rejected")).toBe("verified_spam");
  });
});
