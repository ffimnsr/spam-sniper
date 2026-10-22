export async function setSystemState(
  db: D1Database,
  key: string,
  value: string,
  updatedAt: string,
): Promise<void> {
  await db
    .prepare(
      "INSERT INTO system_state (key, value, updated_at) VALUES (?, ?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at",
    )
    .bind(key, value, updatedAt)
    .run();
}

export async function getSystemState(
  db: D1Database,
): Promise<Record<string, string>> {
  const rows = await db
    .prepare("SELECT key, value FROM system_state")
    .all<{ key: string; value: string }>();

  return Object.fromEntries(
    (rows.results ?? []).map((row) => [row.key, row.value]),
  );
}
