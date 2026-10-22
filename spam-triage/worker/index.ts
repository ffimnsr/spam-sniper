import {
  getAdminExportApiPath,
  getAdminRemovalRequestsApiPath,
  getAdminSummaryApiPath,
} from "../shared/admin-paths.ts";
import { cleanupRetainedData } from "./jobs/cleanup.ts";
import { encryptLegacyPhoneNumbers } from "./jobs/encrypt-legacy-numbers.ts";
import { finalizeRemovalRequests } from "./jobs/finalize-removals.ts";
import { reconcileNumbers } from "./jobs/reconcile-numbers.ts";
import { findMissingEnv } from "./lib/env.ts";
import { json, jsonError } from "./lib/http.ts";
import { getSystemState } from "./lib/system-state.ts";
import {
  handleAdminExport,
  handleAdminRemovalRequests,
  handleAdminResolve,
  handleAdminSummary,
  matchAdminResolvePath,
} from "./routes/admin.ts";
import { handleCheckNumber } from "./routes/numbers.ts";
import {
  handleContestRemovalRequest,
  handleCreateRemovalRequest,
  handleGetRemovalRequest,
  REMOVAL_REQUEST_CONTEST_PATH_RE,
  REMOVAL_REQUEST_PATH_RE,
} from "./routes/removal-requests.ts";
import { handleReport } from "./routes/reports.ts";
import type { Env } from "./types.ts";

const CRON_FINALIZE_RECONCILE = "0 0 * * *";
const CRON_MIGRATE = "10 0 * * *";
const CRON_CLEANUP = "20 0 * * *";

async function runReconcileAndFinalize(env: Env): Promise<void> {
  // Reconcile before finalizing so expiry decisions use fresh recent counts.
  try {
    const result = await reconcileNumbers(env);
    if (result.checked > 0) {
      console.log("Reconciled number stats", result);
    }
  } catch (e) {
    console.error("Number reconciliation failed", e);
  }

  try {
    const result = await finalizeRemovalRequests(env);
    if (result.processed > 0) {
      console.log("Finalized removal requests", result);
    }
  } catch (e) {
    console.error("Scheduled finalizer failed", e);
  }
}

async function runLegacyMigration(env: Env): Promise<void> {
  try {
    const migrated = await encryptLegacyPhoneNumbers(env);
    if (migrated > 0) {
      console.log("Encrypted/rehashed legacy numbers", { migrated });
    }
  } catch (e) {
    console.error("Legacy number migration failed", e);
  }
}

async function runCleanup(env: Env): Promise<void> {
  try {
    const result = await cleanupRetainedData(env);
    if (
      result.reportsDeleted > 0 ||
      result.contestsDeleted > 0 ||
      result.removalRequestsDeleted > 0 ||
      result.auditRowsDeleted > 0
    ) {
      console.log("Retention cleanup completed", result);
    }
  } catch (e) {
    console.error("Retention cleanup failed", e);
  }
}

async function route(request: Request, env: Env, url: URL): Promise<Response> {
  const missing = findMissingEnv(env);
  if (missing.length > 0) {
    console.error("Missing worker configuration", { missing });
    return jsonError("Worker configuration is incomplete", 500, "CONFIG_ERROR");
  }

  // Derived here so a malformed HIDDEN_ADMIN_PATH surfaces as a logged JSON
  // error instead of escaping the handler.
  const adminRoute = env.HIDDEN_ADMIN_PATH;
  const adminSummaryApiPath = getAdminSummaryApiPath(adminRoute);
  const adminRemovalRequestsApiPath =
    getAdminRemovalRequestsApiPath(adminRoute);
  const adminExportApiPath = getAdminExportApiPath(adminRoute);

  if (url.pathname === "/api/health" && request.method === "GET") {
    try {
      await env.DB.prepare("SELECT 1 AS ok").first();
    } catch (error) {
      console.error("Health check database failure", {
        error: error instanceof Error ? error.message : String(error),
      });
      return jsonError("Database unavailable", 503, "DB_UNAVAILABLE");
    }

    const maintenance = await getSystemState(env.DB).catch(() => ({}));
    return json({
      ok: true,
      name: "Spam Sniper",
      env: env.ENVIRONMENT ?? "unknown",
      db: "ok",
      maintenance,
    });
  }

  if (url.pathname === "/api/reports") {
    return await handleReport(request, env);
  }

  if (url.pathname === "/api/numbers/check") {
    return await handleCheckNumber(request, env);
  }

  if (url.pathname === "/api/removal-requests") {
    return await handleCreateRemovalRequest(request, env);
  }

  if (REMOVAL_REQUEST_PATH_RE.test(url.pathname)) {
    return await handleGetRemovalRequest(request, env);
  }

  if (REMOVAL_REQUEST_CONTEST_PATH_RE.test(url.pathname)) {
    return await handleContestRemovalRequest(request, env);
  }

  if (url.pathname === adminSummaryApiPath) {
    return await handleAdminSummary(request, env);
  }

  if (url.pathname === adminRemovalRequestsApiPath) {
    return await handleAdminRemovalRequests(request, env);
  }

  if (url.pathname === adminExportApiPath) {
    return await handleAdminExport(request, env);
  }

  if (
    matchAdminResolvePath(url.pathname, adminRemovalRequestsApiPath) !== null
  ) {
    return await handleAdminResolve(request, env);
  }

  return jsonError("Not found", 404, "NOT_FOUND");
}

export default {
  async fetch(
    request: Request,
    env: Env,
    _ctx: ExecutionContext,
  ): Promise<Response> {
    const url = new URL(request.url);

    if (!url.pathname.startsWith("/api/")) {
      return env.ASSETS.fetch(request);
    }

    const requestId = crypto.randomUUID();
    const tag = (response: Response): Response => {
      response.headers.set("x-request-id", requestId);
      return response;
    };

    try {
      return tag(await route(request, env, url));
    } catch (error) {
      console.error("Unhandled API error", {
        requestId,
        method: request.method,
        path: url.pathname,
        error: error instanceof Error ? error.message : String(error),
      });
      return tag(jsonError("Internal server error", 500, "INTERNAL_ERROR"));
    }
  },

  async scheduled(
    event: ScheduledEvent,
    env: Env,
    _ctx: ExecutionContext,
  ): Promise<void> {
    const missing = findMissingEnv(env);
    if (missing.length > 0) {
      console.error("Missing worker configuration", {
        missing,
        cron: event.cron,
      });
      return;
    }

    // Jobs are split across three triggers so each invocation stays inside the
    // free-tier D1 query budget. Unknown schedules run the safest pair only.
    switch (event.cron) {
      case CRON_MIGRATE:
        await runLegacyMigration(env);
        break;
      case CRON_CLEANUP:
        await runCleanup(env);
        break;
      case CRON_FINALIZE_RECONCILE:
      default:
        await runReconcileAndFinalize(env);
    }
  },
};
