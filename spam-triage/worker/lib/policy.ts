export const VERIFIED_UNIQUE_REPORTERS = 3;
export const SUSPECTED_UNIQUE_REPORTERS = 2;

// Status confidence is based on recent activity, not lifetime totals. Old
// reports still count toward lifetime display totals but stop propping up a
// number that has not been reported in a long time.
export const RECENT_REPORT_WINDOW_DAYS = 90;

// Raw report rows are retained only for duplicate-report and confidence
// calculations. After this window they are purged and aggregates are rebuilt.
export const REPORT_RETENTION_DAYS = 365;
export const MODERATION_RETENTION_DAYS = 365;
export const AUDIT_RETENTION_DAYS = 730;

// Abuse controls for public removal submissions.
export const REMOVAL_REQUESTS_PER_DAY = 5;
export const REMOVAL_REJECT_COOLDOWN_DAYS = 7;

// Cron budgets. Jobs are set-based where possible and the per-row legacy
// migration stays well below D1's queries-per-invocation limit.
export const FINALIZER_BATCH_SIZE = 1_000;
export const FINALIZER_MAX_BATCHES = 5;
export const RECONCILE_BATCH_SIZE = 500;
export const CLEANUP_BATCH_SIZE = 500;
export const CLEANUP_MAX_BATCHES = 2;
export const CLEANUP_ID_CHUNK = 80;
export const LEGACY_MIGRATION_BATCH_SIZE = 20;
export const LEGACY_MIGRATION_RETRY_DAYS = 1;

export function isoDaysAgo(days: number, now = Date.now()): string {
  return new Date(now - days * 24 * 60 * 60 * 1000).toISOString();
}

export function isoDaysFromNow(days: number, now = Date.now()): string {
  return new Date(now + days * 24 * 60 * 60 * 1000).toISOString();
}
