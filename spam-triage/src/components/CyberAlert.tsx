import { parseApiError } from "../lib/error-helper.ts";

interface CyberAlertProps {
  error?: unknown;
  message?: string;
  type?: "error" | "warning" | "success" | "info";
  className?: string;
  onDismiss?: () => void;
}

export function CyberAlert({
  error,
  message,
  type = "error",
  className = "",
  onDismiss,
}: CyberAlertProps) {
  if (!error && !message) return null;

  const parsed = error
    ? parseApiError(error)
    : { code: type.toUpperCase(), message: message || "" };

  const isError = type === "error";
  const isSuccess = type === "success";
  const isWarning = type === "warning";

  const borderColor = isError
    ? "border-pink-400/60 bg-[#1c0410]/90 text-pink-200 shadow-[0_0_20px_rgba(255,42,109,0.2)]"
    : isSuccess
      ? "border-emerald-400/60 bg-[#001f10]/90 text-emerald-200 shadow-[0_0_20px_rgba(0,255,136,0.2)]"
      : isWarning
        ? "border-amber-400/60 bg-[#1e1a00]/90 text-amber-200 shadow-[0_0_20px_rgba(255,230,0,0.18)]"
        : "border-cyan-500/60 bg-[#041018]/90 text-cyan-200 shadow-[0_0_20px_rgba(0,240,255,0.2)]";

  const badgeColor = isError
    ? "bg-pink-400 text-black"
    : isSuccess
      ? "bg-emerald-400 text-black font-bold"
      : isWarning
        ? "bg-amber-400 text-black font-bold"
        : "bg-cyan-400 text-black font-bold";

  return (
    <div
      role="alert"
      className={`relative overflow-hidden border p-4 font-mono text-sm backdrop-blur-md transition-all ${borderColor} ${className}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span
              className={`rounded px-1.5 py-0.5 text-[10px] tracking-wider uppercase ${badgeColor}`}
            >
              [{parsed.code}]
            </span>
            <span className="font-mono text-sm font-bold tracking-wide">
              {isError
                ? "TELEMETRY REJECTION"
                : isSuccess
                  ? "SYSTEM CONFIRMATION"
                  : "ALERT NOTICE"}
            </span>
          </div>

          <p className="mt-1 text-sm font-sans text-slate-200">
            {parsed.message}
          </p>

          {parsed.suggestion && (
            <p className="text-xs text-slate-400">
              <span className="text-cyan-400">Suggestion:</span>{" "}
              {parsed.suggestion}
            </p>
          )}
        </div>

        {onDismiss && (
          <button
            type="button"
            onClick={onDismiss}
            className="text-slate-400 hover:text-white transition-colors"
            aria-label="Dismiss alert"
          >
            ✕
          </button>
        )}
      </div>
    </div>
  );
}
