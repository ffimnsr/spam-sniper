export async function verifyTurnstile(
  secretKey: string,
  token: string,
  remoteIp?: string,
): Promise<boolean> {
  if (!token) return false;

  const body = new URLSearchParams();
  body.append("secret", secretKey);
  body.append("response", token);
  if (remoteIp) body.append("remoteip", remoteIp);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5_000);

  let res: Response;
  try {
    res = await fetch(
      "https://challenges.cloudflare.com/turnstile/v0/siteverify",
      {
        method: "POST",
        body,
        signal: controller.signal,
      },
    );
  } catch {
    return false;
  } finally {
    clearTimeout(timeout);
  }

  if (!res.ok) return false;

  const data = (await res.json()) as { success: boolean };
  return data.success === true;
}
