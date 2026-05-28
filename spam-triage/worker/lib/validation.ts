import { z } from "zod";

export const reportCategories = [
  "scam",
  "phishing",
  "loan_spam",
  "robocall",
  "impersonation",
  "delivery_scam",
  "bank_scam",
  "unknown",
] as const;

export const removalReasons = [
  "personal_number",
  "incorrect_report",
  "recycled_number",
  "legitimate_business",
  "other",
] as const;

export const contestReasons = [
  "still_spam",
  "recent_spam_call",
  "known_scam_number",
  "other",
] as const;

export const numberStatuses = [
  "pending",
  "suspected",
  "verified_spam",
  "under_removal_review",
  "removed",
  "disputed",
] as const;

export const ReportBodySchema = z
  .object({
    phoneNumber: z.string().min(1),
    country: z.string().optional(),
    category: z.enum(reportCategories),
    turnstileToken: z.string().min(1),
  })
  .strict();

export const CheckQuerySchema = z
  .object({
    number: z.string().min(1),
    country: z.string().optional(),
    turnstileToken: z.string().min(1),
  })
  .strict();

export const AdminLoginBodySchema = z
  .object({
    password: z.string().min(1),
    turnstileToken: z.string().min(1),
  })
  .strict();

export const RemovalRequestBodySchema = z
  .object({
    phoneNumber: z.string().min(1),
    country: z.string().optional(),
    reason: z.enum(removalReasons),
    turnstileToken: z.string().min(1),
  })
  .strict();

export const ContestBodySchema = z
  .object({
    reason: z.enum(contestReasons),
    turnstileToken: z.string().min(1),
  })
  .strict();

export const AdminResolveBodySchema = z
  .object({
    action: z.enum(["approve_removal", "reject_removal", "mark_disputed"]),
  })
  .strict();
