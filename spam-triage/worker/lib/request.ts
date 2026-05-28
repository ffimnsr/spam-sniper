import { jsonError } from "./http.ts";

const MAX_JSON_BODY_BYTES = 10 * 1024;

export async function readJsonObject(
  request: Request,
): Promise<{ ok: true; value: unknown } | { ok: false; response: Response }> {
  const contentLength = request.headers.get("content-length");
  if (contentLength) {
    const parsedLength = Number(contentLength);
    if (Number.isFinite(parsedLength) && parsedLength > MAX_JSON_BODY_BYTES) {
      return {
        ok: false,
        response: jsonError("Request body too large", 413, "PAYLOAD_TOO_LARGE"),
      };
    }
  }

  const rawBody = await request.text().catch(() => "");
  if (new TextEncoder().encode(rawBody).byteLength > MAX_JSON_BODY_BYTES) {
    return {
      ok: false,
      response: jsonError("Request body too large", 413, "PAYLOAD_TOO_LARGE"),
    };
  }

  if (!rawBody) {
    return { ok: true, value: {} };
  }

  const body = JSON.parse(rawBody) as unknown;
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return {
      ok: false,
      response: jsonError("Invalid request body", 400, "VALIDATION_ERROR"),
    };
  }

  return { ok: true, value: body };
}
