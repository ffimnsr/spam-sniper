import type { Env } from "../types.ts";
import type { AuditActor } from "./audit.ts";
import { isLocalHostname } from "./host.ts";

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const CERT_URL_SUFFIX = "/cdn-cgi/access/certs";
const CERT_FETCH_TIMEOUT_MS = 5_000;
const KEY_CACHE_TTL_MS = 10 * 60 * 1000;
// Bounds outbound JWKS fetches: unknown `kid` values are common in forged
// tokens and must not turn into one fetch per request.
const MIN_KEY_REFRESH_INTERVAL_MS = 30 * 1000;
// Cloudflare Access minted tokens are short-lived; a small skew avoids rejecting
// a request that lands while the clock ticks over.
const CLOCK_SKEW_SECONDS = 60;

interface AccessSigningKey extends JsonWebKeyWithKid {
  kty: "RSA";
  n: string;
  e: string;
}

export interface VerifiedAccessClaims {
  email: string;
  sub?: string;
  aud: string | string[];
  iss: string;
  exp: number;
  nbf?: number;
}

export interface VerifyAccessJwtOptions {
  teamDomain: string;
  audience: string;
  keys: JsonWebKeyWithKid[];
  now?: number;
}

interface KeyCacheEntry {
  keys: AccessSigningKey[];
  expiresAt: number;
  fetchedAt: number;
}

// Access key rotation is rare and the certs endpoint is remote, so cache the
// JWKS per isolate. A token with an unknown `kid` forces one refresh.
const keyCache = new Map<string, KeyCacheEntry>();

export function normalizeTeamDomain(value: string): string {
  return value
    .trim()
    .replace(/^https?:\/\//i, "")
    .replace(/\/+$/, "")
    .toLowerCase();
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isSigningKey(value: unknown): value is AccessSigningKey {
  return (
    isRecord(value) &&
    value.kty === "RSA" &&
    typeof value.kid === "string" &&
    typeof value.n === "string" &&
    typeof value.e === "string"
  );
}

function decodeBase64Url(segment: string): Uint8Array | null {
  // Reject anything outside the JWT alphabet so `atob` cannot accept stray
  // whitespace or padding that would make two encodings compare equal.
  if (!/^[A-Za-z0-9_-]+$/.test(segment)) return null;

  try {
    const base64 = segment.replace(/-/g, "+").replace(/_/g, "/");
    const padding = (4 - (base64.length % 4)) % 4;
    const binary = atob(base64.padEnd(base64.length + padding, "="));
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  } catch {
    return null;
  }
}

function decodeJsonObject(segment: string): Record<string, unknown> | null {
  const bytes = decodeBase64Url(segment);
  if (!bytes) return null;

  try {
    const value: unknown = JSON.parse(new TextDecoder().decode(bytes));
    return isRecord(value) ? value : null;
  } catch {
    return null;
  }
}

function audienceMatches(value: unknown, audience: string): boolean {
  if (audience.length === 0) return false;
  if (value === audience) return true;
  return Array.isArray(value) && value.includes(audience);
}

function readKeyId(token: string): string | null {
  const header = token.split(".")[0];
  if (!header) return null;

  const parsed = decodeJsonObject(header);
  return typeof parsed?.kid === "string" ? parsed.kid : null;
}

async function fetchSigningKeys(
  teamDomain: string,
): Promise<AccessSigningKey[]> {
  const response = await fetch(`https://${teamDomain}${CERT_URL_SUFFIX}`, {
    signal: AbortSignal.timeout(CERT_FETCH_TIMEOUT_MS),
  });
  if (!response.ok) {
    throw new Error(`Access certs request failed with ${response.status}`);
  }

  const body: unknown = await response.json();
  if (!isRecord(body) || !Array.isArray(body.keys)) {
    throw new Error("Access certs response is malformed");
  }

  const keys = body.keys.filter(isSigningKey);
  if (keys.length === 0) {
    throw new Error("Access certs response has no RSA signing keys");
  }

  return keys;
}

async function getSigningKeys(
  teamDomain: string,
  keyId: string,
): Promise<AccessSigningKey[] | null> {
  const now = Date.now();
  const cached = keyCache.get(teamDomain);
  if (
    cached &&
    cached.expiresAt > now &&
    cached.keys.some((key) => key.kid === keyId)
  ) {
    return cached.keys;
  }

  // One refresh per interval is enough for rotation, and it keeps a stream of
  // forged tokens from driving a certs request each time.
  if (cached && now - cached.fetchedAt < MIN_KEY_REFRESH_INTERVAL_MS) {
    return cached.expiresAt > now ? cached.keys : null;
  }

  try {
    const keys = await fetchSigningKeys(teamDomain);
    keyCache.set(teamDomain, {
      keys,
      expiresAt: now + KEY_CACHE_TTL_MS,
      fetchedAt: now,
    });
    return keys;
  } catch (error) {
    console.error("Access signing key fetch failed", {
      teamDomain,
      error: error instanceof Error ? error.message : String(error),
    });
    // Serve what is still valid and push the next attempt out by the refresh
    // interval; never retry on every request while the endpoint is failing.
    if (cached) {
      cached.fetchedAt = now;
      return cached.expiresAt > now ? cached.keys : null;
    }
    keyCache.set(teamDomain, { keys: [], expiresAt: 0, fetchedAt: now });
    return null;
  }
}

export async function verifyAccessJwt(
  token: string,
  options: VerifyAccessJwtOptions,
): Promise<VerifiedAccessClaims | null> {
  const parts = token.split(".");
  if (parts.length !== 3) return null;

  const header = decodeJsonObject(parts[0]);
  const payload = decodeJsonObject(parts[1]);
  const signature = decodeBase64Url(parts[2]);
  if (!header || !payload || !signature) return null;

  // Pin the algorithm. Accepting the header value verbatim enables `alg: none`
  // and HMAC-confusion attacks.
  if (header.alg !== "RS256" || typeof header.kid !== "string") return null;

  const teamDomain = normalizeTeamDomain(options.teamDomain);
  if (teamDomain.length === 0) return null;
  if (payload.iss !== `https://${teamDomain}`) return null;
  if (!audienceMatches(payload.aud, options.audience.trim())) return null;

  const now = options.now ?? Date.now();
  if (typeof payload.exp !== "number" || !Number.isFinite(payload.exp)) {
    return null;
  }
  if (payload.exp * 1000 <= now - CLOCK_SKEW_SECONDS * 1000) return null;
  if (payload.nbf !== undefined) {
    if (typeof payload.nbf !== "number" || !Number.isFinite(payload.nbf)) {
      return null;
    }
    if (payload.nbf * 1000 > now + CLOCK_SKEW_SECONDS * 1000) return null;
  }

  const email =
    typeof payload.email === "string" ? payload.email.trim().toLowerCase() : "";
  if (!EMAIL_RE.test(email)) return null;

  const key = options.keys.find(
    (candidate) => candidate.kid === header.kid && candidate.kty === "RSA",
  );
  if (!key) return null;

  let cryptoKey: CryptoKey;
  try {
    cryptoKey = await crypto.subtle.importKey(
      "jwk",
      key,
      { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
      false,
      ["verify"],
    );
  } catch {
    return null;
  }

  const signedData = new TextEncoder().encode(`${parts[0]}.${parts[1]}`);
  let valid = false;
  try {
    valid = await crypto.subtle.verify(
      { name: "RSASSA-PKCS1-v1_5" },
      cryptoKey,
      signature,
      signedData,
    );
  } catch {
    return null;
  }
  if (!valid) return null;

  return {
    email,
    sub: typeof payload.sub === "string" ? payload.sub : undefined,
    aud: payload.aud as string | string[],
    iss: payload.iss,
    exp: payload.exp,
    nbf: typeof payload.nbf === "number" ? payload.nbf : undefined,
  };
}

// Cloudflare Access terminates authentication before the Worker runs. Verifying
// the JWT here means a request that reaches the Worker without passing Access
// (deleted app, mis-scoped path, stray hostname) fails closed instead of being
// trusted because two headers are present.
export async function getAccessActor(
  request: Request,
  env: Env,
): Promise<AuditActor | null> {
  // The dev bypass is intentionally limited to local hostnames so a
  // misconfigured ENVIRONMENT value cannot disable Access in production.
  if (
    env.ENVIRONMENT === "development" &&
    isLocalHostname(new URL(request.url).hostname)
  ) {
    return { email: "dev@local" };
  }

  const headerEmail = request.headers
    .get("Cf-Access-Authenticated-User-Email")
    ?.trim();
  const jwt = request.headers.get("Cf-Access-Jwt-Assertion")?.trim();
  if (!headerEmail || !jwt) return null;

  const teamDomain = env.ACCESS_TEAM_DOMAIN
    ? normalizeTeamDomain(env.ACCESS_TEAM_DOMAIN)
    : "";
  const audience = env.ACCESS_AUD?.trim() ?? "";
  if (teamDomain.length === 0 || audience.length === 0) {
    // Fail closed and stay explicit: missing Access configuration must never
    // degrade into trusting unverified identity headers.
    console.error("Cloudflare Access configuration missing", {
      missing: [
        teamDomain.length === 0 ? "ACCESS_TEAM_DOMAIN" : null,
        audience.length === 0 ? "ACCESS_AUD" : null,
      ].filter((name) => name !== null),
    });
    return null;
  }

  const keyId = readKeyId(jwt);
  if (!keyId) return null;

  const keys = await getSigningKeys(teamDomain, keyId);
  if (!keys) return null;

  const claims = await verifyAccessJwt(jwt, { teamDomain, audience, keys });
  if (!claims) return null;

  // The Access-injected header is only a presence check; the authoritative
  // identity comes from the verified `email` claim.
  return { email: claims.email };
}

// Explicit test hooks: a suite can preload a generated JWKS instead of mocking
// global fetch, and reset between files.
export function primeAccessKeysForTests(
  teamDomain: string,
  keys: JsonWebKeyWithKid[],
  ttlMs = KEY_CACHE_TTL_MS,
): void {
  keyCache.set(normalizeTeamDomain(teamDomain), {
    keys: keys.filter(isSigningKey),
    expiresAt: Date.now() + ttlMs,
    fetchedAt: Date.now(),
  });
}

export function clearAccessKeyCacheForTests(): void {
  keyCache.clear();
}
