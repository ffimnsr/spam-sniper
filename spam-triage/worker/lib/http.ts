// Response helpers keep API payloads uncacheable. Turnstile-protected writes
// and admin reads must never land in a shared or browser cache.
export function json(data: unknown, status = 200): Response {
  return Response.json(data, {
    status,
    headers: { "cache-control": "no-store" },
  });
}

export function jsonError(
  message: string,
  status = 400,
  code = "BAD_REQUEST",
): Response {
  return json({ ok: false, error: { code, message } }, status);
}
