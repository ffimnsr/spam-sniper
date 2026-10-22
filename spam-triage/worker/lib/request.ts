import { jsonError } from "./http.ts";

const MAX_JSON_BODY_BYTES = 10 * 1024;

function tooLarge(): { ok: false; response: Response } {
  return {
    ok: false,
    response: jsonError("Request body too large", 413, "PAYLOAD_TOO_LARGE"),
  };
}

export async function readJsonObject(
  request: Request,
): Promise<{ ok: true; value: unknown } | { ok: false; response: Response }> {
  const contentType = request.headers.get("content-type") ?? "";
  if (!/^application\/json\b/i.test(contentType)) {
    return {
      ok: false,
      response: jsonError(
        "Expected application/json body",
        415,
        "UNSUPPORTED_MEDIA_TYPE",
      ),
    };
  }

  const contentLength = request.headers.get("content-length");
  if (contentLength) {
    const parsedLength = Number(contentLength);
    if (Number.isFinite(parsedLength) && parsedLength > MAX_JSON_BODY_BYTES) {
      return tooLarge();
    }
  }

  // Stream the body so a missing or lying Content-Length cannot force us to
  // buffer an unbounded payload before the size check.
  const reader = request.body?.getReader();
  if (!reader) return { ok: true, value: {} };

  const chunks: Uint8Array[] = [];
  let received = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      received += value.byteLength;
      if (received > MAX_JSON_BODY_BYTES) {
        await reader.cancel().catch(() => undefined);
        return tooLarge();
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  const rawBody = new TextDecoder().decode(concatChunks(chunks, received));
  if (!rawBody) return { ok: true, value: {} };

  let body: unknown;
  try {
    body = JSON.parse(rawBody);
  } catch {
    return {
      ok: false,
      response: jsonError("Invalid JSON body", 400, "INVALID_JSON"),
    };
  }

  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return {
      ok: false,
      response: jsonError("Invalid request body", 400, "VALIDATION_ERROR"),
    };
  }

  return { ok: true, value: body };
}

function concatChunks(chunks: Uint8Array[], total: number): Uint8Array {
  const merged = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return merged;
}
