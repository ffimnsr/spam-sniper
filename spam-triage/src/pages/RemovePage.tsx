import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { Link } from "react-router-dom";
import { z } from "zod";
import { createRemovalRequest } from "../api/removal.ts";
import { Button } from "../components/Button.tsx";
import { Card, CardBody } from "../components/Card.tsx";
import { Input } from "../components/Input.tsx";
import { Select } from "../components/Select.tsx";
import { TurnstileWidget } from "../components/TurnstileWidget.tsx";

const reasons = [
  { value: "personal_number", label: "Personal Number" },
  { value: "incorrect_report", label: "Incorrect Report" },
  { value: "recycled_number", label: "Recycled Number" },
  { value: "legitimate_business", label: "Legitimate Business" },
  { value: "other", label: "Other" },
];

const schema = z.object({
  phoneNumber: z.string().min(1, "Phone number is required"),
  country: z.string().optional(),
  reason: z.string().min(1, "Reason is required"),
  turnstileToken: z.string().min(1, "Please complete the Turnstile challenge"),
});

type FormData = z.infer<typeof schema>;

export default function RemovePage() {
  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
    reset,
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { country: "PH", reason: "personal_number" },
  });

  const [result, setResult] = useState<{
    success: boolean;
    removalRequestId?: number;
    maskedNumber?: string;
    contestDeadline?: string;
  } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const onSubmit = async (data: FormData) => {
    setLoading(true);
    setError("");
    setResult(null);
    try {
      const res = await createRemovalRequest({
        phoneNumber: data.phoneNumber,
        country: data.country,
        reason: data.reason,
        turnstileToken: data.turnstileToken,
      });
      setResult({
        success: true,
        removalRequestId: res.removalRequestId,
        maskedNumber: res.maskedNumber,
        contestDeadline: res.contestDeadline,
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
        Request Number Removal
      </h2>
      <div className="mb-4 text-sm text-gray-600 space-y-1">
        <p>Removal is not immediate.</p>
        <p>The contest period lasts 7 days.</p>
        <p>If nobody contests, the number will be removed automatically.</p>
        <p>If contested, the number becomes disputed and requires review.</p>
      </div>
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
          label="Reason"
          options={reasons}
          {...register("reason")}
          error={errors.reason?.message}
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
          Submit Request
        </Button>
      </form>

      {error && <p className="mt-4 text-red-600">{error}</p>}

      {result && (
        <Card className="mt-6">
          <CardBody>
            <p className="font-medium text-gray-900 mb-2">
              Removal request submitted.
            </p>
            <p className="text-sm text-gray-600 mb-1">
              Masked number: {result.maskedNumber}
            </p>
            <p className="text-sm text-gray-600 mb-2">
              Contest deadline:{" "}
              {result.contestDeadline &&
                new Date(result.contestDeadline).toLocaleDateString()}
            </p>
            <Link
              to={`/removal/${result.removalRequestId}`}
              className="text-sm text-blue-600 hover:underline"
            >
              View removal request
            </Link>
          </CardBody>
        </Card>
      )}
    </div>
  );
}
