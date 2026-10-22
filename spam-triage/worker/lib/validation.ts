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

export const removalRequestStatuses = [
  "open",
  "pending_review",
  "approved",
  "rejected",
  "contested",
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

export const AdminListQuerySchema = z
  .object({
    status: z.enum([...removalRequestStatuses, "active", "all"]).optional(),
    limit: z.coerce.number().int().min(1).max(100).default(100),
    offset: z.coerce.number().int().min(0).default(0),
  })
  .strict();

export const AdminExportQuerySchema = z
  .object({
    limit: z.coerce.number().int().min(1).max(1_000).default(500),
    offset: z.coerce.number().int().min(0).default(0),
  })
  .strict();
