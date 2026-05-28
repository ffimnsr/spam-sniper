import { apiGet, apiPost } from "./client.ts";

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

export function checkNumber(number_: string, country?: string) {
  const params = new URLSearchParams();
  params.set("number", number_);
  if (country) params.set("country", country);
  return apiGet<CheckNumberResponse>(`/api/numbers/check?${params.toString()}`);
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
