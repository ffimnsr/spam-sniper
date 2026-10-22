import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  createAccessToken,
  TEST_ACCESS_AUD,
  TEST_ACCESS_EMAIL,
  TEST_ACCESS_TEAM_DOMAIN,
  testAccessKeys,
} from "../test/access-token.ts";
import type { Env } from "../types.ts";
import {
  clearAccessKeyCacheForTests,
  getAccessActor,
  primeAccessKeysForTests,
  verifyAccessJwt,
} from "./access.ts";

function request(url: string, headers: Record<string, string> = {}): Request {
  return new Request(url, { headers });
}

function env(overrides: Partial<Env> = {}): Env {
  return {
    ENVIRONMENT: "production",
    ACCESS_TEAM_DOMAIN: TEST_ACCESS_TEAM_DOMAIN,
    ACCESS_AUD: TEST_ACCESS_AUD,
    ...overrides,
  } as Env;
}

function verify(token: string, now?: number) {
  return verifyAccessJwt(token, {
    teamDomain: TEST_ACCESS_TEAM_DOMAIN,
    audience: TEST_ACCESS_AUD,
    keys: testAccessKeys(),
    now,
  });
}

function accessHeaders(overrides: Record<string, string> = {}) {
  return {
    "cf-access-authenticated-user-email": TEST_ACCESS_EMAIL,
    "cf-access-jwt-assertion": createAccessToken(),
    ...overrides,
  };
}

describe("verifyAccessJwt", () => {
  it("accepts a signed token and normalizes the email claim", async () => {
    const claims = await verify(
      createAccessToken({ email: "Operator@Example.com" }),
    );

    expect(claims).toMatchObject({
      email: "operator@example.com",
      iss: `https://${TEST_ACCESS_TEAM_DOMAIN}`,
    });
  });

  it("accepts an audience string as well as an array", async () => {
    await expect(
      verify(createAccessToken({ aud: TEST_ACCESS_AUD })),
    ).resolves.toMatchObject({
      email: TEST_ACCESS_EMAIL,
    });
    await expect(
      verify(createAccessToken({ aud: "other-app-audience" })),
    ).resolves.toBeNull();
  });

  it("rejects a token minted for another application", async () => {
    await expect(
      verify(createAccessToken({ aud: ["another-access-app"] })),
    ).resolves.toBeNull();
  });

  it("rejects a token with a different issuer", async () => {
    await expect(
      verify(
        createAccessToken({ iss: "https://attacker.cloudflareaccess.com" }),
      ),
    ).resolves.toBeNull();
  });

  it("rejects expired and not-yet-valid tokens", async () => {
    const nowSeconds = Math.floor(Date.now() / 1000);

    await expect(
      verify(createAccessToken({ exp: nowSeconds - 3600 })),
    ).resolves.toBeNull();
    await expect(
      verify(createAccessToken({ nbf: nowSeconds + 3600 })),
    ).resolves.toBeNull();
  });

  it("rejects tokens without a usable email claim", async () => {
    await expect(
      verify(createAccessToken({ email: undefined })),
    ).resolves.toBeNull();
    await expect(
      verify(createAccessToken({ email: "not-an-email" })),
    ).resolves.toBeNull();
  });

  it("rejects unsigned tokens", async () => {
    await expect(
      verify(createAccessToken({}, { alg: "none" })),
    ).resolves.toBeNull();
  });

  it("rejects a token whose signature does not match", async () => {
    const [header, payload, signature] = createAccessToken().split(".");
    const tampered = `${header}.${payload}.${signature[0] === "A" ? "B" : "A"}${signature.slice(1)}`;

    await expect(verify(tampered)).resolves.toBeNull();
  });

  it("rejects a token signed by an unknown key id", async () => {
    await expect(
      verify(createAccessToken({}, { kid: "rotated-out-key" })),
    ).resolves.toBeNull();
  });
});

describe("signing key cache", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    clearAccessKeyCacheForTests();
  });

  it("refreshes at most once per interval for unknown key ids", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00.000Z"));

    const keys = testAccessKeys();
    clearAccessKeyCacheForTests();
    primeAccessKeysForTests(TEST_ACCESS_TEAM_DOMAIN, keys);

    // Typed with the real fetch signature so call arguments are inspectable.
    const fetchMock = vi.fn(
      async (..._args: Parameters<typeof fetch>) =>
        new Response(JSON.stringify({ keys }), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const token = createAccessToken({}, { kid: "rotated-key" });
    const forgedRequest = () =>
      request("https://example.com/api/f4c9/summary", {
        ...accessHeaders(),
        "cf-access-jwt-assertion": token,
      });

    // Priming set the refresh timestamp, so the first attempt waits one
    // interval before hitting the certs endpoint.
    vi.setSystemTime(new Date("2026-01-01T00:00:31.000Z"));
    await expect(getAccessActor(forgedRequest(), env())).resolves.toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0]?.[0]).toBe(
      `https://${TEST_ACCESS_TEAM_DOMAIN}/cdn-cgi/access/certs`,
    );

    // Immediately after: throttled, even though the kid is still unknown.
    await expect(getAccessActor(forgedRequest(), env())).resolves.toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(1);

    vi.setSystemTime(new Date("2026-01-01T00:01:02.000Z"));
    await expect(getAccessActor(forgedRequest(), env())).resolves.toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});

describe("getAccessActor", () => {
  beforeEach(() => {
    // The cache suite clears module state; repopulate so these cases stay
    // offline and deterministic.
    primeAccessKeysForTests(TEST_ACCESS_TEAM_DOMAIN, testAccessKeys());
  });

  it("accepts a verified Cloudflare Access token", async () => {
    const actor = await getAccessActor(
      request("https://example.com/api/f4c9/summary", accessHeaders()),
      env(),
    );

    expect(actor).toEqual({ email: TEST_ACCESS_EMAIL });
  });

  it("uses the verified email claim over the injected header", async () => {
    const actor = await getAccessActor(
      request(
        "https://example.com/api/f4c9/summary",
        accessHeaders({
          "cf-access-authenticated-user-email": "someone@example.com",
        }),
      ),
      env(),
    );

    expect(actor).toEqual({ email: TEST_ACCESS_EMAIL });
  });

  it("rejects spoofed header pairs", async () => {
    await expect(
      getAccessActor(
        request("https://example.com/api/f4c9/summary", {
          "cf-access-authenticated-user-email": TEST_ACCESS_EMAIL,
          "cf-access-jwt-assertion": "not-a-jwt",
        }),
        env(),
      ),
    ).resolves.toBeNull();
    await expect(
      getAccessActor(
        request("https://example.com/api/f4c9/summary", {
          "cf-access-jwt-assertion": createAccessToken(),
        }),
        env(),
      ),
    ).resolves.toBeNull();
    await expect(
      getAccessActor(request("https://example.com/api/f4c9/summary"), env()),
    ).resolves.toBeNull();
  });

  it("rejects a valid token when Access configuration is missing", async () => {
    await expect(
      getAccessActor(
        request("https://example.com/api/f4c9/summary", accessHeaders()),
        env({ ACCESS_AUD: "" }),
      ),
    ).resolves.toBeNull();
  });

  it("allows the dev bypass only on local hostnames", async () => {
    const headers = accessHeaders();

    await expect(
      getAccessActor(
        request("http://127.0.0.1:8787/api/f4c9/summary"),
        env({ ENVIRONMENT: "development" }),
      ),
    ).resolves.toEqual({ email: "dev@local" });
    await expect(
      getAccessActor(
        request("https://example.com/api/f4c9/summary"),
        env({ ENVIRONMENT: "development" }),
      ),
    ).resolves.toBeNull();
    await expect(
      getAccessActor(
        request("https://example.com/api/f4c9/summary", headers),
        env(),
      ),
    ).resolves.toEqual({ email: TEST_ACCESS_EMAIL });
  });
});
