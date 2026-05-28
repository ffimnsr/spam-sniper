export function json(data: unknown, status = 200): Response {
  return Response.json(data, {
    status,
    headers: { "content-type": "application/json" },
  });
}

export function jsonError(
  message: string,
  status = 400,
  code = "BAD_REQUEST",
): Response {
  return Response.json(
    { ok: false, error: { code, message } },
    { status, headers: { "content-type": "application/json" } },
  );
}
