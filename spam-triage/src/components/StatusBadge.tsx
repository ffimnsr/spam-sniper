import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const statusConfig: Record<
  string,
  {
    badgeClass: string;
    dotClass: string;
    label: string;
    prefix: string;
  }
> = {
  verified_spam: {
    badgeClass:
      "border-[#ff0055]/70 bg-[#ff0055]/15 text-[#ff3377] shadow-[0_0_15px_rgba(255,0,85,0.3)]",
    dotClass: "bg-[#ff0055] animate-ping",
    prefix: "CRITICAL",
    label: "Verified Spam",
  },
  suspected: {
    badgeClass:
      "border-amber-500/70 bg-amber-500/15 text-amber-300 shadow-[0_0_15px_rgba(245,158,11,0.25)]",
    dotClass: "bg-amber-400",
    prefix: "WARNING",
    label: "Suspected",
  },
  pending: {
    badgeClass:
      "border-cyan-500/60 bg-cyan-500/15 text-cyan-300 shadow-[0_0_15px_rgba(0,240,255,0.2)]",
    dotClass: "bg-cyan-400",
    prefix: "INTAKE",
    label: "Pending",
  },
  under_removal_review: {
    badgeClass:
      "border-purple-500/70 bg-purple-500/15 text-purple-300 shadow-[0_0_15px_rgba(168,85,247,0.25)]",
    dotClass: "bg-purple-400",
    prefix: "HOLD",
    label: "Under Review",
  },
  removed: {
    badgeClass:
      "border-slate-600/70 bg-slate-800/40 text-slate-400 shadow-none",
    dotClass: "bg-slate-500",
    prefix: "CLEARED",
    label: "Removed",
  },
  disputed: {
    badgeClass:
      "border-yellow-500/70 bg-yellow-500/15 text-yellow-300 shadow-[0_0_15px_rgba(234,179,8,0.25)]",
    dotClass: "bg-yellow-400",
    prefix: "CONTEST",
    label: "Disputed",
  },
};

interface StatusBadgeProps {
  status: string;
  className?: string;
  showPrefix?: boolean;
}

export function StatusBadge({
  status,
  className,
  showPrefix = true,
}: StatusBadgeProps) {
  const config = statusConfig[status] || {
    badgeClass: "border-slate-600 bg-slate-800 text-slate-300",
    dotClass: "bg-slate-400",
    prefix: "STATUS",
    label: status,
  };

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-sm border px-2.5 py-1 font-mono text-xs font-semibold uppercase tracking-wider backdrop-blur-sm",
        config.badgeClass,
        className,
      )}
    >
      <span className="relative flex h-2 w-2">
        <span
          className={cn(
            "absolute inline-flex h-full w-full rounded-full opacity-75",
            config.dotClass,
          )}
        />
        <span
          className={cn(
            "relative inline-flex h-2 w-2 rounded-full",
            config.dotClass.replace("animate-ping", ""),
          )}
        />
      </span>
      <span>
        {showPrefix ? `${config.prefix} // ` : ""}
        {config.label}
      </span>
    </span>
  );
}
