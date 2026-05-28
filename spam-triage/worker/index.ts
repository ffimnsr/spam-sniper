import { finalizeRemovalRequests } from "./jobs/finalize-removals.ts";
import { json, jsonError } from "./lib/http.ts";
import {
  handleAdminRemovalRequests,
  handleAdminResolve,
  handleAdminSummary,
} from "./routes/admin.ts";
import {
  getAdminRemovalRequestsApiPath,
  getAdminSummaryApiPath,
} from "../shared/admin-paths.ts";
import { handleCheckNumber } from "./routes/numbers.ts";
import {
  handleContestRemovalRequest,
  handleCreateRemovalRequest,
  handleGetRemovalRequest,
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
    const adminRoute = env.HIDDEN_ADMIN_PATH;
    const adminSummaryApiPath = getAdminSummaryApiPath(adminRoute);
    const adminRemovalRequestsApiPath =
      getAdminRemovalRequestsApiPath(adminRoute);

    if (url.pathname.startsWith("/api/")) {
      try {
        if (url.pathname === "/api/health" && request.method === "GET") {
          return json({
            ok: true,
            name: "Spam Sniper",
            env: "production",
          });
        }

        if (url.pathname === "/api/reports") {
          return handleReport(request, env);
        }

        if (url.pathname === "/api/numbers/check") {
          return handleCheckNumber(request, env);
        }

        if (url.pathname === "/api/removal-requests") {
          return handleCreateRemovalRequest(request, env);
        }

        if (url.pathname.match(/^\/api\/removal-requests\/\d+$/)) {
          return handleGetRemovalRequest(request, env);
        }

        if (url.pathname.match(/^\/api\/removal-requests\/\d+\/contest$/)) {
          return handleContestRemovalRequest(request, env);
        }

        if (url.pathname === adminSummaryApiPath) {
          return handleAdminSummary(request, env);
        }

        if (url.pathname === adminRemovalRequestsApiPath) {
          return handleAdminRemovalRequests(request, env);
        }

        if (
          url.pathname.match(
            new RegExp(`^${adminRemovalRequestsApiPath}/\\d+/resolve$`),
          )
        ) {
          return handleAdminResolve(request, env);
        }

        return jsonError("Not found", 404, "NOT_FOUND");
      } catch {
        return jsonError("Internal server error", 500, "INTERNAL_ERROR");
      }
    }

    return env.ASSETS.fetch(request);
  },

  async scheduled(
    _event: ScheduledEvent,
    env: Env,
    _ctx: ExecutionContext,
  ): Promise<void> {
    try {
      await finalizeRemovalRequests(env);
    } catch (e) {
      console.error("Scheduled job failed", e);
    }
  },
};
