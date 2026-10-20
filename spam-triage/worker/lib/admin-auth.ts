import { hmacSha256 } from "./hash.ts";

const TOKEN_VERSION = "v1";
const TOKEN_TTL_SECONDS = 12 * 60 * 60;
// Domain separation: token signatures never reuse the bare HASH_SECRET as a
// signing key, even though both derive from the same deployed secret.
const TOKEN_KEY_LABEL = "spam-sniper:admin-token:v1";
const MAX_TOKEN_LENGTH = 256;

async function sha256(value: string): Promise<Uint8Array> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(value),
  );
  return new Uint8Array(digest);
}

// Compares fixed-size digests in constant time so string equality never leaks
// a matching prefix for passwords or signatures.
export async function constantTimeEqual(
  a: string,
  b: string,
): Promise<boolean> {
  const [digestA, digestB] = await Promise.all([sha256(a), sha256(b)]);
  let diff = 0;
  for (let i = 0; i < digestA.length; i++) {
    diff |= digestA[i] ^ digestB[i];
  }
  return diff === 0;
}

async function deriveTokenKey(secret: string): Promise<string> {
  return hmacSha256(secret, TOKEN_KEY_LABEL);
}

export interface AdminToken {
  token: string;
  expiresAt: string;
}

export async function createAdminToken(
  secret: string,
  now = Date.now(),
  ttlSeconds = TOKEN_TTL_SECONDS,
): Promise<AdminToken> {
  if (!secret) {
    throw new Error("ADMIN_TOKEN_SECRET_MISSING");
  }

  const expiresAtSeconds = Math.floor(now / 1000) + ttlSeconds;
  const payload = `${TOKEN_VERSION}.${expiresAtSeconds}`;
  const signature = await hmacSha256(await deriveTokenKey(secret), payload);

  return {
    token: `${payload}.${signature}`,
    expiresAt: new Date(expiresAtSeconds * 1000).toISOString(),
  };
}

export async function verifyAdminToken(
  secret: string,
  token: string,
  now = Date.now(),
): Promise<boolean> {
  if (!secret || !token || token.length > MAX_TOKEN_LENGTH) return false;

  const parts = token.split(".");
  if (parts.length !== 3) return false;

  const [version, expiresRaw, signature] = parts;
  if (version !== TOKEN_VERSION) return false;
  if (!/^\d{1,12}$/.test(expiresRaw)) return false;
  if (!/^[0-9a-f]{64}$/.test(signature)) return false;

  const expiresAtSeconds = Number(expiresRaw);
  if (expiresAtSeconds * 1000 <= now) return false;

  const expected = await hmacSha256(
    await deriveTokenKey(secret),
    `${version}.${expiresRaw}`,
  );

  return constantTimeEqual(signature, expected);
}
