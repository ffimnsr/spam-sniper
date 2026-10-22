import { reconcileNumberStats } from "../lib/number-stats.ts";
import {
  isoDaysAgo,
  RECENT_REPORT_WINDOW_DAYS,
  RECONCILE_BATCH_SIZE,
} from "../lib/policy.ts";
import { setSystemState } from "../lib/system-state.ts";
import type { Env } from "../types.ts";

export interface ReconcileResult {
  checked: number;
}

// Set-based recompute for the oldest slice of numbers. One statement keeps the
// job inside D1's free-tier query budget.
export async function reconcileNumbers(env: Env): Promise<ReconcileResult> {
  const nowMs = Date.now();
  const now = new Date(nowMs).toISOString();
  const recentCutoff = isoDaysAgo(RECENT_REPORT_WINDOW_DAYS, nowMs);

  const result = await reconcileNumberStats(
    env.DB,
    RECONCILE_BATCH_SIZE,
    recentCutoff,
    now,
  ).run();
  const checked = result.meta?.changes ?? 0;

  await setSystemState(env.DB, "reconcile_last_run", now, now);
  await setSystemState(
    env.DB,
    "reconcile_last_result",
    JSON.stringify({ checked }),
    now,
  );

  return { checked };
}
