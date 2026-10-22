import { useCallback, useEffect, useState } from "react";
import {
  type AdminExportEntry,
  type AdminRemovalRequest,
  type AdminSummary,
  getAdminExport,
  getAdminRemovalRequests,
  getAdminSummary,
  resolveAdminRemovalRequest,
} from "../api/admin.ts";
import { Button } from "../components/Button.tsx";
import { Card, CardBody } from "../components/Card.tsx";
import { CyberAlert } from "../components/CyberAlert.tsx";
import { GlitchText } from "../components/GlitchText.tsx";
import { StatusBadge } from "../components/StatusBadge.tsx";
import { soundFx } from "../lib/sound-fx.ts";

interface ExportMeta {
  total: number;
  skipped: number;
  hasMore: boolean;
  nextOffset: number | null;
}

function isAccessError(error: unknown): boolean {
  return (
    error instanceof Error &&
    (error.message.startsWith("UNAUTHORIZED:") ||
      error.message.startsWith("FORBIDDEN:") ||
      error.message.startsWith("INVALID_RESPONSE:") ||
      error.message.startsWith("HTTP_401:") ||
      error.message.startsWith("HTTP_403:"))
  );
}

export default function AdminPage() {
  const [summary, setSummary] = useState<AdminSummary | null>(null);
  const [requests, setRequests] = useState<AdminRemovalRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>(null);
  const [accessError, setAccessError] = useState(false);
  const [busyCase, setBusyCase] = useState<number | null>(null);

  const [exportData, setExportData] = useState<AdminExportEntry[] | null>(null);
  const [exportMeta, setExportMeta] = useState<ExportMeta | null>(null);
  const [exportLoading, setExportLoading] = useState(false);
  const [exportError, setExportError] = useState<unknown>(null);
  const [copySuccess, setCopySuccess] = useState(false);

  const loadAdminData = useCallback(async () => {
    setLoading(true);
    setError(null);
    setAccessError(false);

    try {
      const [summaryRes, requestsRes] = await Promise.all([
        getAdminSummary(),
        getAdminRemovalRequests(),
      ]);
      setSummary(summaryRes);
      setRequests(requestsRes.requests);
    } catch (err) {
      if (isAccessError(err)) {
        setAccessError(true);
      } else {
        setError(err);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadAdminData();
  }, [loadAdminData]);

  const handleResolve = async (
    id: number,
    action: "approve_removal" | "reject_removal" | "mark_disputed",
  ) => {
    setError(null);
    setBusyCase(id);
    soundFx.scan();
    try {
      await resolveAdminRemovalRequest(id, { action });
      soundFx.success();
      await loadAdminData();
    } catch (err) {
      soundFx.error();
      if (isAccessError(err)) {
        setAccessError(true);
      } else {
        setError(err);
      }
    } finally {
      setBusyCase(null);
    }
  };

  const loadExport = async (offset: number, append: boolean) => {
    setExportLoading(true);
    setExportError(null);
    soundFx.scan();
    try {
      const res = await getAdminExport(500, offset);
      soundFx.success();
      setExportData((current) =>
        append && current ? [...current, ...res.entries] : res.entries,
      );
      setExportMeta((current) => ({
        total: res.total_entries,
        skipped: (append ? (current?.skipped ?? 0) : 0) + res.skipped_entries,
        hasMore: res.has_more,
        nextOffset: res.next_offset,
      }));
    } catch (err) {
      soundFx.error();
      if (isAccessError(err)) {
        setAccessError(true);
      } else {
        setExportError(err);
      }
    } finally {
      setExportLoading(false);
    }
  };

  const handleExport = () => {
    void loadExport(0, false);
  };

  const handleLoadMore = () => {
    if (
      exportMeta?.nextOffset === null ||
      exportMeta?.nextOffset === undefined
    ) {
      return;
    }
    void loadExport(exportMeta.nextOffset, true);
  };

  const handleCopyExport = async () => {
    if (!exportData) return;
    soundFx.click();
    try {
      await navigator.clipboard.writeText(JSON.stringify(exportData, null, 2));
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    } catch {
      // Clipboard access can be denied by the browser.
    }
  };

  const handleDownloadExport = () => {
    if (!exportData) return;
    soundFx.click();
    const blob = new Blob([JSON.stringify(exportData, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `spam-blocklist-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (accessError) {
    return (
      <div className="page-stack max-w-2xl mx-auto">
        <section className="page-hero">
          <p className="page-eyebrow">RESTRICTED ACCESS // CLOUDFLARE ACCESS</p>
          <h1 className="page-title text-2xl sm:text-3xl">
            <GlitchText text="ACCESS REQUIRED." as="span" />
          </h1>
          <p className="page-lede text-sm">
            The admin console is protected by Cloudflare Access. Authenticate
            through the Access policy for this hostname, then reload this page.
          </p>
        </section>
        <Card className="border-amber-500/40">
          <CardBody className="space-y-3 font-mono text-xs text-slate-300">
            <p>
              This page does not accept a password. Authentication and session
              management are handled by Cloudflare Access.
            </p>
            <Button
              variant="secondary"
              className="text-xs !py-2"
              onClick={() => window.location.reload()}
            >
              Reload After Access Login
            </Button>
          </CardBody>
        </Card>
      </div>
    );
  }

  if (loading && !summary) {
    return (
      <div className="page-stack">
        <section className="page-hero">
          <p className="page-eyebrow">COMMAND DECK // SYSTEM OVERSEER</p>
          <h1 className="page-title">
            <GlitchText text="TRIAGE CONSOLE." as="span" />
          </h1>
        </section>
        <Card className="max-w-2xl">
          <CardBody>
            <p className="font-mono text-sm text-cyan-400 animate-pulse">
              [SYSTEM_POLLING] Loading operator telemetry...
            </p>
          </CardBody>
        </Card>
      </div>
    );
  }

  return (
    <div className="page-stack">
      <section className="page-hero">
        <div className="flex items-center justify-between">
          <p className="page-eyebrow">COMMAND DECK // SYSTEM OVERSEER</p>
          <span className="font-mono text-xs text-[var(--cp-green)] bg-emerald-950/40 border border-emerald-400/30 px-2 py-0.5 rounded-xs">
            ACCESS: CF ACCESS
          </span>
        </div>
        <h1 className="page-title">
          <GlitchText text="TRIAGE CONSOLE." as="span" />
        </h1>
        <p className="page-lede">
          System telemetry counters, verified spam blocklist exports, and
          removal disputes awaiting operator adjudication.
        </p>
      </section>

      {Boolean(error) && (
        <CyberAlert error={error} onDismiss={() => setError(null)} />
      )}

      {summary && (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4 font-mono">
          <StatCard label="Total Numbers" value={summary.totalNumbers} />
          <StatCard label="Pending Review" value={summary.pending} />
          <StatCard label="Suspected Spam" value={summary.suspected} />
          <StatCard label="Verified Spam" value={summary.verifiedSpam} />
          <StatCard
            label="Under Delist Review"
            value={summary.underRemovalReview}
          />
          <StatCard
            label="Awaiting Operator"
            value={summary.pendingReviewRemovalRequests}
          />
          <StatCard label="Contested / Disputed" value={summary.disputed} />
          <StatCard label="Purged / Removed" value={summary.removed} />
          <StatCard
            label="Open Removal Cases"
            value={summary.openRemovalRequests}
          />
        </div>
      )}

      {summary && Object.keys(summary.maintenance).length > 0 && (
        <Card className="max-w-6xl border-slate-700">
          <CardBody className="grid gap-2 font-mono text-xs text-slate-300 sm:grid-cols-3">
            <Info
              label="Finalizer"
              value={
                summary.maintenance.finalizer_last_run
                  ? new Date(
                      summary.maintenance.finalizer_last_run,
                    ).toLocaleString()
                  : "not run"
              }
            />
            <Info
              label="Reconcile"
              value={
                summary.maintenance.reconcile_last_run
                  ? new Date(
                      summary.maintenance.reconcile_last_run,
                    ).toLocaleString()
                  : "not run"
              }
            />
            <Info
              label="Cleanup"
              value={
                summary.maintenance.cleanup_last_run
                  ? new Date(
                      summary.maintenance.cleanup_last_run,
                    ).toLocaleString()
                  : "not run"
              }
            />
          </CardBody>
        </Card>
      )}

      <Card className="max-w-6xl border-cyan-500/30">
        <CardBody className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-cyan-500/20 pb-3">
            <div>
              <p className="page-eyebrow">TELEMETRY SYNC // BLOCKLIST EXPORT</p>
              <h2 className="text-xl font-bold font-display text-white mt-1">
                Verified Spam Blocklist.
              </h2>
            </div>
            <span className="font-mono text-xs text-cyan-400">
              FORMAT: E.164 JSON
            </span>
          </div>

          <p className="font-mono text-xs text-slate-300">
            Export verified spam entries in pages. Preview keeps masks intact;
            JSON output contains decrypted E.164 strings.
          </p>

          {Boolean(exportError) && (
            <CyberAlert
              error={exportError}
              onDismiss={() => setExportError(null)}
            />
          )}

          <div className="flex flex-wrap items-center gap-3">
            <Button
              variant="primary"
              loading={exportLoading}
              onClick={handleExport}
              className="text-xs !py-2.5"
            >
              {exportData ? "Refresh Export" : "Load Blocklist Data"}
            </Button>

            {exportData && (
              <>
                <Button
                  variant="secondary"
                  onClick={handleCopyExport}
                  className="text-xs !py-2.5"
                >
                  {copySuccess ? "Copied to Clipboard!" : "Copy Loaded JSON"}
                </Button>
                <Button
                  variant="secondary"
                  onClick={handleDownloadExport}
                  className="text-xs !py-2.5"
                >
                  Download Loaded .json
                </Button>
                {exportMeta?.hasMore && (
                  <Button
                    variant="secondary"
                    loading={exportLoading}
                    onClick={handleLoadMore}
                    className="text-xs !py-2.5"
                  >
                    Load Next Page
                  </Button>
                )}
                <span className="font-mono text-xs text-cyan-400">
                  [{exportData.length} loaded / {exportMeta?.total ?? 0} total]
                </span>
                {exportMeta?.skipped ? (
                  <span className="font-mono text-xs text-amber-400">
                    [{exportMeta.skipped} undecryptable skipped]
                  </span>
                ) : null}
              </>
            )}
          </div>

          {exportData && (
            <div className="max-h-96 space-y-2 overflow-auto rounded-sm border border-cyan-500/20 bg-[var(--cp-bg)] p-3 font-mono text-xs text-slate-200">
              {exportData.length === 0 ? (
                <p className="text-slate-500">
                  No verified spam entries in active dataset.
                </p>
              ) : (
                exportData.map((entry) => (
                  <div
                    key={`${entry.phone_number_e164}-${entry.category}`}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-xs border border-cyan-500/15 bg-[var(--cp-surface)] px-3 py-2 hover:border-cyan-400/40 transition-colors"
                  >
                    <div>
                      <p className="font-bold text-white tracking-wider">
                        {entry.display_mask}
                      </p>
                      <p className="text-[11px] text-slate-400">
                        Category:{" "}
                        <span className="text-cyan-300">{entry.category}</span>{" "}
                        · Confidence: {entry.confidence}
                      </p>
                    </div>
                    <div className="text-right">
                      <span className="text-[11px] text-[var(--cp-green)]">
                        {entry.unique_reporter_count} Unique Nodes
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </CardBody>
      </Card>

      <Card className="max-w-6xl border-cyan-500/30">
        <CardBody className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-cyan-500/20 pb-3">
            <div>
              <p className="page-eyebrow">
                TRIAGE QUEUE // OPERATOR DISPOSITION
              </p>
              <h2 className="text-xl font-bold font-display text-white mt-1">
                Open, Pending Review & Contested Removals.
              </h2>
            </div>
            <span className="font-mono text-xs text-amber-400">
              [{requests.length} cases loaded]
            </span>
          </div>

          {requests.length === 0 ? (
            <p className="font-mono text-xs text-slate-400 py-4">
              [ALL_CLEAR] No active removal requests in queue.
            </p>
          ) : (
            <div className="space-y-3">
              {requests.map((req) => (
                <div
                  key={req.id}
                  className="rounded-sm border border-cyan-500/20 bg-[var(--cp-bg)] p-4 space-y-3 font-mono text-xs"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-cyan-500/10 pb-2">
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-bold text-white tracking-wider">
                        {req.display_mask}
                      </span>
                      <StatusBadge status={req.status} />
                      <StatusBadge status={req.number_status} />
                    </div>
                    <span className="text-slate-500">CASE #{req.id}</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 text-slate-300">
                    <Info label="Reason" value={req.reason} />
                    <Info label="Contests" value={String(req.contest_count)} />
                    <Info
                      label="Reporters"
                      value={`${req.recent_unique_reporter_count} recent / ${req.unique_reporter_count} total`}
                    />
                    <Info
                      label="Deadline"
                      value={new Date(
                        req.contest_deadline,
                      ).toLocaleDateString()}
                    />
                  </div>

                  {req.contest_reasons && (
                    <p className="text-slate-400">
                      <span className="text-slate-500">Contest reasons:</span>{" "}
                      {req.contest_reasons.split(",").join(", ")}
                    </p>
                  )}

                  <div className="flex flex-wrap gap-2 pt-2">
                    <Button
                      variant="primary"
                      loading={busyCase === req.id}
                      onClick={() => handleResolve(req.id, "approve_removal")}
                      className="text-xs !py-1.5 !px-3"
                    >
                      Approve Removal (Delist)
                    </Button>
                    <Button
                      variant="danger"
                      disabled={busyCase === req.id}
                      onClick={() => handleResolve(req.id, "reject_removal")}
                      className="text-xs !py-1.5 !px-3"
                    >
                      Reject Removal (Maintain Block)
                    </Button>
                    <Button
                      variant="secondary"
                      disabled={busyCase === req.id}
                      onClick={() => handleResolve(req.id, "mark_disputed")}
                      className="text-xs !py-1.5 !px-3"
                    >
                      Mark Disputed (Freeze)
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardBody>
      </Card>

      {summary?.recentAudit && summary.recentAudit.length > 0 && (
        <Card className="max-w-6xl border-slate-700">
          <CardBody className="space-y-3">
            <div className="border-b border-cyan-500/20 pb-3">
              <p className="page-eyebrow">
                AUDIT TRAIL // RECENT OPERATOR ACTIONS
              </p>
            </div>
            <div className="space-y-1 font-mono text-xs">
              {summary.recentAudit.map((entry) => (
                <div
                  key={entry.id}
                  className="flex flex-wrap items-center justify-between gap-2 border border-cyan-500/10 bg-[var(--cp-surface)] px-3 py-2"
                >
                  <span className="text-slate-300">
                    {entry.actor} · {entry.action} · {entry.target_type}
                    {entry.target_id ? ` #${entry.target_id}` : ""}
                  </span>
                  <span className="text-slate-500">
                    {new Date(entry.created_at).toLocaleString()}
                  </span>
                </div>
              ))}
            </div>
          </CardBody>
        </Card>
      )}
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <Card className="border-cyan-500/30">
      <CardBody className="space-y-1">
        <span className="text-xs uppercase text-slate-400">{label}</span>
        <p className="text-3xl font-bold font-display text-cyan-300">{value}</p>
      </CardBody>
    </Card>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span className="text-slate-500">{label}:</span> {value}
    </div>
  );
}
