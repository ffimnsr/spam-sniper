export interface AuditActor {
  email: string;
}

export interface AuditEntry {
  id: number;
  actor: string;
  action: string;
  target_type: string;
  target_id: number | null;
  metadata: string | null;
  created_at: string;
}

export function createAuditStatement(
  db: D1Database,
  actor: string,
  action: string,
  targetType: string,
  targetId: number | null,
  metadata: Record<string, unknown> | null,
  createdAt: string,
): D1PreparedStatement {
  return db
    .prepare(
      "INSERT INTO admin_audit_log (actor, action, target_type, target_id, metadata, created_at) VALUES (?, ?, ?, ?, ?, ?)",
    )
    .bind(
      actor,
      action,
      targetType,
      targetId,
      metadata ? JSON.stringify(metadata) : null,
      createdAt,
    );
}

export async function getRecentAudit(
  db: D1Database,
  limit = 20,
): Promise<AuditEntry[]> {
  const rows = await db
    .prepare(
      "SELECT id, actor, action, target_type, target_id, metadata, created_at FROM admin_audit_log ORDER BY created_at DESC, id DESC LIMIT ?",
    )
    .bind(limit)
    .all<AuditEntry>();

  return rows.results ?? [];
}
