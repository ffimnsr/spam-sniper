import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { Link } from "react-router-dom";
import { z } from "zod";
import { createRemovalRequest } from "../api/removal.ts";
import { Button } from "../components/Button.tsx";
import { Card, CardBody } from "../components/Card.tsx";
import { CyberAlert } from "../components/CyberAlert.tsx";
import { GlitchText } from "../components/GlitchText.tsx";
import { PhoneInput } from "../components/PhoneInput.tsx";
import { Select } from "../components/Select.tsx";
import { TurnstileWidget } from "../components/TurnstileWidget.tsx";
import { soundFx } from "../lib/sound-fx.ts";

const reasons = [
  {
    value: "personal_number",
    label: "Personal Number - Misattributed / False Positive",
  },
  { value: "incorrect_report", label: "Incorrect Report - Mistaken Identity" },
  {
    value: "recycled_number",
    label: "Recycled Number - Reassigned Telecom SIM",
  },
  {
    value: "legitimate_business",
    label: "Legitimate Business - Verified Enterprise Caller",
  },
  { value: "other", label: "Other - Unspecified Legal / Operational Dispute" },
];

const schema = z.object({
  phoneNumber: z.string().min(1, "Target phone number is required"),
  country: z.string().optional(),
  reason: z.string().min(1, "Dispute justification is required"),
  turnstileToken: z.string().min(1, "Turnstile verification required"),
});

type FormData = z.infer<typeof schema>;

export default function RemovePage() {
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
      reason: "personal_number",
      turnstileToken: "",
    },
  });

  const [result, setResult] = useState<{
    success: boolean;
    removalRequestId?: number;
    maskedNumber?: string;
    contestDeadline?: string;
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
      const res = await createRemovalRequest({
        phoneNumber: data.phoneNumber,
        country: data.country,
        reason: data.reason,
        turnstileToken: data.turnstileToken,
      });

      soundFx.success();
      setResult({
        success: true,
        removalRequestId: res.removalRequestId,
        maskedNumber: res.maskedNumber,
        contestDeadline: res.contestDeadline,
      });

      reset({
        phoneNumber: "",
        country: currentCountry,
        reason: "personal_number",
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
          <p className="page-eyebrow">DISPUTE PROTOCOL // DELIST REQUEST</p>
          <span className="font-mono text-xs text-amber-400 bg-amber-950/40 border border-amber-500/30 px-2 py-0.5 rounded-xs">
            WINDOW: 7-DAY CHALLENGE
          </span>
        </div>
        <h1 className="page-title">
          <GlitchText text="REQUEST NUMBER REMOVAL." as="span" />
        </h1>
        <p className="page-lede">
          Initiate a transparent removal challenge. Submitting opens a public
          7-day contest window. If un-challenged, the record automatically
          clears from active blocklists.
        </p>
      </section>

      {/* Protocol Notice */}
      <div className="rounded-sm border border-cyan-500/20 bg-[#060b17] p-4 font-mono text-xs text-slate-300 space-y-1">
        <p className="text-cyan-400 font-bold flex items-center gap-1.5">
          <span>ℹ</span> REMOVAL POLICY PROTOCOL
        </p>
        <p className="text-slate-400 leading-relaxed">
          Removal requests stay open for public challenge. Anyone can contest
          the removal if the number is actively spamming. Contested numbers are
          referred to manual triage review.
        </p>
      </div>

      {/* Form */}
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

            <Select
              label="Removal Justification"
              options={reasons}
              {...registerWithDefault("reason")}
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
              variant="secondary"
              loading={loading}
              className="w-full sm:w-auto"
            >
              Initiate Delist Challenge
            </Button>
          </form>

          {Boolean(error) && (
            <CyberAlert error={error} onDismiss={() => setError(null)} />
          )}
        </CardBody>
      </Card>

      {/* Success Confirmation Card */}
      {result && (
        <Card className="max-w-2xl border-amber-500/50 shadow-[0_0_30px_rgba(245,158,11,0.15)]">
          <CardBody className="space-y-4">
            <div className="flex items-center justify-between border-b border-cyan-500/20 pb-3">
              <span className="font-mono text-xs uppercase tracking-wider text-amber-400">
                // DELIST_CHALLENGE_OPENED
              </span>
              <span className="font-mono text-xs text-slate-400">
                CASE #{result.removalRequestId}
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
              <span className="font-mono text-xs text-amber-400 bg-amber-950/40 border border-amber-500/40 px-2.5 py-1 rounded-xs font-bold">
                7-DAY WINDOW ACTIVE
              </span>
            </div>

            {result.contestDeadline && (
              <p className="font-mono text-xs text-slate-300">
                Challenge Deadline:{" "}
                <span className="text-white font-bold">
                  {new Date(result.contestDeadline).toLocaleDateString()}
                </span>{" "}
                (auto-resolves if zero counter-claims submitted)
              </p>
            )}

            <div className="pt-2">
              <Link to={`/removal/${result.removalRequestId}`}>
                <Button variant="primary" className="text-xs !py-2.5">
                  Track Removal Status & Window
                </Button>
              </Link>
            </div>
          </CardBody>
        </Card>
      )}
    </div>
  );

  function registerWithDefault(field: "reason") {
    return {
      value: watch(field),
      onChange: (e: React.ChangeEvent<HTMLSelectElement>) =>
        setValue(field, e.target.value),
    };
  }
}
