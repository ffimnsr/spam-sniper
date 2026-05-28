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

export async function hashNumber(
  secret: string,
  e164: string,
): Promise<string> {
  return hmacSha256(secret, e164);
}

export async function hashReporter(
  secret: string,
  ip?: string,
  userAgent?: string,
): Promise<string> {
  return hmacSha256(secret, buildActorKey(ip, userAgent));
}

function buildActorKey(ip?: string, userAgent?: string): string {
  if (ip) {
    const normalizedUserAgent = (userAgent ?? "").trim().slice(0, 256);
    return normalizedUserAgent ? `${ip}:${normalizedUserAgent}` : ip;
  }

  // Fallback keeps local dev usable when CF-Connecting-IP is missing.
  return `anonymous:${userAgent?.trim().slice(0, 256) ?? "unknown"}`;
}

export async function hashRequester(
  secret: string,
  ip?: string,
  userAgent?: string,
): Promise<string> {
  return hashReporter(secret, ip, userAgent);
}

export async function hashContestant(
  secret: string,
  ip?: string,
  userAgent?: string,
): Promise<string> {
  return hashReporter(secret, ip, userAgent);
}
