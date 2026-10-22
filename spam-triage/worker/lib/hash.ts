const HASH_PREFIX = "v2";
const KEY_ID_LABEL = "spam-sniper:hash-key-id:v1";
const KEY_ID_LENGTH = 12;

export async function hmacSha256(
  secret: string,
  value: string,
): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    encoder.encode(value),
  );
  const array = new Uint8Array(signature);
  return Array.from(array)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function hashKeyId(secret: string): Promise<string> {
  return (await hmacSha256(secret, KEY_ID_LABEL)).slice(0, KEY_ID_LENGTH);
}

export async function currentHashPrefix(secret: string): Promise<string> {
  return `${HASH_PREFIX}:${await hashKeyId(secret)}:`;
}

// New hashes carry a format version and a non-secret key fingerprint. The
// fingerprint lets rotation find rows produced by an older key without
// exposing the secret. Legacy rows were stored as bare hex, so lookups during
// rotation must accept both shapes.
export async function hashNumber(
  secret: string,
  e164: string,
): Promise<string> {
  return `${await currentHashPrefix(secret)}${await hmacSha256(secret, e164)}`;
}

export async function hashReporter(
  secret: string,
  ip?: string,
): Promise<string> {
  return `${await currentHashPrefix(secret)}${await hmacSha256(
    secret,
    buildActorKey(ip),
  )}`;
}

export async function hashNumberCandidates(
  currentSecret: string,
  previousSecret: string | undefined,
  e164: string,
): Promise<string[]> {
  return hashCandidates(currentSecret, previousSecret, e164);
}

export async function hashReporterCandidates(
  currentSecret: string,
  previousSecret: string | undefined,
  ip?: string,
  userAgent?: string,
): Promise<string[]> {
  const candidates = new Set<string>();
  const currentKey = buildActorKey(ip);
  await addSecretCandidates(
    candidates,
    currentSecret,
    previousSecret,
    currentKey,
  );

  // Older rows included the client-controlled user-agent in the reporter key.
  // Accept those hashes for duplicate detection while new writes use IP only.
  const legacyKey = buildLegacyActorKey(ip, userAgent);
  if (legacyKey !== currentKey) {
    await addSecretCandidates(
      candidates,
      currentSecret,
      previousSecret,
      legacyKey,
    );
  }

  return [...candidates];
}

async function hashCandidates(
  currentSecret: string,
  previousSecret: string | undefined,
  value: string,
): Promise<string[]> {
  const candidates = new Set<string>();
  await addSecretCandidates(candidates, currentSecret, previousSecret, value);
  return [...candidates];
}

async function addSecretCandidates(
  candidates: Set<string>,
  currentSecret: string,
  previousSecret: string | undefined,
  value: string,
): Promise<void> {
  await addCandidates(candidates, currentSecret, value);
  if (previousSecret && previousSecret !== currentSecret) {
    await addCandidates(candidates, previousSecret, value);
  }
}

async function addCandidates(
  candidates: Set<string>,
  secret: string,
  value: string,
): Promise<void> {
  const digest = await hmacSha256(secret, value);
  candidates.add(`${await currentHashPrefix(secret)}${digest}`);
  // Intermediate format written by earlier versions of this code.
  candidates.add(`${HASH_PREFIX}:${digest}`);
  candidates.add(digest);
  candidates.add(`v1:${digest}`);
}

function buildActorKey(ip?: string): string {
  // User-Agent is attacker-controlled; keep it out of the dedupe key.
  return ip ?? "anonymous";
}

function buildLegacyActorKey(ip?: string, userAgent?: string): string {
  if (ip) {
    const normalizedUserAgent = (userAgent ?? "").trim().slice(0, 256);
    return normalizedUserAgent ? `${ip}:${normalizedUserAgent}` : ip;
  }

  return `anonymous:${userAgent?.trim().slice(0, 256) ?? "unknown"}`;
}
