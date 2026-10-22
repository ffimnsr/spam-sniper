const DEFAULT_TIMEOUT_MS = 10_000;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

async function handleResponse<T>(res: Response): Promise<T> {
  const parsed = await res.json().catch(() => null);
  const data = isRecord(parsed) ? parsed : {};

  if (!res.ok || data.ok !== true) {
    const msg =
      (isRecord(data.error) && "message" in data.error
        ? String(data.error.message)
        : res.statusText) || "Request failed";
    const code =
      (isRecord(data.error) && "code" in data.error
        ? String(data.error.code)
        : res.ok
          ? "INVALID_RESPONSE"
          : `HTTP_${res.status}`) || "UNKNOWN";
    throw new Error(`${code}: ${msg}`);
  }
  return data as T;
}

async function fetchWithTimeout(
  input: RequestInfo | URL,
  init: RequestInit = {},
  timeoutMs = DEFAULT_TIMEOUT_MS,
): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(input, {
      ...init,
      credentials: "same-origin",
      signal: controller.signal,
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new Error("TIMEOUT: Request timed out");
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

export async function apiGet<T>(path: string): Promise<T> {
  const res = await fetchWithTimeout(path, { method: "GET" });
  return handleResponse<T>(res);
}

export async function apiPost<T>(path: string, body: unknown): Promise<T> {
  const res = await fetchWithTimeout(path, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  return handleResponse<T>(res);
}
