import { apiPost } from "./client.ts";

export interface CheckNumberResponse {
  ok: true;
  found: boolean;
  maskedNumber?: string;
  status?: string;
  reportCount?: number;
  uniqueReporterCount?: number;
  removalStatus?: string;
  contestDeadline?: string;
  contestWindowOpen?: boolean;
}

export interface CheckNumberBody {
  phoneNumber: string;
  country?: string;
  turnstileToken: string;
}

export function checkNumber(body: CheckNumberBody) {
  return apiPost<CheckNumberResponse>("/api/numbers/check", {
    number: body.phoneNumber,
    country: body.country,
    turnstileToken: body.turnstileToken,
  });
}

export interface SubmitReportBody {
  phoneNumber: string;
  country?: string;
  category: string;
  turnstileToken: string;
}

export interface SubmitReportResponse {
  ok: true;
  duplicate: boolean;
  maskedNumber: string;
  status: string;
  reportCount: number;
  uniqueReporterCount?: number;
}

export function submitReport(body: SubmitReportBody) {
  return apiPost<SubmitReportResponse>("/api/reports", body);
}
