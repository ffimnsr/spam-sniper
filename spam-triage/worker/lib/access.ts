import type { Env } from "../types.ts";
import type { AuditActor } from "./audit.ts";
import { isLocalHostname } from "./host.ts";

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

// Cloudflare Access terminates authentication before the Worker runs. Requiring
// both headers means a request that bypassed Access cannot reach admin routes.
// `workers_dev` is disabled in wrangler.jsonc so the custom-domain route is the
// only public path to this Worker.
export function getAccessActor(request: Request, env: Env): AuditActor | null {
  // The dev bypass is intentionally limited to local hostnames so a
  // misconfigured ENVIRONMENT value cannot disable Access in production.
  if (
    env.ENVIRONMENT === "development" &&
    isLocalHostname(new URL(request.url).hostname)
  ) {
    return { email: "dev@local" };
  }

  const email = request.headers
    .get("Cf-Access-Authenticated-User-Email")
    ?.trim()
    .toLowerCase();
  const jwt = request.headers.get("Cf-Access-Jwt-Assertion")?.trim();

  if (!email || !jwt || !EMAIL_RE.test(email)) return null;

  return { email };
}
