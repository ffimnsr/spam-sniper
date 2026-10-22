import { apiGet, apiPost } from "./client.ts";

export interface CreateRemovalRequestBody {
  phoneNumber: string;
  country?: string;
  reason: string;
  turnstileToken: string;
}

export interface CreateRemovalRequestResponse {
  ok: true;
  publicToken: string;
  maskedNumber: string;
  contestDeadline: string;
  reviewRequired: boolean;
}

export function createRemovalRequest(body: CreateRemovalRequestBody) {
  return apiPost<CreateRemovalRequestResponse>("/api/removal-requests", body);
}

export interface RemovalRequestDetail {
  ok: true;
  maskedNumber: string;
  reason: string;
  status: string;
  contestDeadline: string;
  contestCount: number;
  contestWindowOpen: boolean;
  reviewRequired: boolean;
}

export function getRemovalRequest(publicToken: string) {
  return apiGet<RemovalRequestDetail>(
    `/api/removal-requests/${encodeURIComponent(publicToken)}`,
  );
}

export interface ContestBody {
  reason: string;
  turnstileToken: string;
}

export interface ContestResponse {
  ok: true;
  contestCount: number;
  status: string;
}

export function contestRemovalRequest(publicToken: string, body: ContestBody) {
  return apiPost<ContestResponse>(
    `/api/removal-requests/${encodeURIComponent(publicToken)}/contest`,
    body,
  );
}
