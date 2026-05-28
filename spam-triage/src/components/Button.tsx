import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary";
  loading?: boolean;
}

export function Button({
  children,
  variant = "primary",
  loading = false,
  disabled,
  className,
  ...props
}: ButtonProps) {
  return (
    <button
      type="button"
      disabled={disabled || loading}
      className={cn(
        "inline-flex items-center justify-center rounded-full px-5 py-2.5 text-sm font-semibold tracking-[0.01em] transition focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-white disabled:cursor-not-allowed disabled:opacity-50",
        variant === "primary" &&
          "bg-gradient-to-b from-[#79bcff] to-[#2d89ff] text-white shadow-[0_16px_30px_rgba(45,137,255,0.24)] hover:translate-y-[-1px] hover:from-[#87c3ff] hover:to-[#1f79ef] focus:ring-blue-500",
        variant === "secondary" &&
          "border border-[rgba(150,178,212,0.54)] bg-[linear-gradient(180deg,rgba(255,255,255,0.74)_0%,rgba(255,255,255,0.44)_100%)] text-slate-700 shadow-[0_12px_24px_rgba(92,132,184,0.10)] hover:translate-y-[-1px] hover:text-slate-900 focus:ring-slate-500",
        className,
      )}
      {...props}
    >
      {loading && (
        <svg
          className="mr-2 h-4 w-4 animate-spin"
          viewBox="0 0 24 24"
          fill="none"
        >
          <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
          />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
          />
        </svg>
      )}
      {children}
    </button>
  );
}
