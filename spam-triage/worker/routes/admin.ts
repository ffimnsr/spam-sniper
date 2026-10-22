import { getAdminRemovalRequestsApiPath } from "../../shared/admin-paths.ts";
import { getAccessActor } from "../lib/access.ts";
import {
  type AuditActor,
  createAuditStatement,
  getRecentAudit,
} from "../lib/audit.ts";
import { createE164Cipher } from "../lib/encryption.ts";
import { json, jsonError } from "../lib/http.ts";
import {
  isoDaysAgo,
  RECENT_REPORT_WINDOW_DAYS,
  VERIFIED_UNIQUE_REPORTERS,
} from "../lib/policy.ts";
import { readJsonObject } from "../lib/request.ts";
import { computeNumberStatus } from "../lib/scoring.ts";
import { getSystemState } from "../lib/system-state.ts";
import {
  AdminExportQuerySchema,
  AdminListQuerySchema,
  AdminResolveBodySchema,
} from "../lib/validation.ts";
import type { Env } from "../types.ts";

type ResolveAction = "approve_removal" | "reject_removal" | "mark_disputed";

const ALLOWED_TRANSITIONS: Record<ResolveAction, readonly string[]> = {
  approve_removal: ["open", "pending_review", "contested"],
  reject_removal: ["open", "pending_review", "contested"],
  mark_disputed: ["open", "pending_review"],
};

const ACTIVE_REMOVAL_STATUSES = ["open", "contested", "pending_review"];

export function matchAdminResolvePath(
  pathname: string,
  removalRequestsApiPath: string,
): number | null {
  const prefix = `${removalRequestsApiPath}/`;
  const suffix = "/resolve";

  if (!pathname.startsWith(prefix) || !pathname.endsWith(suffix)) {
    return null;
  }

  const rawId = pathname.slice(prefix.length, -suffix.length);
  if (!/^[1-9]\d*$/.test(rawId)) {
    return null;
  }

  const id = Number(rawId);
  return Number.isSafeInteger(id) ? id : null;
}

function requireAdmin(request: Request, env: Env): AuditActor | Response {
  const actor = getAccessActor(request, env);
  if (!actor) {
    return jsonError(
      "Cloudflare Access authentication required",
      401,
      "UNAUTHORIZED",
    );
  }
  return actor;
}

async function getAdminSummaryData(env: Env) {
  const counts = await env.DB.prepare(
    `SELECT
       COUNT(*) AS total,
       COALESCE(SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END), 0) AS pending,
       COALESCE(SUM(CASE WHEN status = 'suspected' THEN 1 ELSE 0 END), 0) AS suspected,
       COALESCE(SUM(CASE WHEN status = 'verified_spam' THEN 1 ELSE 0 END), 0) AS verified_spam,
       COALESCE(SUM(CASE WHEN status = 'under_removal_review' THEN 1 ELSE 0 END), 0) AS under_removal_review,
       COALESCE(SUM(CASE WHEN status = 'disputed' THEN 1 ELSE 0 END), 0) AS disputed,
       COALESCE(SUM(CASE WHEN status = 'removed' THEN 1 ELSE 0 END), 0) AS removed,
       (SELECT COUNT(*) FROM removal_requests WHERE status = 'open') AS open_removal_requests,
       (SELECT COUNT(*) FROM removal_requests WHERE status = 'pending_review') AS pending_review_removal_requests,
       (SELECT COUNT(*) FROM removal_requests WHERE status = 'contested') AS contested_removal_requests
     FROM numbers`,
  ).first<{
    total: number;
    pending: number;
    suspected: number;
    verified_spam: number;
    under_removal_review: number;
    disputed: number;
    removed: number;
    open_removal_requests: number;
    pending_review_removal_requests: number;
    contested_removal_requests: number;
  }>();

  const [recentAudit, maintenance] = await Promise.all([
    getRecentAudit(env.DB, 20),
    getSystemState(env.DB),
  ]);

  return {
    ok: true as const,
    totalNumbers: counts?.total ?? 0,
    pending: counts?.pending ?? 0,
    suspected: counts?.suspected ?? 0,
    verifiedSpam: counts?.verified_spam ?? 0,
    underRemovalReview: counts?.under_removal_review ?? 0,
    disputed: counts?.disputed ?? 0,
    removed: counts?.removed ?? 0,
    openRemovalRequests: counts?.open_removal_requests ?? 0,
    pendingReviewRemovalRequests: counts?.pending_review_removal_requests ?? 0,
    contestedRemovalRequests: counts?.contested_removal_requests ?? 0,
    recentAudit,
    maintenance,
  };
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

interface AdminListOptions {
  status?:
    | "open"
    | "pending_review"
    | "approved"
    | "rejected"
    | "contested"
    | "active"
    | "all";
  limit: number;
  offset: number;
}

async function getAdminRemovalRequestsData(
  env: Env,
  options: AdminListOptions,
): Promise<{ requests: AdminRemovalRequest[]; total: number }> {
  const status =
    options.status && !["active", "all"].includes(options.status)
      ? [options.status]
      : options.status === "all"
        ? null
        : ACTIVE_REMOVAL_STATUSES;
  const where = status
    ? `WHERE rr.status IN (${status.map(() => "?").join(", ")})`
    : "";
  const bindings = status ?? [];
  const recentCutoff = isoDaysAgo(RECENT_REPORT_WINDOW_DAYS);

  const [rows, total] = await Promise.all([
    env.DB.prepare(
      `SELECT rr.id, rr.status, rr.reason, rr.contest_deadline, rr.created_at,
              n.display_mask, n.status AS number_status, n.report_count,
              n.unique_reporter_count,
              (
                SELECT COUNT(DISTINCT reporter_hash) FROM reports
                WHERE number_id = n.id AND created_at >= ?
              ) AS recent_unique_reporter_count,
              (SELECT COUNT(*) FROM removal_contests rc WHERE rc.removal_request_id = rr.id) AS contest_count,
              (SELECT GROUP_CONCAT(DISTINCT rc.reason) FROM removal_contests rc WHERE rc.removal_request_id = rr.id) AS contest_reasons
         FROM removal_requests rr
         JOIN numbers n ON rr.number_id = n.id
         ${where}
         ORDER BY
           CASE rr.status
             WHEN 'pending_review' THEN 0
             WHEN 'contested' THEN 1
             WHEN 'open' THEN 2
             ELSE 3
           END,
           rr.created_at DESC,
           rr.id DESC
         LIMIT ? OFFSET ?`,
    )
      .bind(recentCutoff, ...bindings, options.limit, options.offset)
      .all<AdminRemovalRequest>(),
    env.DB.prepare(`SELECT COUNT(*) AS count FROM removal_requests rr ${where}`)
      .bind(...bindings)
      .first<{ count: number }>(),
  ]);

  return {
    requests: rows.results ?? [],
    total: total?.count ?? 0,
  };
}

export async function handleAdminSummary(
  request: Request,
  env: Env,
): Promise<Response> {
  if (request.method !== "GET") {
    return jsonError("Method not allowed", 405, "METHOD_NOT_ALLOWED");
  }

  const actor = requireAdmin(request, env);
  if (actor instanceof Response) return actor;

  return json(await getAdminSummaryData(env));
}

export async function handleAdminRemovalRequests(
  request: Request,
  env: Env,
): Promise<Response> {
  if (request.method !== "GET") {
    return jsonError("Method not allowed", 405, "METHOD_NOT_ALLOWED");
  }

  const actor = requireAdmin(request, env);
  if (actor instanceof Response) return actor;

  const url = new URL(request.url);
  const parsed = AdminListQuerySchema.safeParse(
    Object.fromEntries(url.searchParams.entries()),
  );
  if (!parsed.success) {
    return jsonError("Invalid query parameters", 400, "VALIDATION_ERROR");
  }

  const { requests, total } = await getAdminRemovalRequestsData(
    env,
    parsed.data,
  );

  return json({ ok: true, requests, total, ...parsed.data });
}

export async function handleAdminResolve(
  request: Request,
  env: Env,
): Promise<Response> {
  if (request.method !== "POST") {
    return jsonError("Method not allowed", 405, "METHOD_NOT_ALLOWED");
  }

  const actor = requireAdmin(request, env);
  if (actor instanceof Response) return actor;

  const url = new URL(request.url);
  const id = matchAdminResolvePath(
    url.pathname,
    getAdminRemovalRequestsApiPath(env.HIDDEN_ADMIN_PATH),
  );
  if (id === null) {
    return jsonError("Invalid removal request ID", 400, "VALIDATION_ERROR");
  }

  const bodyResult = await readJsonObject(request);
  if (!bodyResult.ok) {
    return bodyResult.response;
  }

  const parsed = AdminResolveBodySchema.safeParse(bodyResult.value);
  if (!parsed.success) {
    return jsonError("Invalid request body", 400, "VALIDATION_ERROR");
  }

  const { action } = parsed.data;
  const now = new Date().toISOString();

  const rr = await env.DB.prepare(
    `SELECT rr.id, rr.number_id, rr.status,
            (
              SELECT COUNT(DISTINCT reporter_hash) FROM reports
              WHERE number_id = rr.number_id AND created_at >= ?
            ) AS recent_unique_reporter_count
       FROM removal_requests rr
       JOIN numbers n ON n.id = rr.number_id
      WHERE rr.id = ?`,
  )
    .bind(isoDaysAgo(RECENT_REPORT_WINDOW_DAYS), id)
    .first<{
      id: number;
      number_id: number;
      status: string;
      recent_unique_reporter_count: number;
    }>();

  if (!rr) {
    return jsonError("Removal request not found", 404, "NOT_FOUND");
  }

  if (!ALLOWED_TRANSITIONS[action].includes(rr.status)) {
    return jsonError(
      `Cannot apply ${action} to a removal request in status ${rr.status}`,
      409,
      "INVALID_STATE",
    );
  }

  const statements: D1PreparedStatement[] = [];
  let nextRemovalStatus: string;
  let numberStatus: string;

  if (action === "approve_removal") {
    nextRemovalStatus = "approved";
    numberStatus = "removed";
    // Keep removal_request_id linked so the removed status is durable and the
    // public record still explains why the number is not in the blocklist.
    statements.push(
      env.DB.prepare(
        "UPDATE numbers SET status = ?, removal_request_id = ?, updated_at = ?, status_checked_at = ? WHERE id = ? AND status != 'removed' AND (removal_request_id IS NULL OR removal_request_id = ?) AND EXISTS (SELECT 1 FROM removal_requests WHERE id = ? AND status = 'approved')",
      ).bind(numberStatus, rr.id, now, now, rr.number_id, rr.id, id),
    );
  } else if (action === "reject_removal") {
    nextRemovalStatus = "rejected";
    numberStatus = computeNumberStatus(
      rr.recent_unique_reporter_count,
      "rejected",
    );
    statements.push(
      env.DB.prepare(
        "UPDATE numbers SET status = ?, removal_request_id = CASE WHEN removal_request_id = ? THEN NULL ELSE removal_request_id END, updated_at = ?, status_checked_at = ? WHERE id = ? AND status != 'removed' AND (removal_request_id IS NULL OR removal_request_id = ?) AND EXISTS (SELECT 1 FROM removal_requests WHERE id = ? AND status = 'rejected')",
      ).bind(numberStatus, rr.id, now, now, rr.number_id, rr.id, id),
    );
  } else {
    nextRemovalStatus = "contested";
    numberStatus = "disputed";
    statements.push(
      env.DB.prepare(
        "UPDATE numbers SET status = ?, removal_request_id = ?, updated_at = ?, status_checked_at = ? WHERE id = ? AND status != 'removed' AND (removal_request_id IS NULL OR removal_request_id = ?) AND EXISTS (SELECT 1 FROM removal_requests WHERE id = ? AND status = 'contested')",
      ).bind(numberStatus, rr.id, now, now, rr.number_id, rr.id, id),
    );
  }

  statements.push(
    env.DB.prepare(
      `INSERT INTO admin_audit_log
         (actor, action, target_type, target_id, metadata, created_at)
       SELECT ?, ?, ?, ?, ?, ?
        WHERE EXISTS (
          SELECT 1 FROM removal_requests WHERE id = ? AND status = ?
        )`,
    ).bind(
      actor.email,
      action,
      "removal_request",
      id,
      JSON.stringify({
        previousStatus: rr.status,
        nextStatus: nextRemovalStatus,
        numberStatus,
      }),
      now,
      id,
      nextRemovalStatus,
    ),
  );

  statements.unshift(
    env.DB.prepare(
      "UPDATE removal_requests SET status = ?, updated_at = ? WHERE id = ? AND status = ?",
    ).bind(nextRemovalStatus, now, id, rr.status),
  );

  const results = await env.DB.batch(statements);
  if ((results[0]?.meta?.changes ?? 0) === 0) {
    return jsonError(
      "Removal request changed while this action was being applied",
      409,
      "INVALID_STATE",
    );
  }

  if ((results[1]?.meta?.changes ?? 0) === 0) {
    const current = await env.DB.prepare(
      "SELECT status FROM numbers WHERE id = ?",
    )
      .bind(rr.number_id)
      .first<{ status: string }>();

    if (!current) {
      return jsonError("Linked number no longer exists", 500, "STATE_CONFLICT");
    }

    if (current.status !== "removed") {
      console.error("Admin resolve did not update the linked number", {
        removalRequestId: id,
        numberId: rr.number_id,
        action,
        currentStatus: current.status,
      });
    }
    numberStatus = current.status;
  }

  return json({ ok: true, action, numberStatus });
}

export async function handleAdminExport(
  request: Request,
  env: Env,
): Promise<Response> {
  if (request.method !== "GET") {
    return jsonError("Method not allowed", 405, "METHOD_NOT_ALLOWED");
  }

  const actor = requireAdmin(request, env);
  if (actor instanceof Response) return actor;

  const url = new URL(request.url);
  const parsed = AdminExportQuerySchema.safeParse(
    Object.fromEntries(url.searchParams.entries()),
  );
  if (!parsed.success) {
    return jsonError("Invalid query parameters", 400, "VALIDATION_ERROR");
  }

  const { limit, offset } = parsed.data;
  const recentCutoff = isoDaysAgo(RECENT_REPORT_WINDOW_DAYS);
  const [total, numbers] = await Promise.all([
    env.DB.prepare(
      `SELECT COUNT(*) AS count FROM numbers n
        WHERE n.status = 'verified_spam'
          AND (
            SELECT COUNT(DISTINCT reporter_hash) FROM reports
            WHERE number_id = n.id AND created_at >= ?
          ) >= ?`,
    )
      .bind(recentCutoff, VERIFIED_UNIQUE_REPORTERS)
      .first<{ count: number }>(),
    env.DB.prepare(
      `SELECT n.id, n.phone_number_enc, n.phone_number_e164, n.display_mask,
              n.country_code, n.report_count, n.unique_reporter_count,
              (
                SELECT COUNT(DISTINCT reporter_hash) FROM reports
                WHERE number_id = n.id AND created_at >= ?
              ) AS recent_unique_reporter_count,
              n.first_reported_at, n.last_reported_at,
              (SELECT r.category
                 FROM reports r
                WHERE r.number_id = n.id
                GROUP BY r.category
                ORDER BY COUNT(*) DESC, r.category ASC
                LIMIT 1) AS top_category
         FROM numbers n
         WHERE n.status = 'verified_spam'
           AND (
             SELECT COUNT(DISTINCT reporter_hash) FROM reports
             WHERE number_id = n.id AND created_at >= ?
           ) >= ?
         ORDER BY n.unique_reporter_count DESC, n.last_reported_at DESC, n.id DESC
         LIMIT ? OFFSET ?`,
    )
      .bind(
        recentCutoff,
        recentCutoff,
        VERIFIED_UNIQUE_REPORTERS,
        limit,
        offset,
      )
      .all<{
        id: number;
        phone_number_enc: string | null;
        phone_number_e164: string | null;
        display_mask: string;
        country_code: string | null;
        report_count: number;
        unique_reporter_count: number;
        recent_unique_reporter_count: number;
        first_reported_at: string;
        last_reported_at: string;
        top_category: string | null;
      }>(),
  ]);

  const cipher = createE164Cipher(env.HASH_SECRET, env.HASH_SECRET_PREVIOUS);

  const rawRows = numbers.results ?? [];
  const decryptedRows = await Promise.all(
    rawRows.map(async (row) => {
      const decrypted = await cipher.decrypt(row.phone_number_enc);
      const e164 = decrypted ?? row.phone_number_e164;
      if (!e164) {
        console.error("Verified export row could not be decrypted", {
          id: row.id,
        });
        return null;
      }

      return {
        phone_number_e164: e164,
        display_mask: row.display_mask,
        category: row.top_category ? mapCategory(row.top_category) : "unknown",
        confidence:
          row.recent_unique_reporter_count >= 5
            ? "high"
            : row.recent_unique_reporter_count >= 3
              ? "medium"
              : "low",
        report_count: row.report_count,
        unique_reporter_count: row.unique_reporter_count,
        recent_unique_reporter_count: row.recent_unique_reporter_count,
        country_code: row.country_code ?? undefined,
        first_reported_at: row.first_reported_at,
        last_reported_at: row.last_reported_at,
      };
    }),
  );
  const entries = decryptedRows.filter((entry) => entry !== null);
  const skippedEntries = decryptedRows.length - entries.length;

  const totalEntries = total?.count ?? 0;
  const nextOffset = offset + rawRows.length;
  const hasMore = nextOffset < totalEntries;

  await createAuditStatement(
    env.DB,
    actor.email,
    "export_verified_spam",
    "numbers",
    null,
    {
      limit,
      offset,
      returned: entries.length,
      skipped: skippedEntries,
      total: totalEntries,
    },
    new Date().toISOString(),
  ).run();

  return json({
    ok: true,
    version: 1,
    generated_at: new Date().toISOString(),
    source: "SpamSniper Verified Spam Export",
    notes: [
      "Auto-generated export of verified_spam entries from spam-triage.",
      "phone_number_e164 values are decrypted in memory for this export.",
      "display_mask values are included for safe admin UI display.",
    ],
    total_entries: totalEntries,
    returned_entries: entries.length,
    skipped_entries: skippedEntries,
    has_more: hasMore,
    next_offset: hasMore ? nextOffset : null,
    entries,
  });
}

// Map DB category labels to community-core style labels
function mapCategory(cat: string): string {
  const map: Record<string, string> = {
    scam: "scam",
    phishing: "phishing",
    loan_spam: "loan spam",
    robocall: "robocall",
    impersonation: "impersonation",
    delivery_scam: "delivery scam",
    bank_scam: "bank scam",
    unknown: "unknown",
  };
  return map[cat] ?? cat;
}
