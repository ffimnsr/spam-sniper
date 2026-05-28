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
    <div className="max-w-xl">
      <h2 className="text-xl font-bold text-gray-900 mb-4">
        Report a Spam Number
      </h2>
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
        <div>
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
          Submit Report
        </Button>
      </form>

      {error && <p className="mt-4 text-red-600">{error}</p>}

      {result && (
        <Card className="mt-6">
          <CardBody>
            <p className="font-medium text-gray-900 mb-2">
              {result.duplicate
                ? "You have already reported this number."
                : "Report submitted successfully."}
            </p>
            <div className="flex items-center gap-2 mb-2">
              <span className="font-semibold">{result.maskedNumber}</span>
              {result.status && <StatusBadge status={result.status} />}
            </div>
            <p className="text-sm text-gray-600">
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
