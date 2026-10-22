// Response helpers keep API payloads uncacheable. Turnstile-protected writes
// and admin reads must never land in a shared or browser cache.
const JSON_HEADERS = {
  "cache-control": "no-store",
  "content-type": "application/json; charset=utf-8",
  "referrer-policy": "no-referrer",
  "x-content-type-options": "nosniff",
};

export function json(data: unknown, status = 200): Response {
  return Response.json(data, {
    status,
    headers: JSON_HEADERS,
  });
}

export function jsonError(
  message: string,
  status = 400,
  code = "BAD_REQUEST",
): Response {
  return json({ ok: false, error: { code, message } }, status);
}
