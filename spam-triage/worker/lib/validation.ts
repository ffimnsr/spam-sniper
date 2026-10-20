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

const phoneNumberSchema = z.string().trim().min(1).max(40);
const countrySchema = z
  .string()
  .trim()
  .length(2)
  .regex(/^[A-Za-z]{2}$/);
const turnstileTokenSchema = z.string().min(1).max(2048);

export const ReportBodySchema = z
  .object({
    phoneNumber: phoneNumberSchema,
    country: countrySchema.optional(),
    category: z.enum(reportCategories),
    turnstileToken: turnstileTokenSchema,
  })
  .strict();

export const CheckQuerySchema = z
  .object({
    number: phoneNumberSchema,
    country: countrySchema.optional(),
    turnstileToken: turnstileTokenSchema,
  })
  .strict();

export const AdminLoginBodySchema = z
  .object({
    password: z.string().min(1).max(256),
    turnstileToken: turnstileTokenSchema,
  })
  .strict();

export const RemovalRequestBodySchema = z
  .object({
    phoneNumber: phoneNumberSchema,
    country: countrySchema.optional(),
    reason: z.enum(removalReasons),
    turnstileToken: turnstileTokenSchema,
  })
  .strict();

export const ContestBodySchema = z
  .object({
    reason: z.enum(contestReasons),
    turnstileToken: turnstileTokenSchema,
  })
  .strict();

export const AdminResolveBodySchema = z
  .object({
    action: z.enum(["approve_removal", "reject_removal", "mark_disputed"]),
  })
  .strict();
