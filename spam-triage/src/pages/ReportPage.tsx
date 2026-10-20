import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { Link } from "react-router-dom";
import { z } from "zod";
import { submitReport } from "../api/numbers.ts";
import { Button } from "../components/Button.tsx";
import { Card, CardBody } from "../components/Card.tsx";
import { CyberAlert } from "../components/CyberAlert.tsx";
import { GlitchText } from "../components/GlitchText.tsx";
import { PhoneInput } from "../components/PhoneInput.tsx";
import { StatusBadge } from "../components/StatusBadge.tsx";
import { ThreatMeter } from "../components/ThreatMeter.tsx";
import { TurnstileWidget } from "../components/TurnstileWidget.tsx";
import { soundFx } from "../lib/sound-fx.ts";

const categories = [
  { value: "scam", label: "Scam", desc: "General fraudulent activity" },
  {
    value: "phishing",
    label: "Phishing",
    desc: "Fake portals & credential theft",
  },
  {
    value: "loan_spam",
    label: "Loan Spam",
    desc: "Predatory credit solicitations",
  },
  { value: "robocall", label: "Robocall", desc: "Automated voice recordings" },
  {
    value: "impersonation",
    label: "Impersonation",
    desc: "Posing as govt or brand",
  },
  {
    value: "delivery_scam",
    label: "Delivery Scam",
    desc: "Fake courier & package fees",
  },
  { value: "bank_scam", label: "Bank Scam", desc: "OTP & account compromise" },
  {
    value: "unknown",
    label: "Unknown / Suspicious",
    desc: "Unidentified hostile call",
  },
];

const schema = z.object({
  phoneNumber: z.string().min(1, "Target phone number is required"),
  country: z.string().optional(),
  category: z.string().min(1, "Threat category is required"),
  turnstileToken: z.string().min(1, "Turnstile verification required"),
});

type FormData = z.infer<typeof schema>;

export default function ReportPage() {
  const [resetKey, setResetKey] = useState(0);

  const {
    control,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
    reset,
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      phoneNumber: "",
      country: "PH",
      category: "scam",
      turnstileToken: "",
    },
  });

  const [result, setResult] = useState<{
    success: boolean;
    duplicate?: boolean;
    maskedNumber?: string;
    status?: string;
    reportCount?: number;
    uniqueReporterCount?: number;
  } | null>(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<unknown>(null);

  const currentCountry = watch("country") || "PH";
  const selectedCategory = watch("category");

  const onSubmit = async (data: FormData) => {
    soundFx.scan();
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const res = await submitReport({
        phoneNumber: data.phoneNumber,
        country: data.country,
        category: data.category,
        turnstileToken: data.turnstileToken,
      });

      if (res.duplicate) {
        soundFx.glitch();
      } else {
        soundFx.success();
      }

      setResult({
        success: true,
        duplicate: res.duplicate,
        maskedNumber: res.maskedNumber,
        status: res.status,
        reportCount: res.reportCount,
        uniqueReporterCount: res.uniqueReporterCount,
      });

      reset({
        phoneNumber: "",
        country: currentCountry,
        category: "scam",
        turnstileToken: "",
      });
    } catch (e) {
      soundFx.error();
      setError(e);
    } finally {
      setValue("turnstileToken", "");
      setResetKey((prev) => prev + 1);
      setLoading(false);
    }
  };

  return (
    <div className="page-stack">
      {/* Page Hero */}
      <section className="page-hero">
        <div className="flex items-center justify-between">
          <p className="page-eyebrow">
            BROADCAST SIGNAL // INCIDENT TRANSMISSION
          </p>
          <span className="font-mono text-xs text-[#ff0055] bg-pink-950/40 border border-[#ff0055]/30 px-2 py-0.5 rounded-xs">
            THREAT_INTAKE: READY
          </span>
        </div>
        <h1 className="page-title">
          <GlitchText text="REPORT SPAM CALLER." as="span" />
        </h1>
        <p className="page-lede">
          Transmit categorized threat signatures to the community shield. Each
          unique reporting node elevates system confidence to protect downstream
          peers.
        </p>
      </section>

      {/* Report Form */}
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
                  label="Target Phone Number"
                  placeholder="+63 917 123 4567"
                  error={errors.phoneNumber?.message}
                  disabled={loading}
                />
              )}
            />

            {/* Cyber Threat Category Selector */}
            <div className="space-y-2">
              <label className="flex items-center gap-1.5 font-rajdhani text-xs font-bold uppercase tracking-wider text-cyan-400">
                <span className="text-[#ff0055]">//</span> THREAT CLASSIFICATION
              </label>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {categories.map((cat) => {
                  const isSelected = selectedCategory === cat.value;
                  return (
                    <button
                      type="button"
                      key={cat.value}
                      onClick={() => {
                        soundFx.click();
                        setValue("category", cat.value);
                      }}
                      onMouseEnter={() => soundFx.hover()}
                      className={`text-left p-3 rounded-sm border transition-all font-mono text-xs cursor-pointer ${
                        isSelected
                          ? "border-[#ff0055] bg-[#ff0055]/15 text-white shadow-[0_0_15px_rgba(255,0,85,0.3)]"
                          : "border-cyan-500/20 bg-[#060a16] text-slate-300 hover:border-cyan-400/50 hover:bg-[#080e22]"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold tracking-wide">
                          {cat.label}
                        </span>
                        {isSelected && (
                          <span className="h-1.5 w-1.5 rounded-full bg-[#ff0055] shadow-[0_0_6px_#ff0055]" />
                        )}
                      </div>
                      <p className="text-[11px] text-slate-400 mt-1 line-clamp-1">
                        {cat.desc}
                      </p>
                    </button>
                  );
                })}
              </div>
              {errors.category && (
                <p className="font-mono text-xs text-[#ff3377]">
                  <span>[ERR]</span> {errors.category.message}
                </p>
              )}
            </div>

            {/* Turnstile Widget */}
            <div className="space-y-2">
              <TurnstileWidget
                resetKey={resetKey}
                action="report"
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
              loading={loading}
              className="w-full sm:w-auto"
            >
              Broadcast Threat Signal
            </Button>
          </form>

          {Boolean(error) && (
            <CyberAlert error={error} onDismiss={() => setError(null)} />
          )}
        </CardBody>
      </Card>

      {/* Report Result Confirmation */}
      {result && (
        <Card className="max-w-2xl border-[#ff0055]/50 shadow-[0_0_30px_rgba(255,0,85,0.15)]">
          <CardBody className="space-y-4">
            <div className="flex items-center justify-between border-b border-cyan-500/20 pb-3">
              <span className="font-mono text-xs uppercase tracking-wider text-cyan-400">
                // TRANSMISSION_RECEIPT
              </span>
              <span
                className={`font-mono text-xs font-bold ${
                  result.duplicate ? "text-amber-400" : "text-[#00ff9d]"
                }`}
              >
                {result.duplicate
                  ? "[DUPLICATE_NODE_SIGNAL]"
                  : "[SIGNAL_COMMITTED]"}
              </span>
            </div>

            <div className="rounded-sm border border-cyan-500/30 bg-[#060a16] p-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <span className="font-mono text-xs text-slate-400 block mb-1">
                  TARGET SIGNATURE
                </span>
                <span className="font-mono text-xl font-bold tracking-wider text-white">
                  <GlitchText
                    text={result.maskedNumber || ""}
                    as="span"
                    scrambleOnHover={false}
                  />
                </span>
              </div>
              {result.status && <StatusBadge status={result.status} />}
            </div>

            <ThreatMeter
              found={true}
              status={result.status}
              reportCount={result.reportCount}
              uniqueReporterCount={result.uniqueReporterCount}
            />

            {result.duplicate ? (
              <p className="font-mono text-xs text-amber-300 bg-amber-950/20 border border-amber-500/30 p-3 rounded-sm">
                Node notice: You previously filed a report against this number.
                Threat score requires unique reporters to advance tiers.
              </p>
            ) : (
              <p className="font-mono text-xs text-emerald-300 bg-emerald-950/20 border border-emerald-500/30 p-3 rounded-sm">
                Success: Spam signal verified and distributed to active
                blocklist telemetry nodes.
              </p>
            )}

            <div className="flex gap-3 pt-1">
              <Link to="/check">
                <Button variant="secondary" className="text-xs !py-2">
                  Inspect in Lookup Terminal
                </Button>
              </Link>
            </div>
          </CardBody>
        </Card>
      )}
    </div>
  );
}
