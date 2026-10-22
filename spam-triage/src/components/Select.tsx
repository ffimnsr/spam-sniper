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
      {label && <label className="cyber-label">{label}</label>}
      <div className="relative">
        <select
          className={cn(
            "cyber-select block",
            error && "cyber-select--error",
            className,
          )}
          {...props}
        >
          {options.map((opt) => (
            <option
              key={opt.value}
              value={opt.value}
              className="bg-[var(--cp-surface)] text-slate-100 py-1"
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
        <p className="cyber-field-error">
          <span>[ERR]</span> {error}
        </p>
      )}
    </div>
  );
}
