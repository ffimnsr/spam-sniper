import type { Env } from "../types.ts";
import { isLocalHostname } from "./host.ts";

export interface TurnstileOptions {
  expectedAction?: string;
  expectedHostname?: string;
}

interface TurnstileResponse {
  success?: unknown;
  action?: unknown;
  hostname?: unknown;
}

// Production tokens must come from the same origin and form that minted them.
// Local development skips both checks because Cloudflare test keys may omit
// action/hostname fields. The bypass is host-bound so a deployed environment
// with ENVIRONMENT=development cannot weaken production checks.
export function turnstileOptions(
  env: Env,
  request: Request,
  action: string,
): TurnstileOptions {
  if (
    env.ENVIRONMENT === "development" &&
    isLocalHostname(new URL(request.url).hostname)
  ) {
    return {};
  }

  return {
    expectedAction: action,
    expectedHostname: new URL(request.url).hostname.toLowerCase(),
  };
}

export async function verifyTurnstile(
  secretKey: string,
  token: string,
  remoteIp?: string,
  options: TurnstileOptions = {},
): Promise<boolean> {
  if (!token) return false;

  const body = new URLSearchParams();
  body.append("secret", secretKey);
  body.append("response", token);
  if (remoteIp) body.append("remoteip", remoteIp);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5_000);

  let res: Response;
  try {
    res = await fetch(
      "https://challenges.cloudflare.com/turnstile/v0/siteverify",
      {
        method: "POST",
        body,
        signal: controller.signal,
      },
    );
  } catch {
    return false;
  } finally {
    clearTimeout(timeout);
  }

  if (!res.ok) return false;

  let data: TurnstileResponse;
  try {
    data = (await res.json()) as TurnstileResponse;
  } catch {
    return false;
  }
  if (data.success !== true) return false;

  // A token minted for another form must not unlock this endpoint.
  if (options.expectedAction && data.action !== options.expectedAction) {
    return false;
  }

  // A token solved on another hostname must not be replayed here.
  if (options.expectedHostname) {
    if (
      typeof data.hostname !== "string" ||
      data.hostname.toLowerCase() !== options.expectedHostname
    ) {
      return false;
    }
  }

  return true;
}
