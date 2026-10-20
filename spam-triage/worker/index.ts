import {
  getAdminExportApiPath,
  getAdminLoginApiPath,
  getAdminRemovalRequestsApiPath,
  getAdminSummaryApiPath,
} from "../shared/admin-paths.ts";
import { encryptLegacyPhoneNumbers } from "./jobs/encrypt-legacy-numbers.ts";
import { finalizeRemovalRequests } from "./jobs/finalize-removals.ts";
import { findMissingEnv } from "./lib/env.ts";
import { json, jsonError } from "./lib/http.ts";
import {
  handleAdminExport,
  handleAdminLogin,
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

    try {
      const missing = findMissingEnv(env);
      if (missing.length > 0) {
        console.error("Missing worker configuration", { missing });
        return jsonError(
          "Worker configuration is incomplete",
          500,
          "CONFIG_ERROR",
        );
      }

      // Derived here so a malformed HIDDEN_ADMIN_PATH surfaces as a logged
      // JSON error instead of escaping the handler.
      const adminRoute = env.HIDDEN_ADMIN_PATH;
      const adminLoginApiPath = getAdminLoginApiPath(adminRoute);
      const adminSummaryApiPath = getAdminSummaryApiPath(adminRoute);
      const adminRemovalRequestsApiPath =
        getAdminRemovalRequestsApiPath(adminRoute);
      const adminExportApiPath = getAdminExportApiPath(adminRoute);

      if (url.pathname === "/api/health" && request.method === "GET") {
        return json({
          ok: true,
          name: "Spam Sniper",
          env: env.ENVIRONMENT ?? "unknown",
        });
      }

      if (url.pathname === "/api/reports") {
        return await handleReport(request, env);
      }

      if (url.pathname === "/api/numbers/check") {
        return await handleCheckNumber(request, env);
      }

      if (url.pathname === adminLoginApiPath) {
        return await handleAdminLogin(request, env);
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
        matchAdminResolvePath(url.pathname, adminRemovalRequestsApiPath) !==
        null
      ) {
        return await handleAdminResolve(request, env);
      }

      return jsonError("Not found", 404, "NOT_FOUND");
    } catch (error) {
      console.error("Unhandled API error", {
        method: request.method,
        path: url.pathname,
        error: error instanceof Error ? error.message : String(error),
      });
      return jsonError("Internal server error", 500, "INTERNAL_ERROR");
    }
  },

  async scheduled(
    _event: ScheduledEvent,
    env: Env,
    _ctx: ExecutionContext,
  ): Promise<void> {
    try {
      await finalizeRemovalRequests(env);
    } catch (e) {
      console.error("Scheduled finalizer failed", e);
    }

    try {
      const migrated = await encryptLegacyPhoneNumbers(env);
      if (migrated > 0) {
        console.log("Encrypted legacy phone numbers", { migrated });
      }
    } catch (e) {
      console.error("Legacy phone encryption failed", e);
    }
  },
};
