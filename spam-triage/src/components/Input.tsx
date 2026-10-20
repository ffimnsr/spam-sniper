import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helper?: string;
  leftAddon?: React.ReactNode;
  rightAddon?: React.ReactNode;
}

export function Input({
  label,
  error,
  helper,
  leftAddon,
  rightAddon,
  className,
  ...props
}: InputProps) {
  return (
    <div className="space-y-1.5">
      {label && (
        <label className="flex items-center gap-1.5 font-rajdhani text-xs font-bold uppercase tracking-wider text-cyan-400">
          <span className="text-[#ff0055]">//</span> {label}
        </label>
      )}
      <div className="relative flex items-center">
        {leftAddon && (
          <div className="absolute left-3 z-10 flex items-center text-slate-400">
            {leftAddon}
          </div>
        )}
        <input
          className={cn(
            "block w-full rounded-sm border border-cyan-500/30 bg-[#060a16] px-4 py-2.5 font-mono text-sm text-slate-100 placeholder:text-slate-600 transition-all duration-200 outline-none",
            "focus:border-cyan-400 focus:bg-[#080e20] focus:ring-1 focus:ring-cyan-400/50 focus:shadow-[0_0_18px_rgba(0,240,255,0.25)]",
            leftAddon ? "pl-11" : "",
            rightAddon ? "pr-11" : "",
            error &&
              "border-[#ff0055]/70 focus:border-[#ff0055] focus:ring-[#ff0055]/50 focus:shadow-[0_0_15px_rgba(255,0,85,0.3)] text-red-200",
            className,
          )}
          {...props}
        />
        {rightAddon && (
          <div className="absolute right-3 z-10 flex items-center text-slate-400">
            {rightAddon}
          </div>
        )}
      </div>
      {helper && !error && (
        <p className="font-mono text-xs text-slate-400">{helper}</p>
      )}
      {error && (
        <p className="flex items-center gap-1 font-mono text-xs text-[#ff3377]">
          <span>[ERR]</span> {error}
        </p>
      )}
    </div>
  );
}
