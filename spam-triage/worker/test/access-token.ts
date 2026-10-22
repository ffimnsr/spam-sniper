import { generateKeyPairSync, type KeyObject, sign } from "node:crypto";
import { primeAccessKeysForTests } from "../lib/access.ts";

export const TEST_ACCESS_TEAM_DOMAIN = "spam-sniper-test.cloudflareaccess.com";
export const TEST_ACCESS_AUD = "test-application-audience";
export const TEST_ACCESS_EMAIL = "operator@example.com";

const KEY_ID = "test-access-key";

interface TestSigner {
  privateKey: KeyObject;
  jwk: JsonWebKeyWithKid;
}

let signer: TestSigner | null = null;

function getSigner(): TestSigner {
  if (!signer) {
    const { privateKey, publicKey } = generateKeyPairSync("rsa", {
      modulusLength: 2048,
    });
    const jwk: JsonWebKeyWithKid = {
      ...(publicKey.export({ format: "jwk" }) as JsonWebKey),
      kid: KEY_ID,
      alg: "RS256",
      use: "sig",
    };
    signer = { privateKey, jwk };
    primeAccessKeysForTests(TEST_ACCESS_TEAM_DOMAIN, [jwk]);
  }
  return signer;
}

export function testAccessKeys(): JsonWebKeyWithKid[] {
  return [getSigner().jwk];
}

function encodeSegment(value: unknown): string {
  return Buffer.from(JSON.stringify(value), "utf8").toString("base64url");
}

// Builds a structurally valid Access JWT signed with the test key. Overrides
// let suites exercise rejected claims without a network round trip.
export function createAccessToken(
  payloadOverrides: Record<string, unknown> = {},
  headerOverrides: Record<string, unknown> = {},
): string {
  const { privateKey } = getSigner();
  const nowSeconds = Math.floor(Date.now() / 1000);
  const header = {
    alg: "RS256",
    typ: "JWT",
    kid: KEY_ID,
    ...headerOverrides,
  };
  const payload = {
    iss: `https://${TEST_ACCESS_TEAM_DOMAIN}`,
    aud: [TEST_ACCESS_AUD],
    email: TEST_ACCESS_EMAIL,
    sub: "access-user",
    iat: nowSeconds,
    exp: nowSeconds + 3600,
    ...payloadOverrides,
  };

  const unsigned = `${encodeSegment(header)}.${encodeSegment(payload)}`;
  const signature = sign(
    "RSA-SHA256",
    Buffer.from(unsigned, "utf8"),
    privateKey,
  ).toString("base64url");

  return `${unsigned}.${signature}`;
}
