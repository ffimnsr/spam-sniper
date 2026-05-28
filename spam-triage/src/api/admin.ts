import {
  buildAdminResolveApiPath,
  getAdminRemovalRequestsApiPath,
  getAdminSummaryApiPath,
} from "../../shared/admin-paths.ts";
import { hiddenAdminRoute } from "../lib/admin-path.ts";

export interface AdminSummary {
  ok: true;
  totalNumbers: number;
  pending: number;
  suspected: number;
  verifiedSpam: number;
  underRemovalReview: number;
  disputed: number;
  removed: number;
  openRemovalRequests: number;
  contestedRemovalRequests: number;
}

export interface AdminRemovalRequest {
  id: number;
  status: string;
  reason: string;
  contest_deadline: string;
  created_at: string;
  display_mask: string;
  contest_count: number;
}

export interface AdminRemovalRequestsResponse {
  ok: true;
  requests: AdminRemovalRequest[];
}

export interface AdminResolveBody {
  action: "approve_removal" | "reject_removal" | "mark_disputed";
}

export interface AdminResolveResponse {
  ok: true;
  action: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function getApiErrorDetails(data: unknown, fallbackMessage: string) {
  const invalid = {
    code: "INVALID_RESPONSE",
    message: fallbackMessage || "Request failed",
  };

  if (!isRecord(data)) {
    return invalid;
  }

  const error = data.error;
  if (!isRecord(error)) {
    return invalid;
  }

  return {
    code: "code" in error ? String(error.code) : invalid.code,
    message: "message" in error ? String(error.message) : invalid.message,
  };
}

async function apiGetWithAuth<T>(path: string, password: string): Promise<T> {
  const res = await fetch(path, {
    headers: { Authorization: `Bearer ${password}` },
  });
  const data = (await res.json().catch(() => null)) as unknown;
  if (
    !res.ok ||
    !isRecord(data) ||
    data.ok !== true
  ) {
    const { code, message } = getApiErrorDetails(data, res.statusText);
    throw new Error(`${code}: ${message}`);
  }
  return data as T;
}

async function apiPostWithAuth<T>(
  path: string,
  body: unknown,
  password: string,
): Promise<T> {
  const res = await fetch(path, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      Authorization: `Bearer ${password}`,
    },
    body: JSON.stringify(body),
  });
  const data = (await res.json().catch(() => null)) as unknown;
  if (
    !res.ok ||
    !isRecord(data) ||
    data.ok !== true
  ) {
    const { code, message } = getApiErrorDetails(data, res.statusText);
    throw new Error(`${code}: ${message}`);
  }
  return data as T;
}

export function getAdminSummary(password: string) {
  return apiGetWithAuth<AdminSummary>(
    getAdminSummaryApiPath(hiddenAdminRoute),
    password,
  );
}

export function getAdminRemovalRequests(password: string) {
  return apiGetWithAuth<AdminRemovalRequestsResponse>(
    getAdminRemovalRequestsApiPath(hiddenAdminRoute),
    password,
  );
}

export function resolveAdminRemovalRequest(
  id: number,
  body: AdminResolveBody,
  password: string,
) {
  return apiPostWithAuth<AdminResolveResponse>(
    buildAdminResolveApiPath(hiddenAdminRoute, id),
    body,
    password,
  );
}
