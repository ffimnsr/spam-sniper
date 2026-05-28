import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helper?: string;
}

export function Input({
  label,
  error,
  helper,
  className,
  ...props
}: InputProps) {
  return (
    <div className="space-y-1">
      {label && (
        <label className="block text-sm font-semibold text-slate-700">
          {label}
        </label>
      )}
      <input
        className={cn(
          "block w-full rounded-2xl border border-[rgba(150,178,212,0.46)] bg-white/80 px-4 py-3 text-sm text-slate-900 shadow-[inset_0_1px_0_rgba(255,255,255,0.72)] outline-none ring-0 placeholder:text-slate-400 focus:border-blue-400 focus:ring-4 focus:ring-blue-100",
          error && "border-red-400 focus:border-red-400 focus:ring-red-100",
          className,
        )}
        {...props}
      />
      {helper && !error && <p className="text-sm text-slate-500">{helper}</p>}
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
