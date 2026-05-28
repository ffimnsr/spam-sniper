import { apiGet, apiPost } from "./client.ts";

export interface CreateRemovalRequestBody {
  phoneNumber: string;
  country?: string;
  reason: string;
  turnstileToken: string;
}

export interface CreateRemovalRequestResponse {
  ok: true;
  removalRequestId: number;
  maskedNumber: string;
  contestDeadline: string;
}

export function createRemovalRequest(body: CreateRemovalRequestBody) {
  return apiPost<CreateRemovalRequestResponse>("/api/removal-requests", body);
}

export interface RemovalRequestDetail {
  ok: true;
  removalRequestId: number;
  maskedNumber: string;
  reason: string;
  status: string;
  contestDeadline: string;
  contestCount: number;
  contestWindowOpen: boolean;
}

export function getRemovalRequest(id: number) {
  return apiGet<RemovalRequestDetail>(`/api/removal-requests/${id}`);
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

export function contestRemovalRequest(id: number, body: ContestBody) {
  return apiPost<ContestResponse>(`/api/removal-requests/${id}/contest`, body);
}
