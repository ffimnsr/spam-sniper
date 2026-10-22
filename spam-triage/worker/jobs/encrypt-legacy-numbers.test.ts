import { describe, expect, it } from "vitest";
import { decryptE164, encryptE164 } from "../lib/encryption.ts";
import { hashNumber, hmacSha256 } from "../lib/hash.ts";
import { createTestDb, makeTestEnv } from "../test/sqlite-d1.ts";
import { encryptLegacyPhoneNumbers } from "./encrypt-legacy-numbers.ts";

const PHONE = "+15551234567";

function insertNumber(
  db: ReturnType<typeof createTestDb>,
  values: {
    numberHash: string;
    plaintext?: string | null;
    encrypted?: string | null;
  },
) {
  db.raw()
    .prepare(
      `INSERT INTO numbers
        (number_hash, phone_number_e164, phone_number_enc, display_mask, country_code, status, first_reported_at, last_reported_at, updated_at)
       VALUES (?, ?, ?, ?, ?, 'pending', ?, ?, ?)`,
    )
    .run(
      values.numberHash,
      values.plaintext ?? null,
      values.encrypted ?? null,
      "+1 555 *** 4567",
      "US",
      "2026-01-01T00:00:00.000Z",
      "2026-01-01T00:00:00.000Z",
      "2026-01-01T00:00:00.000Z",
    );
}

describe("encryptLegacyPhoneNumbers", () => {
  it("encrypts plaintext and rewrites legacy hashes", async () => {
    const db = createTestDb();
    const legacyHash = await hmacSha256("test-secret", PHONE);
    insertNumber(db, { numberHash: legacyHash, plaintext: PHONE });

    db.resetQueryCount();
    const migrated = await encryptLegacyPhoneNumbers(makeTestEnv(db));

    expect(db.queryCount).toBeLessThan(50);
    expect(migrated).toBe(1);
    const row = db.raw().prepare("SELECT * FROM numbers").get() as {
      number_hash: string;
      phone_number_e164: string | null;
      phone_number_enc: string | null;
    };
    expect(row.phone_number_e164).toBeNull();
    expect(row.number_hash).toMatch(/^v2:/);
    expect(await decryptE164("test-secret", row.phone_number_enc)).toBe(PHONE);
  });

  it("rotates ciphertext and hashes using the previous secret", async () => {
    const db = createTestDb();
    const previousSecret = "old-secret";
    const oldHash = await hashNumber(previousSecret, PHONE);
    const oldCiphertext = await encryptE164(previousSecret, PHONE);
    insertNumber(db, { numberHash: oldHash, encrypted: oldCiphertext });

    const env = makeTestEnv(db);
    env.HASH_SECRET_PREVIOUS = previousSecret;

    expect(await encryptLegacyPhoneNumbers(env)).toBe(1);

    const row = db.raw().prepare("SELECT * FROM numbers").get() as {
      number_hash: string;
      phone_number_enc: string | null;
    };
    expect(row.number_hash).toMatch(/^v2:/);
    expect(await decryptE164("test-secret", row.phone_number_enc)).toBe(PHONE);
  });

  it("marks undecryptable rows checked so they do not stall the batch", async () => {
    const db = createTestDb();
    insertNumber(db, {
      numberHash: "v2:old-key:deadbeef",
      encrypted: "v1.bad.bad",
    });
    const env = makeTestEnv(db);

    expect(await encryptLegacyPhoneNumbers(env)).toBe(0);
    const row = db
      .raw()
      .prepare("SELECT legacy_migration_checked_at FROM numbers")
      .get() as { legacy_migration_checked_at: string };
    expect(row.legacy_migration_checked_at).not.toBe("");

    // The retry cutoff prevents the same row from being selected immediately.
    expect(await encryptLegacyPhoneNumbers(env)).toBe(0);
  });

  it("encrypts plaintext even when the rehash collides", async () => {
    const db = createTestDb();
    const currentHash = await hashNumber("test-secret", PHONE);
    const legacyHash = await hmacSha256("test-secret", PHONE);
    insertNumber(db, {
      numberHash: currentHash,
      encrypted: await encryptE164("test-secret", PHONE),
    });
    insertNumber(db, { numberHash: legacyHash, plaintext: PHONE });

    expect(await encryptLegacyPhoneNumbers(makeTestEnv(db))).toBe(0);

    const legacy = db
      .raw()
      .prepare(
        "SELECT phone_number_e164, phone_number_enc FROM numbers WHERE number_hash = ?",
      )
      .get(legacyHash) as {
      phone_number_e164: string | null;
      phone_number_enc: string | null;
    };
    expect(legacy.phone_number_e164).toBeNull();
    expect(await decryptE164("test-secret", legacy.phone_number_enc)).toBe(
      PHONE,
    );
  });

  it("stays inside the query budget when rehash collisions occur", async () => {
    const db = createTestDb();
    const encrypted = await encryptE164("test-secret", PHONE);
    for (let index = 0; index < 20; index++) {
      insertNumber(db, {
        numberHash: `legacy-collision-${index}`,
        encrypted,
      });
    }

    db.resetQueryCount();
    const migrated = await encryptLegacyPhoneNumbers(makeTestEnv(db));

    expect(migrated).toBe(1);
    expect(db.queryCount).toBeLessThan(50);
  });

  it("does nothing when no legacy rows remain", async () => {
    const db = createTestDb();
    insertNumber(db, {
      numberHash: await hashNumber("test-secret", PHONE),
      encrypted: await encryptE164("test-secret", PHONE),
    });

    expect(await encryptLegacyPhoneNumbers(makeTestEnv(db))).toBe(0);
  });
});
