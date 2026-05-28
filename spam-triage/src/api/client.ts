export interface ApiError {
  ok: false;
  error: { code: string; message: string };
}

export interface ApiSuccess<T = unknown> {
  ok: true;
  data: T;
}

async function handleResponse<T>(res: Response): Promise<T> {
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok || data.ok === false) {
    const msg =
      (data.error && typeof data.error === "object" && "message" in data.error
        ? String(data.error.message)
        : res.statusText) || "Request failed";
    const code =
      (data.error && typeof data.error === "object" && "code" in data.error
        ? String(data.error.code)
        : "UNKNOWN") || "UNKNOWN";
    throw new Error(`${code}: ${msg}`);
  }
  return data as T;
}

export async function apiGet<T>(path: string): Promise<T> {
  const res = await fetch(path);
  return handleResponse<T>(res);
}

export async function apiPost<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(path, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  return handleResponse<T>(res);
}
