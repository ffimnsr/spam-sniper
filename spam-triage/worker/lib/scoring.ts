export type NumberStatus =
  | "pending"
  | "suspected"
  | "verified_spam"
  | "under_removal_review"
  | "removed"
  | "disputed";

export type RemovalRequestStatus =
  | "open"
  | "approved"
  | "rejected"
  | "contested";

export function computeNumberStatus(
  uniqueReporterCount: number,
  removalRequestStatus?: RemovalRequestStatus | null,
): NumberStatus {
  if (removalRequestStatus === "approved") return "removed";
  if (removalRequestStatus === "contested") return "disputed";
  if (removalRequestStatus === "open") return "under_removal_review";

  if (uniqueReporterCount >= 3) return "verified_spam";
  if (uniqueReporterCount === 2) return "suspected";
  return "pending";
}
