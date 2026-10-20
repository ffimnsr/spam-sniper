import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  options: { value: string; label: string }[];
  error?: string;
  helper?: string;
}

export function Select({
  label,
  options,
  error,
  helper,
  className,
  ...props
}: SelectProps) {
  return (
    <div className="space-y-1.5">
      {label && (
        <label className="flex items-center gap-1.5 font-rajdhani text-xs font-bold uppercase tracking-wider text-cyan-400">
          <span className="text-[#ff0055]">//</span> {label}
        </label>
      )}
      <div className="relative">
        <select
          className={cn(
            "block w-full appearance-none rounded-sm border border-cyan-500/30 bg-[#060a16] px-4 py-2.5 pr-10 font-mono text-sm text-slate-100 transition-all duration-200 outline-none cursor-pointer",
            "focus:border-cyan-400 focus:bg-[#080e20] focus:ring-1 focus:ring-cyan-400/50 focus:shadow-[0_0_18px_rgba(0,240,255,0.25)]",
            error &&
              "border-[#ff0055]/70 focus:border-[#ff0055] focus:ring-[#ff0055]/50 focus:shadow-[0_0_15px_rgba(255,0,85,0.3)]",
            className,
          )}
          {...props}
        >
          {options.map((opt) => (
            <option
              key={opt.value}
              value={opt.value}
              className="bg-[#090f1e] text-slate-100 py-1"
            >
              {opt.label}
            </option>
          ))}
        </select>
        {/* Custom cyberpunk select arrow indicator */}
        <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-cyan-400">
          <svg
            className="h-4 w-4 fill-current"
            viewBox="0 0 20 20"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" />
          </svg>
        </div>
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
