import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { submitReport } from "../api/numbers.ts";
import { Button } from "../components/Button.tsx";
import { Card, CardBody } from "../components/Card.tsx";
import { Input } from "../components/Input.tsx";
import { Select } from "../components/Select.tsx";
import { StatusBadge } from "../components/StatusBadge.tsx";
import { TurnstileWidget } from "../components/TurnstileWidget.tsx";

const categories = [
  { value: "scam", label: "Scam" },
  { value: "phishing", label: "Phishing" },
  { value: "loan_spam", label: "Loan Spam" },
  { value: "robocall", label: "Robocall" },
  { value: "impersonation", label: "Impersonation" },
  { value: "delivery_scam", label: "Delivery Scam" },
  { value: "bank_scam", label: "Bank Scam" },
  { value: "unknown", label: "Unknown" },
];

const schema = z.object({
  phoneNumber: z.string().min(1, "Phone number is required"),
  country: z.string().optional(),
  category: z.string().min(1, "Category is required"),
  turnstileToken: z.string().min(1, "Please complete the Turnstile challenge"),
});

type FormData = z.infer<typeof schema>;

export default function ReportPage() {
  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
    reset,
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { country: "PH", category: "unknown" },
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
  const [error, setError] = useState("");

  const onSubmit = async (data: FormData) => {
    setLoading(true);
    setError("");
    setResult(null);
    try {
      const res = await submitReport({
        phoneNumber: data.phoneNumber,
        country: data.country,
        category: data.category,
        turnstileToken: data.turnstileToken,
      });
      setResult({
        success: true,
        duplicate: res.duplicate,
        maskedNumber: res.maskedNumber,
        status: res.status,
        reportCount: res.reportCount,
        uniqueReporterCount: res.uniqueReporterCount,
      });
      reset();
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
      setValue("turnstileToken", "");
    }
  };

  return (
    <div className="page-stack">
      <section className="page-hero">
        <p className="page-eyebrow">Write Signal</p>
        <h1 className="page-title">Report spam caller.</h1>
        <p className="page-lede">
          Submit category-based signal. Each unique reporter adds confidence.
          Turnstile challenge blocks bulk abuse.
        </p>
      </section>

      <Card className="max-w-2xl">
        <CardBody className="space-y-4">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <Input
              label="Phone Number"
              {...register("phoneNumber")}
              error={errors.phoneNumber?.message}
              placeholder="+63 917 123 4567"
            />
            <Input
              label="Country Code"
              {...register("country")}
              error={errors.country?.message}
              placeholder="PH"
            />
            <Select
              label="Category"
              options={categories}
              {...register("category")}
              error={errors.category?.message}
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
            <Button type="submit" loading={loading}>
              Submit report
            </Button>
          </form>

          {error && <p className="text-red-600">{error}</p>}
        </CardBody>
      </Card>

      {result && (
        <Card className="max-w-2xl">
          <CardBody className="space-y-3">
            <p className="font-semibold text-slate-950">
              {result.duplicate
                ? "You already reported this number."
                : "Report submitted."}
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-semibold text-slate-950">
                {result.maskedNumber}
              </span>
              {result.status && <StatusBadge status={result.status} />}
            </div>
            <p className="text-sm text-slate-600">
              Total reports: {result.reportCount}
              {result.uniqueReporterCount !== undefined &&
                ` · Unique reporters: ${result.uniqueReporterCount}`}
            </p>
          </CardBody>
        </Card>
      )}
    </div>
  );
}
