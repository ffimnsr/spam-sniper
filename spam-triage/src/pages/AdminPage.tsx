import { useState } from "react";
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
import { Input } from "../components/Input.tsx";
import { StatusBadge } from "../components/StatusBadge.tsx";

export default function AdminPage() {
  const [password, setPassword] = useState("");
  const [authenticated, setAuthenticated] = useState(false);
  const [summary, setSummary] = useState<AdminSummary | null>(null);
  const [requests, setRequests] = useState<AdminRemovalRequest[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [exportData, setExportData] = useState<AdminExportEntry[] | null>(null);
  const [exportLoading, setExportLoading] = useState(false);
  const [exportError, setExportError] = useState("");
  const [copySuccess, setCopySuccess] = useState(false);

  const fetchData = async (pwd: string) => {
    setLoading(true);
    setError("");
    try {
      const [sumRes, reqRes] = await Promise.all([
        getAdminSummary(pwd),
        getAdminRemovalRequests(pwd),
      ]);
      setSummary(sumRes);
      setRequests(Array.isArray(reqRes.requests) ? reqRes.requests : []);
      setAuthenticated(true);
    } catch (e) {
      setError(String(e));
      setSummary(null);
      setRequests([]);
      setAuthenticated(false);
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    await fetchData(password);
  };

  const handleResolve = async (
    id: number,
    action: "approve_removal" | "reject_removal" | "mark_disputed",
  ) => {
    try {
      await resolveAdminRemovalRequest(id, { action }, password);
      await fetchData(password);
    } catch (e) {
      setError(String(e));
    }
  };

  const handleExport = async () => {
    setExportLoading(true);
    setExportError("");
    setCopySuccess(false);
    try {
      const res = await getAdminExport(password);
      setExportData(res.entries);
    } catch (e) {
      setExportError(String(e));
    } finally {
      setExportLoading(false);
    }
  };

  const buildExportJson = () => {
    if (!exportData) return "";
    return JSON.stringify(
      {
        version: 1,
        generated_at: new Date().toISOString(),
        source: "SpamSniper Verified Spam Export",
        notes: [
          "Auto-generated export of all verified_spam entries from spam-triage.",
          "phone_number_e164 values use stored E.164 numbers.",
          "display_mask values are included for safe admin UI display.",
        ],
        total_entries: exportData.length,
        entries: exportData,
      },
      null,
      2,
    );
  };

  const handleCopyExport = async () => {
    const json = buildExportJson();
    if (!json) return;
    try {
      await navigator.clipboard.writeText(json);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    } catch {
      setExportError("Failed to copy to clipboard");
    }
  };

  const handleDownloadExport = () => {
    const json = buildExportJson();
    if (!json) return;
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `verified-spam-export-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (!authenticated) {
    return (
      <div className="page-stack max-w-2xl">
        <section className="page-hero">
          <p className="page-eyebrow">Review Queue</p>
          <h1 className="page-title">Review access.</h1>
          <p className="page-lede">
            Enter review password to open pending and contested removal cases.
          </p>
        </section>
        <Card>
          <CardBody className="space-y-4">
            <form onSubmit={handleLogin} className="space-y-4">
              <Input
                label="Password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter review password"
              />
              <Button type="submit" loading={loading}>
                Unlock
              </Button>
            </form>
            {error && <p className="text-red-600">{error}</p>}
          </CardBody>
        </Card>
      </div>
    );
  }

  return (
    <div className="page-stack">
      <section className="page-hero">
        <p className="page-eyebrow">Review Queue</p>
        <h1 className="page-title">Admin dashboard.</h1>
        <p className="page-lede">
          Moderation summary plus contested or open removals waiting for manual
          resolution.
        </p>
      </section>

      {summary && (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Card>
            <CardBody>
              <p className="text-sm text-slate-500">Total Numbers</p>
              <p className="text-3xl font-semibold tracking-[-0.05em] text-slate-950">
                {summary.totalNumbers}
              </p>
            </CardBody>
          </Card>
          <Card>
            <CardBody>
              <p className="text-sm text-slate-500">Pending</p>
              <p className="text-3xl font-semibold tracking-[-0.05em] text-slate-950">
                {summary.pending}
              </p>
            </CardBody>
          </Card>
          <Card>
            <CardBody>
              <p className="text-sm text-slate-500">Suspected</p>
              <p className="text-3xl font-semibold tracking-[-0.05em] text-slate-950">
                {summary.suspected}
              </p>
            </CardBody>
          </Card>
          <Card>
            <CardBody>
              <p className="text-sm text-slate-500">Verified Spam</p>
              <p className="text-3xl font-semibold tracking-[-0.05em] text-slate-950">
                {summary.verifiedSpam}
              </p>
            </CardBody>
          </Card>
          <Card>
            <CardBody>
              <p className="text-sm text-slate-500">Under Review</p>
              <p className="text-3xl font-semibold tracking-[-0.05em] text-slate-950">
                {summary.underRemovalReview}
              </p>
            </CardBody>
          </Card>
          <Card>
            <CardBody>
              <p className="text-sm text-slate-500">Disputed</p>
              <p className="text-3xl font-semibold tracking-[-0.05em] text-slate-950">
                {summary.disputed}
              </p>
            </CardBody>
          </Card>
          <Card>
            <CardBody>
              <p className="text-sm text-slate-500">Removed</p>
              <p className="text-3xl font-semibold tracking-[-0.05em] text-slate-950">
                {summary.removed}
              </p>
            </CardBody>
          </Card>
          <Card>
            <CardBody>
              <p className="text-sm text-slate-500">Open Requests</p>
              <p className="text-3xl font-semibold tracking-[-0.05em] text-slate-950">
                {summary.openRemovalRequests}
              </p>
            </CardBody>
          </Card>
        </div>
      )}

      <Card className="max-w-5xl">
        <CardBody className="space-y-4">
          <div className="space-y-2">
            <p className="page-eyebrow">Export</p>
            <h2 className="text-2xl font-semibold tracking-[-0.04em] text-slate-950">
              Verified spam export.
            </h2>
            <p className="text-slate-600">
              Export all verified spam entries as JSON, matching the
              community-core blocklist format.
            </p>
            <p className="text-sm text-slate-500">
              Preview below stays masked. Copied and downloaded JSON includes
              full E.164 values.
            </p>
          </div>
          {exportError && <p className="text-red-600">{exportError}</p>}
          <div className="flex flex-wrap gap-2">
            <Button
              loading={exportLoading}
              onClick={handleExport}
            >
              {exportData ? "Refresh" : "Load export data"}
            </Button>
            {exportData && (
              <>
                <Button
                  variant="secondary"
                  onClick={handleCopyExport}
                >
                  {copySuccess ? "Copied!" : "Copy JSON"}
                </Button>
                <Button
                  variant="secondary"
                  onClick={handleDownloadExport}
                >
                  Download .json
                </Button>
                <p className="self-center text-sm text-slate-500">
                  {exportData.length} entries
                </p>
              </>
            )}
          </div>
          {exportData && (
            <div className="max-h-96 space-y-2 overflow-auto rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
              {exportData.map((entry) => (
                <div
                  key={`${entry.phone_number_e164}-${entry.category}`}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-slate-200 bg-white px-3 py-2"
                >
                  <div>
                    <p className="font-medium text-slate-950">
                      {entry.display_mask}
                    </p>
                    <p className="text-xs text-slate-500">
                      {entry.category} · {entry.confidence} confidence
                    </p>
                  </div>
                  <p className="text-xs text-slate-500">
                    {entry.unique_reporter_count} unique reporters
                  </p>
                </div>
              ))}
            </div>
          )}
        </CardBody>
      </Card>

      <Card className="max-w-5xl">
        <CardBody className="space-y-4">
          <div className="space-y-2">
            <p className="page-eyebrow">Manual Actions</p>
            <h2 className="text-2xl font-semibold tracking-[-0.04em] text-slate-950">
              Open and contested removals.
            </h2>
          </div>
          {error && <p className="text-red-600">{error}</p>}
          {requests.length === 0 ? (
            <p className="text-slate-600">No open or contested requests.</p>
          ) : (
            <div className="space-y-3">
              {requests.map((req) => (
                <Card key={req.id}>
                  <CardBody>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold text-slate-950">
                        {req.display_mask}
                      </span>
                      <StatusBadge status={req.status} />
                    </div>
                    <p className="mt-2 text-sm text-slate-600">
                      Reason: {req.reason} · Contests: {req.contest_count} ·
                      Deadline:{" "}
                      {new Date(req.contest_deadline).toLocaleDateString()}
                    </p>
                    <div className="mt-4 flex flex-wrap gap-2">
                      <Button
                        variant="secondary"
                        onClick={() => handleResolve(req.id, "approve_removal")}
                      >
                        Approve
                      </Button>
                      <Button
                        variant="secondary"
                        onClick={() => handleResolve(req.id, "reject_removal")}
                      >
                        Reject
                      </Button>
                      <Button
                        variant="secondary"
                        onClick={() => handleResolve(req.id, "mark_disputed")}
                      >
                        Mark disputed
                      </Button>
                    </div>
                  </CardBody>
                </Card>
              ))}
            </div>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
