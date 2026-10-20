import { createE164Cipher } from "../lib/encryption.ts";
import type { Env } from "../types.ts";

const MIGRATION_BATCH_SIZE = 100;

// Encrypts legacy plaintext E.164 rows in bounded batches. Runs from the daily
// cron until no plaintext values remain.
export async function encryptLegacyPhoneNumbers(env: Env): Promise<number> {
  const rows = await env.DB.prepare(
    "SELECT id, phone_number_e164 FROM numbers WHERE phone_number_e164 IS NOT NULL LIMIT ?",
  )
    .bind(MIGRATION_BATCH_SIZE)
    .all<{ id: number; phone_number_e164: string }>();

  const now = new Date().toISOString();
  const cipher = createE164Cipher(env.HASH_SECRET);
  let migrated = 0;

  for (const row of rows.results ?? []) {
    const encrypted = await cipher.encrypt(row.phone_number_e164);

    await env.DB.prepare(
      "UPDATE numbers SET phone_number_enc = ?, phone_number_e164 = NULL, updated_at = ? WHERE id = ?",
    )
      .bind(encrypted, now, row.id)
      .run();

    migrated++;
  }

  return migrated;
}
