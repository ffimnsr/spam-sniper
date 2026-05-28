import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { Link } from "react-router-dom";
import { z } from "zod";
import { checkNumber } from "../api/numbers.ts";
import { Button } from "../components/Button.tsx";
import { Card, CardBody } from "../components/Card.tsx";
import { Input } from "../components/Input.tsx";
import { StatusBadge } from "../components/StatusBadge.tsx";

const schema = z.object({
  phoneNumber: z.string().min(1, "Phone number is required"),
  country: z.string().optional(),
});

type FormData = z.infer<typeof schema>;

export default function CheckPage() {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { country: "PH" },
  });

  const [result, setResult] = useState<{
    found: boolean;
    maskedNumber?: string;
    status?: string;
    reportCount?: number;
    uniqueReporterCount?: number;
    removalStatus?: string;
    contestDeadline?: string;
    contestWindowOpen?: boolean;
  } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const onSubmit = async (data: FormData) => {
    setLoading(true);
    setError("");
    setResult(null);
    try {
      const res = await checkNumber(data.phoneNumber, data.country);
      if (res.found) {
        setResult({
          found: true,
          maskedNumber: res.maskedNumber,
          status: res.status,
          reportCount: res.reportCount,
          uniqueReporterCount: res.uniqueReporterCount,
          removalStatus: res.removalStatus,
          contestDeadline: res.contestDeadline,
          contestWindowOpen: res.contestWindowOpen,
        });
      } else {
        setResult({ found: false });
      }
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-xl">
      <h2 className="text-xl font-bold text-gray-900 mb-4">Check a Number</h2>
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
        <Button type="submit" loading={loading}>
          Check
        </Button>
      </form>

      {error && <p className="mt-4 text-red-600">{error}</p>}

      {result && (
        <Card className="mt-6">
          <CardBody>
            {result.found ? (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className="text-lg font-semibold">
                    {result.maskedNumber}
                  </span>
                  {result.status && <StatusBadge status={result.status} />}
                </div>
                <p className="text-sm text-gray-600">
                  Reports: {result.reportCount} · Unique reporters:{" "}
                  {result.uniqueReporterCount}
                </p>
                {result.removalStatus && (
                  <p className="text-sm text-gray-600">
                    Removal status: {result.removalStatus}
                    {result.contestDeadline &&
                      ` · Deadline: ${new Date(result.contestDeadline).toLocaleDateString()}`}
                  </p>
                )}
                <div className="flex gap-3 pt-2">
                  <Link
                    to="/report"
                    className="text-sm text-blue-600 hover:underline"
                  >
                    Report again
                  </Link>
                  <Link
                    to="/remove"
                    className="text-sm text-blue-600 hover:underline"
                  >
                    Request removal
                  </Link>
                </div>
              </div>
            ) : (
              <p className="text-gray-600">No reports found.</p>
            )}
          </CardBody>
        </Card>
      )}
    </div>
  );
}
