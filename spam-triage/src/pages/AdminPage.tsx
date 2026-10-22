import { useState } from "react";
import {
  type AdminExportEntry,
  type AdminRemovalRequest,
  type AdminSummary,
  getAdminExport,
  loginAdmin,
  resolveAdminRemovalRequest,
} from "../api/admin.ts";
import { Button } from "../components/Button.tsx";
import { Card, CardBody } from "../components/Card.tsx";
import { CyberAlert } from "../components/CyberAlert.tsx";
import { GlitchText } from "../components/GlitchText.tsx";
import { Input } from "../components/Input.tsx";
import { StatusBadge } from "../components/StatusBadge.tsx";
import { TurnstileWidget } from "../components/TurnstileWidget.tsx";
import { soundFx } from "../lib/sound-fx.ts";

export default function AdminPage() {
  const [password, setPassword] = useState("");
  const [adminToken, setAdminToken] = useState("");
  const [turnstileToken, setTurnstileToken] = useState("");
  const [resetKey, setResetKey] = useState(0);
  const [authenticated, setAuthenticated] = useState(false);
  const [summary, setSummary] = useState<AdminSummary | null>(null);
  const [requests, setRequests] = useState<AdminRemovalRequest[]>([]);
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginError, setLoginError] = useState<unknown>(null);
  const [error, setError] = useState<unknown>(null);
  const [exportData, setExportData] = useState<AdminExportEntry[] | null>(null);
  const [exportLoading, setExportLoading] = useState(false);
  const [exportError, setExportError] = useState<unknown>(null);
  const [copySuccess, setCopySuccess] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    soundFx.scan();
    setLoginLoading(true);
    setLoginError(null);

    try {
      const res = await loginAdmin(password, turnstileToken);
      soundFx.success();
      setAdminToken(res.token);
      setPassword("");
      setSummary(res.summary);
      setRequests(res.requests);
      setAuthenticated(true);
    } catch (err) {
      soundFx.error();
      setLoginError(err);
      setTurnstileToken("");
      setResetKey((prev) => prev + 1);
    } finally {
      setLoginLoading(false);
    }
  };

  const handleSessionError = (err: unknown) => {
    if (err instanceof Error && err.message.startsWith("UNAUTHORIZED:")) {
      setAdminToken("");
      setAuthenticated(false);
      setTurnstileToken("");
      setLoginError(new Error("Session expired. Please sign in again."));
      setResetKey((prev) => prev + 1);
    }
  };

  const handleResolve = async (
    id: number,
    action: "approve_removal" | "reject_removal" | "mark_disputed",
  ) => {
    setError(null);
    soundFx.scan();
    try {
      await resolveAdminRemovalRequest(id, { action }, adminToken);
      soundFx.success();
      setRequests((prev) => prev.filter((r) => r.id !== id));
    } catch (err) {
      soundFx.error();
      setError(err);
      handleSessionError(err);
    }
  };

  const handleExport = async () => {
    setExportLoading(true);
    setExportError(null);
    soundFx.scan();
    try {
      const res = await getAdminExport(adminToken);
      soundFx.success();
      setExportData(res.entries);
    } catch (err) {
      soundFx.error();
      setExportError(err);
      handleSessionError(err);
    } finally {
      setExportLoading(false);
    }
  };

  const handleCopyExport = async () => {
    if (!exportData) return;
    soundFx.click();
    try {
      await navigator.clipboard.writeText(JSON.stringify(exportData, null, 2));
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    } catch {
      // fallback
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

  if (!authenticated) {
    return (
      <div className="page-stack max-w-lg mx-auto">
        <section className="page-hero">
          <p className="page-eyebrow">RESTRICTED ACCESS // LEVEL 5 CLEARANCE</p>
          <h1 className="page-title text-2xl sm:text-3xl">
            <GlitchText text="OPERATOR COMMAND DECK." as="span" />
          </h1>
          <p className="page-lede text-sm">
            Enter administrator cryptographic passkey to unlock system
            telemetry, verified spam blocklist exports, and removal triage
            resolution queues.
          </p>
        </section>

        <Card className="border-cyan-500/40 shadow-[0_0_25px_rgba(0,240,255,0.1)]">
          <CardBody className="space-y-4">
            <form onSubmit={handleLogin} className="space-y-4">
              <Input
                label="Operator Access Key"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••••••••"
                required
              />

              <div className="space-y-2">
                <TurnstileWidget
                  resetKey={resetKey}
                  action="admin_login"
                  onVerify={(token) => setTurnstileToken(token)}
                  onError={() => setTurnstileToken("")}
                />
              </div>

              <Button
                type="submit"
                loading={loginLoading}
                disabled={!turnstileToken || !password}
                className="w-full"
              >
                Unlock Command Deck
              </Button>
            </form>

            {Boolean(loginError) && (
              <CyberAlert
                error={loginError}
                onDismiss={() => setLoginError(null)}
              />
            )}
          </CardBody>
        </Card>
      </div>
    );
  }

  return (
    <div className="page-stack">
      {/* Header */}
      <section className="page-hero">
        <div className="flex items-center justify-between">
          <p className="page-eyebrow">COMMAND DECK // SYSTEM OVERSEER</p>
          <span className="font-mono text-xs text-[var(--cp-green)] bg-emerald-950/40 border border-emerald-400/30 px-2 py-0.5 rounded-xs">
            CLEARANCE: OPERATOR
          </span>
        </div>
        <h1 className="page-title">
          <GlitchText text="TRIAGE CONSOLE." as="span" />
        </h1>
        <p className="page-lede">
          System telemetry counters, verified spam blocklist exports, and active
          removal disputes awaiting operator adjudication.
        </p>
      </section>

      {/* Summary Stat Gauges */}
      {summary && (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4 font-mono">
          <Card className="border-cyan-500/30">
            <CardBody className="space-y-1">
              <span className="text-xs uppercase text-slate-400">
                Total Numbers
              </span>
              <p className="text-3xl font-bold font-display text-cyan-300">
                {summary.totalNumbers}
              </p>
            </CardBody>
          </Card>

          <Card className="border-cyan-500/30">
            <CardBody className="space-y-1">
              <span className="text-xs uppercase text-slate-400">
                Pending Review
              </span>
              <p className="text-3xl font-bold font-display text-cyan-400">
                {summary.pending}
              </p>
            </CardBody>
          </Card>

          <Card className="border-amber-500/30">
            <CardBody className="space-y-1">
              <span className="text-xs uppercase text-slate-400">
                Suspected Spam
              </span>
              <p className="text-3xl font-bold font-display text-amber-400">
                {summary.suspected}
              </p>
            </CardBody>
          </Card>

          <Card className="border-pink-400/40">
            <CardBody className="space-y-1">
              <span className="text-xs uppercase text-slate-400">
                Verified Spam
              </span>
              <p className="text-3xl font-bold font-display text-[var(--cp-pink)]">
                {summary.verifiedSpam}
              </p>
            </CardBody>
          </Card>

          <Card className="border-purple-500/30">
            <CardBody className="space-y-1">
              <span className="text-xs uppercase text-slate-400">
                Under Delist Review
              </span>
              <p className="text-3xl font-bold font-display text-purple-400">
                {summary.underRemovalReview}
              </p>
            </CardBody>
          </Card>

          <Card className="border-yellow-500/30">
            <CardBody className="space-y-1">
              <span className="text-xs uppercase text-slate-400">
                Contested / Disputed
              </span>
              <p className="text-3xl font-bold font-display text-yellow-400">
                {summary.disputed}
              </p>
            </CardBody>
          </Card>

          <Card className="border-slate-700">
            <CardBody className="space-y-1">
              <span className="text-xs uppercase text-slate-400">
                Purged / Removed
              </span>
              <p className="text-3xl font-bold font-display text-slate-400">
                {summary.removed}
              </p>
            </CardBody>
          </Card>

          <Card className="border-amber-500/40">
            <CardBody className="space-y-1">
              <span className="text-xs uppercase text-slate-400">
                Open Removal Cases
              </span>
              <p className="text-3xl font-bold font-display text-amber-300">
                {summary.openRemovalRequests}
              </p>
            </CardBody>
          </Card>
        </div>
      )}

      {/* Verified Spam Export Console */}
      <Card className="max-w-5xl border-cyan-500/30">
        <CardBody className="space-y-4">
          <div className="flex items-center justify-between border-b border-cyan-500/20 pb-3">
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
            Export all verified spam entries formatted for the Spam Sniper
            community-core engine. Preview below keeps masks intact; JSON output
            contains decrypted E.164 strings.
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
              {exportData ? "Refresh Telemetry Ledger" : "Load Blocklist Data"}
            </Button>

            {exportData && (
              <>
                <Button
                  variant="secondary"
                  onClick={handleCopyExport}
                  className="text-xs !py-2.5"
                >
                  {copySuccess ? "Copied to Clipboard!" : "Copy Full JSON"}
                </Button>
                <Button
                  variant="secondary"
                  onClick={handleDownloadExport}
                  className="text-xs !py-2.5"
                >
                  Download .json file
                </Button>
                <span className="font-mono text-xs text-cyan-400">
                  [{exportData.length} entries compiled]
                </span>
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

      {/* Manual Adjudication Queue */}
      <Card className="max-w-5xl border-cyan-500/30">
        <CardBody className="space-y-4">
          <div className="flex items-center justify-between border-b border-cyan-500/20 pb-3">
            <div>
              <p className="page-eyebrow">
                TRIAGE QUEUE // OPERATOR DISPOSITION
              </p>
              <h2 className="text-xl font-bold font-display text-white mt-1">
                Contested & Open Removals.
              </h2>
            </div>
            <span className="font-mono text-xs text-amber-400">
              [{requests.length} cases awaiting resolution]
            </span>
          </div>

          {Boolean(error) && (
            <CyberAlert error={error} onDismiss={() => setError(null)} />
          )}

          {requests.length === 0 ? (
            <p className="font-mono text-xs text-slate-400 py-4">
              [ALL_CLEAR] No open or contested removal requests in queue.
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
                    </div>
                    <span className="text-slate-500">CASE #{req.id}</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-slate-300">
                    <div>
                      <span className="text-slate-500">Reason:</span>{" "}
                      {req.reason}
                    </div>
                    <div>
                      <span className="text-slate-500">Contest Count:</span>{" "}
                      <span className="text-amber-400 font-bold">
                        {req.contest_count}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-500">Deadline:</span>{" "}
                      {new Date(req.contest_deadline).toLocaleDateString()}
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2 pt-2">
                    <Button
                      variant="primary"
                      onClick={() => handleResolve(req.id, "approve_removal")}
                      className="text-xs !py-1.5 !px-3"
                    >
                      Approve Removal (Delist)
                    </Button>
                    <Button
                      variant="danger"
                      onClick={() => handleResolve(req.id, "reject_removal")}
                      className="text-xs !py-1.5 !px-3"
                    >
                      Reject Removal (Maintain Block)
                    </Button>
                    <Button
                      variant="secondary"
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
    </div>
  );
}
