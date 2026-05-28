import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const statusStyles: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-800",
  suspected: "bg-orange-100 text-orange-800",
  verified_spam: "bg-red-100 text-red-800",
  under_removal_review: "bg-blue-100 text-blue-800",
  removed: "bg-gray-100 text-gray-800",
  disputed: "bg-slate-200 text-slate-800",
};

const statusLabels: Record<string, string> = {
  pending: "Pending",
  suspected: "Suspected",
  verified_spam: "Verified Spam",
  under_removal_review: "Under Review",
  removed: "Removed",
  disputed: "Disputed",
};

interface StatusBadgeProps {
  status: string;
  className?: string;
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border border-white/60 px-2.5 py-1 text-xs font-semibold capitalize shadow-[0_8px_16px_rgba(90,117,154,0.08)]",
        statusStyles[status] || "bg-gray-100 text-gray-800",
        className,
      )}
    >
      {statusLabels[status] || status}
    </span>
  );
}
