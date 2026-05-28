import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { useParams } from "react-router-dom";
import { z } from "zod";
import { contestRemovalRequest, getRemovalRequest } from "../api/removal.ts";
import { Button } from "../components/Button.tsx";
import { Card, CardBody } from "../components/Card.tsx";
import { Select } from "../components/Select.tsx";
import { StatusBadge } from "../components/StatusBadge.tsx";
import { TurnstileWidget } from "../components/TurnstileWidget.tsx";

const contestReasons = [
  { value: "still_spam", label: "Still Spam" },
  { value: "recent_spam_call", label: "Recent Spam Call" },
  { value: "known_scam_number", label: "Known Scam Number" },
  { value: "other", label: "Other" },
];

const schema = z.object({
  reason: z.string().min(1, "Reason is required"),
  turnstileToken: z.string().min(1, "Please complete the Turnstile challenge"),
});

type FormData = z.infer<typeof schema>;

async function fetchRemovalDetail(removalId: number) {
  return getRemovalRequest(removalId);
}

export default function RemovalDetailPage() {
  const { id } = useParams<{ id: string }>();
  const removalId = Number(id);

  const [detail, setDetail] = useState<{
    maskedNumber: string;
    reason: string;
    status: string;
    contestDeadline: string;
    contestCount: number;
    contestWindowOpen: boolean;
  } | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [detailError, setDetailError] = useState("");

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
    reset,
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { reason: "still_spam" },
  });

  const [contestResult, setContestResult] = useState<{
    success: boolean;
    contestCount?: number;
    status?: string;
  } | null>(null);
  const [contestLoading, setContestLoading] = useState(false);
  const [contestError, setContestError] = useState("");

  const loadDetail = async (nextRemovalId: number) => {
    if (!Number.isFinite(nextRemovalId)) {
      setDetail(null);
      return;
    }

    setLoadingDetail(true);
    setDetailError("");

    try {
      const res = await fetchRemovalDetail(nextRemovalId);
      setDetail({
        maskedNumber: res.maskedNumber,
        reason: res.reason,
        status: res.status,
        contestDeadline: res.contestDeadline,
        contestCount: res.contestCount,
        contestWindowOpen: res.contestWindowOpen,
      });
    } catch (e) {
      setDetailError(String(e));
    } finally {
      setLoadingDetail(false);
    }
  };

  useEffect(() => {
    if (!Number.isFinite(removalId)) {
      setDetail(null);
      return;
    }

    let cancelled = false;

    const run = async () => {
      setLoadingDetail(true);
      setDetailError("");

      try {
        const res = await fetchRemovalDetail(removalId);

        if (cancelled) {
          return;
        }

        setDetail({
          maskedNumber: res.maskedNumber,
          reason: res.reason,
          status: res.status,
          contestDeadline: res.contestDeadline,
          contestCount: res.contestCount,
          contestWindowOpen: res.contestWindowOpen,
        });
      } catch (e) {
        if (!cancelled) {
          setDetailError(String(e));
        }
      } finally {
        if (!cancelled) {
          setLoadingDetail(false);
        }
      }
    };

    void run();

    return () => {
      cancelled = true;
    };
  }, [removalId]);

  const onSubmit = async (data: FormData) => {
    if (!Number.isFinite(removalId)) return;
    setContestLoading(true);
    setContestError("");
    setContestResult(null);
    try {
      const res = await contestRemovalRequest(removalId, {
        reason: data.reason,
        turnstileToken: data.turnstileToken,
      });
      setContestResult({
        success: true,
        contestCount: res.contestCount,
        status: res.status,
      });
      reset();
      await loadDetail(removalId);
    } catch (e) {
      setContestError(String(e));
    } finally {
      setContestLoading(false);
      setValue("turnstileToken", "");
    }
  };

  if (loadingDetail) {
    return <p className="text-slate-600">Loading...</p>;
  }

  if (detailError) {
    return <p className="text-red-600">{detailError}</p>;
  }

  if (!detail) {
    return <p className="text-slate-600">No removal request found.</p>;
  }

  return (
    <div className="page-stack">
      <section className="page-hero">
        <p className="page-eyebrow">Removal Status</p>
        <h1 className="page-title">Track contest window.</h1>
        <p className="page-lede">
          Follow removal progress, dispute open request, or verify deadline and
          current count.
        </p>
      </section>

      <Card className="max-w-2xl">
        <CardBody className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-lg font-semibold text-slate-950">
              {detail.maskedNumber}
            </span>
            <StatusBadge status={detail.status} />
          </div>
          <p className="text-sm text-slate-600">Reason: {detail.reason}</p>
          <p className="text-sm text-slate-600">
            Contest deadline:{" "}
            {new Date(detail.contestDeadline).toLocaleDateString()}
          </p>
          <p className="text-sm text-slate-600">
            Contests: {detail.contestCount}
          </p>
          <p className="text-sm text-slate-600">
            Window open: {detail.contestWindowOpen ? "Yes" : "No"}
          </p>
        </CardBody>
      </Card>

      {detail.status === "open" && detail.contestWindowOpen && (
        <Card className="max-w-2xl">
          <CardBody className="space-y-4">
            <div className="space-y-2">
              <p className="page-eyebrow">Contest</p>
              <h2 className="text-2xl font-semibold tracking-[-0.04em] text-slate-950">
                Challenge this removal.
              </h2>
            </div>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <Select
                label="Reason"
                options={contestReasons}
                {...register("reason")}
                error={errors.reason?.message}
              />
              <div className="space-y-2">
                <TurnstileWidget
                  onVerify={(token) => setValue("turnstileToken", token)}
                  onError={() => setValue("turnstileToken", "")}
                />
                {errors.turnstileToken && (
                  <p className="text-sm text-red-600">
                    {errors.turnstileToken.message}
                  </p>
                )}
              </div>
              <Button type="submit" loading={contestLoading}>
                Submit contest
              </Button>
            </form>
            {contestError && <p className="text-red-600">{contestError}</p>}
            {contestResult && (
              <Card>
                <CardBody className="space-y-1">
                  <p className="font-semibold text-slate-950">
                    Contest submitted.
                  </p>
                  <p className="text-sm text-slate-600">
                    Contests: {contestResult.contestCount} · Status:{" "}
                    {contestResult.status}
                  </p>
                </CardBody>
              </Card>
            )}
          </CardBody>
        </Card>
      )}
    </div>
  );
}
