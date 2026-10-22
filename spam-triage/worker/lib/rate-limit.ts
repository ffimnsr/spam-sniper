import type { Env } from "../types.ts";
import { jsonError } from "./http.ts";

type LimitKind = "read" | "write";

// Applies the optional Workers rate-limit binding. Without the binding (local
// dev, tests, or unconfigured deployments) requests pass through unchanged.
export async function enforceRateLimit(
  env: Env,
  request: Request,
  scope: string,
  kind: LimitKind = "write",
): Promise<Response | null> {
  const limiter =
    kind === "write"
      ? (env.RATE_LIMITER_WRITE ?? env.RATE_LIMITER)
      : (env.RATE_LIMITER_READ ?? env.RATE_LIMITER);
  if (!limiter) return null;

  const ip = request.headers.get("CF-Connecting-IP") ?? "unknown";
  const key = `${kind}:${scope}:${ip}`;

  try {
    const { success } = await limiter.limit({ key });
    if (!success) {
      return jsonError("Too many requests", 429, "RATE_LIMITED");
    }
  } catch (error) {
    // Fail open: a limiter outage must not take down writes.
    console.error("Rate limiter failed", {
      scope,
      kind,
      error: error instanceof Error ? error.message : String(error),
    });
  }

  return null;
}
