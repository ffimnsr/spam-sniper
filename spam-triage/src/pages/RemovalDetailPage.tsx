import { zodResolver } from "@hookform/resolvers/zod";
import { useCallback, useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { Link, useParams } from "react-router-dom";
import { z } from "zod";
import { contestRemovalRequest, getRemovalRequest } from "../api/removal.ts";
import { Button } from "../components/Button.tsx";
import { Card, CardBody } from "../components/Card.tsx";
import { CyberAlert } from "../components/CyberAlert.tsx";
import { GlitchText } from "../components/GlitchText.tsx";
import { Select } from "../components/Select.tsx";
import { StatusBadge } from "../components/StatusBadge.tsx";
import { TurnstileWidget } from "../components/TurnstileWidget.tsx";
import { soundFx } from "../lib/sound-fx.ts";

const contestReasons = [
  {
    value: "still_spam",
    label: "Still Spam - Number continues transmitting spam",
  },
  {
    value: "recent_spam_call",
    label: "Recent Spam Call - Received malicious call recently",
  },
  {
    value: "known_scam_number",
    label: "Known Scam Number - Verified malicious syndicate",
  },
  { value: "other", label: "Other - Additional evidence available" },
];

const schema = z.object({
  reason: z.string().min(1, "Contest reason is required"),
  turnstileToken: z.string().min(1, "Turnstile verification required"),
});

type FormData = z.infer<typeof schema>;

export default function RemovalDetailPage() {
  const { id } = useParams<{ id: string }>();
  const removalId = Number(id);

  const [resetKey, setResetKey] = useState(0);

  const [detail, setDetail] = useState<{
    maskedNumber: string;
    reason: string;
    status: string;
    contestDeadline: string;
    contestCount: number;
    contestWindowOpen: boolean;
  } | null>(null);

  const [loadingDetail, setLoadingDetail] = useState(false);
  const [detailError, setDetailError] = useState<unknown>(null);

  const {
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
    reset,
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { reason: "still_spam", turnstileToken: "" },
  });

  const [contestResult, setContestResult] = useState<{
    success: boolean;
    contestCount?: number;
    status?: string;
  } | null>(null);

  const [contestLoading, setContestLoading] = useState(false);
  const [contestError, setContestError] = useState<unknown>(null);

  const selectedReason = watch("reason");

  const loadDetail = useCallback(async (targetId: number) => {
    if (!Number.isFinite(targetId)) {
      setDetail(null);
      return;
    }

    setLoadingDetail(true);
    setDetailError(null);

    try {
      const res = await getRemovalRequest(targetId);
      setDetail({
        maskedNumber: res.maskedNumber,
        reason: res.reason,
        status: res.status,
        contestDeadline: res.contestDeadline,
        contestCount: res.contestCount,
        contestWindowOpen: res.contestWindowOpen,
      });
    } catch (e) {
      setDetailError(e);
    } finally {
      setLoadingDetail(false);
    }
  }, []);

  useEffect(() => {
    if (!Number.isFinite(removalId)) {
      setDetail(null);
      return;
    }

    void loadDetail(removalId);
  }, [removalId, loadDetail]);

  const onSubmit = async (data: FormData) => {
    if (!Number.isFinite(removalId)) return;
    soundFx.scan();
    setContestLoading(true);
    setContestError(null);
    setContestResult(null);

    try {
      const res = await contestRemovalRequest(removalId, {
        reason: data.reason,
        turnstileToken: data.turnstileToken,
      });

      soundFx.success();
      setContestResult({
        success: true,
        contestCount: res.contestCount,
        status: res.status,
      });

      reset({ reason: "still_spam", turnstileToken: "" });
      await loadDetail(removalId);
    } catch (e) {
      soundFx.error();
      setContestError(e);
    } finally {
      setContestLoading(false);
      setValue("turnstileToken", "");
      setResetKey((prev) => prev + 1);
    }
  };

  return (
    <div className="page-stack">
      {/* Page Hero */}
      <section className="page-hero">
        <div className="flex items-center justify-between">
          <p className="page-eyebrow">CASE AUDIT // REMOVAL TELEMETRY</p>
          <span className="font-mono text-xs text-cyan-400 bg-cyan-950/40 border border-cyan-500/30 px-2 py-0.5 rounded-xs">
            CASE_ID: #{removalId}
          </span>
        </div>
        <h1 className="page-title">
          <GlitchText text="TRACK CONTEST WINDOW." as="span" />
        </h1>
        <p className="page-lede">
          Audit the removal status of this number. If this caller is actively
          harassing or scamming users, register a counter-contest during the
          7-day challenge window.
        </p>
      </section>

      {loadingDetail && (
        <Card className="max-w-2xl">
          <CardBody>
            <p className="font-mono text-sm text-cyan-400 animate-pulse">
              [SYSTEM_POLLING] Querying removal ledger...
            </p>
          </CardBody>
        </Card>
      )}

      {Boolean(detailError) && (
        <div className="max-w-2xl">
          <CyberAlert error={detailError} />
        </div>
      )}

      {!loadingDetail && !detailError && !detail && (
        <Card className="max-w-2xl">
          <CardBody className="space-y-3 font-mono text-sm">
            <p className="text-slate-400">
              [NOT_FOUND] No active removal docket registered for ID #
              {removalId}.
            </p>
            <Link to="/remove">
              <Button variant="secondary" className="text-xs !py-2">
                Return to Delist Terminal
              </Button>
            </Link>
          </CardBody>
        </Card>
      )}

      {/* Detail HUD Display */}
      {detail && (
        <Card className="max-w-2xl border-cyan-500/40 shadow-[0_0_30px_rgba(0,240,255,0.1)]">
          <CardBody className="space-y-4">
            <div className="flex items-center justify-between border-b border-cyan-500/20 pb-3">
              <span className="font-mono text-xs uppercase tracking-wider text-cyan-400">
                // TARGET_DISPOSITION_REPORT
              </span>
              <StatusBadge status={detail.status} />
            </div>

            <div className="rounded-sm border border-cyan-500/30 bg-[#060a16] p-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <span className="font-mono text-xs text-slate-400 block mb-1">
                  TARGET SIGNATURE
                </span>
                <span className="font-mono text-2xl font-bold tracking-wider text-white">
                  <GlitchText
                    text={detail.maskedNumber}
                    as="span"
                    scrambleOnHover={false}
                  />
                </span>
              </div>
              <div className="text-right font-mono text-xs">
                <span className="text-slate-400 block">ACTIVE CONTESTS</span>
                <span className="text-xl font-bold text-amber-400">
                  {detail.contestCount}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 font-mono text-xs">
              <div className="rounded-sm border border-cyan-500/20 bg-[#060c18] p-3 space-y-1">
                <span className="text-slate-500">SUBMISSION REASON:</span>
                <p className="font-bold text-slate-200">{detail.reason}</p>
              </div>

              <div className="rounded-sm border border-cyan-500/20 bg-[#060c18] p-3 space-y-1">
                <span className="text-slate-500">CHALLENGE DEADLINE:</span>
                <p className="font-bold text-slate-200">
                  {new Date(detail.contestDeadline).toLocaleDateString()}
                </p>
              </div>
            </div>

            <div className="rounded-sm border border-cyan-500/20 bg-[#070e1c] p-3 font-mono text-xs flex items-center justify-between">
              <span className="text-slate-400">CHALLENGE WINDOW STATUS:</span>
              <span
                className={`font-bold ${
                  detail.contestWindowOpen ? "text-[#00ff9d]" : "text-slate-500"
                }`}
              >
                {detail.contestWindowOpen
                  ? "[OPEN // ACCEPTING COUNTER-SIGNALS]"
                  : "[WINDOW CLOSED // FINAL DISPOSITION]"}
              </span>
            </div>
          </CardBody>
        </Card>
      )}

      {/* Challenge / Contest Form */}
      {detail && detail.status === "open" && detail.contestWindowOpen && (
        <Card className="max-w-2xl border-amber-500/50 shadow-[0_0_30px_rgba(245,158,11,0.15)]">
          <CardBody className="space-y-4">
            <div className="space-y-1 border-b border-cyan-500/20 pb-3">
              <p className="page-eyebrow">COUNTER-INTEL // DISPUTE REMOVAL</p>
              <h2 className="text-xl font-bold font-orbitron text-white">
                CHALLENGE THIS REMOVAL REQUEST.
              </h2>
              <p className="font-mono text-xs text-slate-400">
                If this number is still spamming, transmit an active contest.
                Challenged requests freeze auto-removal and route to operator
                review.
              </p>
            </div>

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <Select
                label="Dispute Justification"
                options={contestReasons}
                value={selectedReason}
                onChange={(e) => setValue("reason", e.target.value)}
                error={errors.reason?.message}
              />

              <div className="space-y-2">
                <TurnstileWidget
                  resetKey={resetKey}
                  onVerify={(token) => setValue("turnstileToken", token)}
                  onError={() => setValue("turnstileToken", "")}
                />
                {errors.turnstileToken && (
                  <p className="font-mono text-xs text-[#ff3377]">
                    <span>[ERR]</span> {errors.turnstileToken.message}
                  </p>
                )}
              </div>

              <Button
                type="submit"
                variant="danger"
                loading={contestLoading}
                className="w-full sm:w-auto"
              >
                Transmit Contest Challenge
              </Button>
            </form>

            {Boolean(contestError) && (
              <CyberAlert
                error={contestError}
                onDismiss={() => setContestError(null)}
              />
            )}

            {contestResult && (
              <div className="rounded-sm border border-[#00ff9d]/50 bg-[#042014]/90 p-4 font-mono text-xs text-emerald-200">
                <p className="font-bold text-[#00ff9d] flex items-center gap-2">
                  <span>✓</span> CONTEST CHALLENGE COMMITTED.
                </p>
                <p className="mt-1 text-slate-300">
                  Total Counter-Claims:{" "}
                  <span className="font-bold text-white">
                    {contestResult.contestCount}
                  </span>{" "}
                  · Updated Docket Status:{" "}
                  <span className="font-bold text-white">
                    {contestResult.status}
                  </span>
                </p>
              </div>
            )}
          </CardBody>
        </Card>
      )}
    </div>
  );
}
