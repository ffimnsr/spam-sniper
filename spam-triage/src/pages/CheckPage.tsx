import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { Link } from "react-router-dom";
import { z } from "zod";
import { checkNumber } from "../api/numbers.ts";
import { Button } from "../components/Button.tsx";
import { Card, CardBody } from "../components/Card.tsx";
import { CyberAlert } from "../components/CyberAlert.tsx";
import { GlitchText } from "../components/GlitchText.tsx";
import { PhoneInput } from "../components/PhoneInput.tsx";
import { StatusBadge } from "../components/StatusBadge.tsx";
import { ThreatMeter } from "../components/ThreatMeter.tsx";
import { TurnstileWidget } from "../components/TurnstileWidget.tsx";
import { soundFx } from "../lib/sound-fx.ts";

const schema = z.object({
  phoneNumber: z.string().min(1, "Target phone number is required"),
  country: z.string().optional(),
  turnstileToken: z.string().min(1, "Turnstile verification required"),
});

type FormData = z.infer<typeof schema>;

export default function CheckPage() {
  const [resetKey, setResetKey] = useState(0);
  const [copied, setCopied] = useState(false);

  const {
    control,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { phoneNumber: "", country: "PH", turnstileToken: "" },
  });

  const [result, setResult] = useState<{
    found: boolean;
    maskedNumber?: string;
    status?: string;
    reportCount?: number;
    uniqueReporterCount?: number;
    recentUniqueReporterCount?: number;
    removalStatus?: string;
    contestDeadline?: string;
    contestWindowOpen?: boolean;
  } | null>(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<unknown>(null);

  const currentCountry = watch("country") || "PH";

  const onSubmit = async (data: FormData) => {
    soundFx.scan();
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const res = await checkNumber({
        phoneNumber: data.phoneNumber,
        country: data.country,
        turnstileToken: data.turnstileToken,
      });

      if (res.found) {
        soundFx.success();
        setResult({
          found: true,
          maskedNumber: res.maskedNumber,
          status: res.status,
          reportCount: res.reportCount,
          uniqueReporterCount: res.uniqueReporterCount,
          recentUniqueReporterCount: res.recentUniqueReporterCount,
          removalStatus: res.removalStatus,
          contestDeadline: res.contestDeadline,
          contestWindowOpen: res.contestWindowOpen,
        });
      } else {
        soundFx.glitch();
        setResult({ found: false });
      }
    } catch (e) {
      soundFx.error();
      setError(e);
    } finally {
      setValue("turnstileToken", "");
      setResetKey((prev) => prev + 1);
      setLoading(false);
    }
  };

  const handleCopy = (text: string) => {
    soundFx.click();
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="page-stack">
      {/* Page Hero */}
      <section className="page-hero">
        <div className="flex items-center justify-between">
          <p className="page-eyebrow">TELEMETRY SCAN // TARGET LOOKUP</p>
          <span className="font-mono text-xs text-cyan-400 bg-cyan-950/40 border border-cyan-500/30 px-2 py-0.5 rounded-xs">
            QUERY_ENGINE: ONLINE
          </span>
        </div>
        <h1 className="page-title">
          <GlitchText text="CHECK NUMBER SIGNAL." as="span" />
        </h1>
        <p className="page-lede">
          Analyze cryptographic caller signatures. View threat status, reporter
          velocity, and active removal contest windows prior to engaging.
        </p>
      </section>

      {/* Query Terminal Form */}
      <Card className="max-w-2xl">
        <CardBody className="space-y-5">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <Controller
              name="phoneNumber"
              control={control}
              render={({ field }) => (
                <PhoneInput
                  value={field.value}
                  country={currentCountry}
                  onChange={field.onChange}
                  onCountryChange={(code) => setValue("country", code)}
                  label="Target Caller Number"
                  placeholder="+63 917 123 4567"
                  error={errors.phoneNumber?.message}
                  disabled={loading}
                />
              )}
            />

            <div className="space-y-2">
              <TurnstileWidget
                resetKey={resetKey}
                action="check"
                onVerify={(token) => setValue("turnstileToken", token)}
                onError={() => setValue("turnstileToken", "")}
              />
              {errors.turnstileToken && (
                <p className="font-mono text-xs text-[var(--cp-pink)]">
                  <span>[ERR]</span> {errors.turnstileToken.message}
                </p>
              )}
            </div>

            <Button
              type="submit"
              loading={loading}
              className="w-full sm:w-auto"
            >
              Scan Target Signature
            </Button>
          </form>

          {Boolean(error) && (
            <CyberAlert error={error} onDismiss={() => setError(null)} />
          )}
        </CardBody>
      </Card>

      {/* Query Result Card */}
      {result && (
        <Card className="max-w-2xl border-cyan-400/50 shadow-[0_0_30px_rgba(0,240,255,0.12)]">
          <CardBody className="space-y-4">
            <div className="flex items-center justify-between border-b border-cyan-500/20 pb-3">
              <span className="font-mono text-xs uppercase tracking-wider text-cyan-400">
                // SCAN_RESULTS_TELEMETRY
              </span>
              <span className="font-mono text-[10px] text-slate-500">
                MATCH: {result.found ? "CONFIRMED" : "ZERO_ENTRIES"}
              </span>
            </div>

            {result.found ? (
              <div className="space-y-4">
                {/* Masked caller display and badge */}
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-sm border border-cyan-500/30 bg-[var(--cp-bg)] p-4">
                  <div>
                    <span className="font-mono text-xs text-slate-400 block mb-1">
                      MASKED TARGET SIGNATURE
                    </span>
                    <span className="font-mono text-xl font-bold tracking-wider text-white">
                      <GlitchText
                        text={result.maskedNumber || ""}
                        as="span"
                        scrambleOnHover={false}
                        autoGlitch={false}
                      />
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    {result.status && <StatusBadge status={result.status} />}
                    {result.maskedNumber && (
                      <button
                        type="button"
                        onClick={() => {
                          const mask = result.maskedNumber;
                          if (mask) handleCopy(mask);
                        }}
                        className="rounded-xs border border-cyan-500/40 bg-cyan-950/30 px-2.5 py-1 font-mono text-xs text-cyan-300 hover:border-cyan-300 hover:text-white transition-all cursor-pointer"
                      >
                        {copied ? "COPIED" : "COPY"}
                      </button>
                    )}
                  </div>
                </div>

                {/* Threat Meter */}
                <ThreatMeter
                  found={true}
                  status={result.status}
                  reportCount={result.reportCount}
                  uniqueReporterCount={result.uniqueReporterCount}
                  recentUniqueReporterCount={result.recentUniqueReporterCount}
                />

                {/* Removal contest notice if applicable */}
                {result.removalStatus && (
                  <div className="rounded-sm border border-amber-500/30 bg-amber-950/20 p-3 font-mono text-xs text-amber-200">
                    <p className="font-bold flex items-center gap-1.5 text-amber-300">
                      <span>⚠</span> REMOVAL CONTEST STATUS:{" "}
                      {result.removalStatus.toUpperCase()}
                    </p>
                    {result.contestDeadline && (
                      <p className="mt-1 text-slate-400">
                        Public Challenge Deadline:{" "}
                        <span className="text-white">
                          {new Date(
                            result.contestDeadline,
                          ).toLocaleDateString()}
                        </span>
                      </p>
                    )}
                  </div>
                )}

                {/* Action Shortcuts */}
                <div className="flex flex-wrap gap-3 pt-2">
                  <Link to="/report">
                    <Button variant="danger" className="text-xs !py-2.5">
                      Broadcast Threat Report
                    </Button>
                  </Link>
                  <Link to="/remove">
                    <Button variant="secondary" className="text-xs !py-2.5">
                      Request Delist / Removal
                    </Button>
                  </Link>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <ThreatMeter found={false} />
                <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                  <p className="font-mono text-xs text-slate-400">
                    Target not currently logged. If this caller attempted spam,
                    transmit a report.
                  </p>
                  <Link to="/report">
                    <Button variant="primary" className="text-xs !py-2">
                      Report This Caller
                    </Button>
                  </Link>
                </div>
              </div>
            )}
          </CardBody>
        </Card>
      )}
    </div>
  );
}
