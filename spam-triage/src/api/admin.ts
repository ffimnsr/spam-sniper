import {
  buildAdminResolveApiPath,
  getAdminExportApiPath,
  getAdminRemovalRequestsApiPath,
  getAdminSummaryApiPath,
} from "../../shared/admin-paths.ts";
import { hiddenAdminRoute } from "../lib/admin-path.ts";
import { apiGet, apiPost } from "./client.ts";

export interface AdminAuditEntry {
  id: number;
  actor: string;
  action: string;
  target_type: string;
  target_id: number | null;
  metadata: string | null;
  created_at: string;
}

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
  pendingReviewRemovalRequests: number;
  contestedRemovalRequests: number;
  recentAudit: AdminAuditEntry[];
  maintenance: Record<string, string>;
}

export interface AdminRemovalRequest {
  id: number;
  status: string;
  reason: string;
  contest_deadline: string;
  created_at: string;
  display_mask: string;
  number_status: string;
  report_count: number;
  unique_reporter_count: number;
  recent_unique_reporter_count: number;
  contest_count: number;
  contest_reasons: string | null;
}

export interface AdminRemovalRequestsResponse {
  ok: true;
  requests: AdminRemovalRequest[];
  total: number;
  status?: string;
  limit: number;
  offset: number;
}

export interface AdminResolveBody {
  action: "approve_removal" | "reject_removal" | "mark_disputed";
}

export interface AdminResolveResponse {
  ok: true;
  action: string;
  numberStatus: string;
}

export interface AdminExportEntry {
  phone_number_e164: string;
  display_mask: string;
  category: string;
  confidence: string;
  report_count: number;
  unique_reporter_count: number;
  recent_unique_reporter_count: number;
  country_code?: string;
  first_reported_at: string;
  last_reported_at: string;
}

export interface AdminExportResponse {
  ok: true;
  version: number;
  generated_at: string;
  source: string;
  notes: string[];
  total_entries: number;
  returned_entries: number;
  skipped_entries: number;
  has_more: boolean;
  next_offset: number | null;
  entries: AdminExportEntry[];
}

export function getAdminSummary() {
  return apiGet<AdminSummary>(getAdminSummaryApiPath(hiddenAdminRoute));
}

export function getAdminRemovalRequests(status = "active") {
  const params = new URLSearchParams({ status, limit: "100" });
  return apiGet<AdminRemovalRequestsResponse>(
    `${getAdminRemovalRequestsApiPath(hiddenAdminRoute)}?${params.toString()}`,
  );
}

export function resolveAdminRemovalRequest(id: number, body: AdminResolveBody) {
  return apiPost<AdminResolveResponse>(
    buildAdminResolveApiPath(hiddenAdminRoute, id),
    body,
  );
}

export function getAdminExport(limit = 500, offset = 0) {
  const params = new URLSearchParams({
    limit: String(limit),
    offset: String(offset),
  });
  return apiGet<AdminExportResponse>(
    `${getAdminExportApiPath(hiddenAdminRoute)}?${params.toString()}`,
  );
}
