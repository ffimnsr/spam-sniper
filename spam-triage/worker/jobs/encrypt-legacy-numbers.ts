import { isUniqueConstraintError } from "../lib/d1.ts";
import { createE164Cipher } from "../lib/encryption.ts";
import { currentHashPrefix, hashNumber } from "../lib/hash.ts";
import {
  isoDaysAgo,
  LEGACY_MIGRATION_BATCH_SIZE,
  LEGACY_MIGRATION_RETRY_DAYS,
} from "../lib/policy.ts";
import { setSystemState } from "../lib/system-state.ts";
import type { Env } from "../types.ts";

// Finishes legacy plaintext encryption and rehashes rows written before the
// versioned hash format. Runs from the daily cron until no work remains.
export async function encryptLegacyPhoneNumbers(env: Env): Promise<number> {
  const nowMs = Date.now();
  const now = new Date(nowMs).toISOString();
  const currentPrefix = await currentHashPrefix(env.HASH_SECRET);
  const rows = await env.DB.prepare(
    `SELECT id, number_hash, phone_number_e164, phone_number_enc
       FROM numbers
      WHERE (phone_number_e164 IS NOT NULL OR number_hash NOT LIKE ?)
        AND legacy_migration_checked_at < ?
      ORDER BY legacy_migration_checked_at ASC, id ASC
      LIMIT ?`,
  )
    .bind(
      `${currentPrefix}%`,
      isoDaysAgo(LEGACY_MIGRATION_RETRY_DAYS, nowMs),
      LEGACY_MIGRATION_BATCH_SIZE,
    )
    .all<{
      id: number;
      number_hash: string;
      phone_number_e164: string | null;
      phone_number_enc: string | null;
    }>();

  const cipher = createE164Cipher(env.HASH_SECRET, env.HASH_SECRET_PREVIOUS);
  let migrated = 0;

  for (const row of rows.results ?? []) {
    const e164 =
      row.phone_number_e164 ?? (await cipher.decrypt(row.phone_number_enc));
    if (!e164) {
      console.error("Legacy number could not be decrypted", { id: row.id });
      await markMigrationChecked(env, row.id, now);
      continue;
    }

    const encrypted = await cipher.encrypt(e164);
    const numberHash = await hashNumber(env.HASH_SECRET, e164);

    try {
      await env.DB.prepare(
        "UPDATE numbers SET number_hash = ?, phone_number_enc = ?, phone_number_e164 = NULL, legacy_migration_checked_at = ?, updated_at = ? WHERE id = ?",
      )
        .bind(numberHash, encrypted, now, now, row.id)
        .run();
      migrated++;
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        console.error("Legacy number rehash collided with an existing row", {
          id: row.id,
        });
        // The hash could not move because another row already owns it, but a
        // plaintext legacy value still must be encrypted before the row is
        // parked for retry.
        if (row.phone_number_e164 !== null) {
          await env.DB.prepare(
            "UPDATE numbers SET phone_number_enc = ?, phone_number_e164 = NULL, legacy_migration_checked_at = ?, updated_at = ? WHERE id = ?",
          )
            .bind(encrypted, now, now, row.id)
            .run();
        } else {
          await markMigrationChecked(env, row.id, now);
        }
        continue;
      }
      throw error;
    }
  }

  await setSystemState(env.DB, "legacy_migration_last_run", now, now);

  return migrated;
}

async function markMigrationChecked(
  env: Env,
  numberId: number,
  now: string,
): Promise<void> {
  await env.DB.prepare(
    "UPDATE numbers SET legacy_migration_checked_at = ? WHERE id = ?",
  )
    .bind(now, numberId)
    .run();
}
