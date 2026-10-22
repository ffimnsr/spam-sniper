import {
  SUSPECTED_UNIQUE_REPORTERS,
  VERIFIED_UNIQUE_REPORTERS,
} from "./policy.ts";

export type NumberStatus =
  | "pending"
  | "suspected"
  | "verified_spam"
  | "under_removal_review"
  | "removed"
  | "disputed";

export type RemovalRequestStatus =
  | "open"
  | "pending_review"
  | "approved"
  | "rejected"
  | "contested";

export function isRemovalRequestStatus(
  value: string | null | undefined,
): value is RemovalRequestStatus {
  return (
    value === "open" ||
    value === "pending_review" ||
    value === "approved" ||
    value === "rejected" ||
    value === "contested"
  );
}

export function computeNumberStatus(
  recentUniqueReporterCount: number,
  removalRequestStatus?: RemovalRequestStatus | null,
): NumberStatus {
  if (removalRequestStatus === "approved") return "removed";
  if (removalRequestStatus === "contested") return "disputed";
  if (
    removalRequestStatus === "open" ||
    removalRequestStatus === "pending_review"
  ) {
    return "under_removal_review";
  }

  if (recentUniqueReporterCount >= VERIFIED_UNIQUE_REPORTERS) {
    return "verified_spam";
  }
  if (recentUniqueReporterCount >= SUSPECTED_UNIQUE_REPORTERS) {
    return "suspected";
  }
  return "pending";
}
