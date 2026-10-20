import { hmacSha256 } from "./hash.ts";

const VERSION = "v1";
const IV_BYTES = 12;
const KEY_LABEL = "spam-sniper:e164-encryption:v1";
const HEX_RE = /^[0-9a-f]+$/;

function hexToBytes(hex: string): Uint8Array {
  if (hex.length % 2 !== 0 || !HEX_RE.test(hex)) {
    throw new Error("INVALID_HEX");
  }
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = Number.parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join(
    "",
  );
}

async function deriveKey(secret: string): Promise<CryptoKey> {
  const keyBytes = hexToBytes(await hmacSha256(secret, KEY_LABEL));
  return crypto.subtle.importKey("raw", keyBytes, { name: "AES-GCM" }, false, [
    "encrypt",
    "decrypt",
  ]);
}

export interface E164Cipher {
  encrypt(e164: string): Promise<string>;
  decrypt(payload: string | null): Promise<string | null>;
}

// At-rest encryption for E.164 values. The key is derived from HASH_SECRET with
// a distinct label so number hashing and ciphertext never share a key. Reuse a
// cipher instance for batch work so the key is derived once.
export function createE164Cipher(secret: string): E164Cipher {
  let keyPromise: Promise<CryptoKey> | null = null;

  const getKey = (): Promise<CryptoKey> => {
    if (!secret) {
      return Promise.reject(new Error("ENCRYPTION_SECRET_MISSING"));
    }
    keyPromise ??= deriveKey(secret);
    return keyPromise;
  };

  return {
    async encrypt(e164: string): Promise<string> {
      const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES));
      const ciphertext = await crypto.subtle.encrypt(
        { name: "AES-GCM", iv },
        await getKey(),
        new TextEncoder().encode(e164),
      );

      return `${VERSION}.${bytesToHex(iv)}.${bytesToHex(new Uint8Array(ciphertext))}`;
    },

    async decrypt(payload: string | null): Promise<string | null> {
      if (!payload) return null;

      const parts = payload.split(".");
      if (parts.length !== 3 || parts[0] !== VERSION) return null;

      try {
        const iv = hexToBytes(parts[1]);
        if (iv.length !== IV_BYTES) return null;

        const plaintext = await crypto.subtle.decrypt(
          { name: "AES-GCM", iv },
          await getKey(),
          hexToBytes(parts[2]),
        );

        return new TextDecoder().decode(plaintext);
      } catch {
        return null;
      }
    },
  };
}

export async function encryptE164(
  secret: string,
  e164: string,
): Promise<string> {
  return createE164Cipher(secret).encrypt(e164);
}

export async function decryptE164(
  secret: string,
  payload: string | null,
): Promise<string | null> {
  return createE164Cipher(secret).decrypt(payload);
}
