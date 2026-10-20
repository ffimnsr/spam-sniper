// Public-facing identifiers must be unguessable so removal request URLs
// cannot be enumerated. 128 bits of randomness is plenty for this dataset.
const PUBLIC_TOKEN_BYTES = 16;

export function createPublicToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(PUBLIC_TOKEN_BYTES));
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join(
    "",
  );
}

export const PUBLIC_TOKEN_PATTERN = "[0-9a-f]{32}";
