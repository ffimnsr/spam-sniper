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

async function apiGetWithAuth<T>(path: string, password: string): Promise<T> {
  const res = await fetch(path, {
    headers: { Authorization: `Bearer ${password}` },
  });
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok || data.ok === false) {
    const msg =
      (data.error && typeof data.error === "object" && "message" in data.error
        ? String(data.error.message)
        : res.statusText) || "Request failed";
    const code =
      (data.error && typeof data.error === "object" && "code" in data.error
        ? String(data.error.code)
        : "UNKNOWN") || "UNKNOWN";
    throw new Error(`${code}: ${msg}`);
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
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok || data.ok === false) {
    const msg =
      (data.error && typeof data.error === "object" && "message" in data.error
        ? String(data.error.message)
        : res.statusText) || "Request failed";
    const code =
      (data.error && typeof data.error === "object" && "code" in data.error
        ? String(data.error.code)
        : "UNKNOWN") || "UNKNOWN";
    throw new Error(`${code}: ${msg}`);
  }
  return data as T;
}

export function getAdminSummary(password: string) {
  return apiGetWithAuth<AdminSummary>("/api/admin/summary", password);
}

export function getAdminRemovalRequests(password: string) {
  return apiGetWithAuth<AdminRemovalRequestsResponse>(
    "/api/admin/removal-requests",
    password,
  );
}

export function resolveAdminRemovalRequest(
  id: number,
  body: AdminResolveBody,
  password: string,
) {
  return apiPostWithAuth<AdminResolveResponse>(
    `/api/admin/removal-requests/${id}/resolve`,
    body,
    password,
  );
}
