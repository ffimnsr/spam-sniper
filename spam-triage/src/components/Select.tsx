import { type ClassValue, clsx } from "clsx";
import { useId } from "react";
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
  id,
  ...props
}: SelectProps) {
  const generatedId = useId();
  const selectId = id ?? generatedId;
  const errorId = `${selectId}-error`;
  const helperId = `${selectId}-helper`;

  return (
    <div className="space-y-1.5">
      {label && (
        <label htmlFor={selectId} className="cyber-label">
          {label}
        </label>
      )}
      <div className="relative">
        <select
          {...props}
          id={selectId}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? errorId : helper ? helperId : undefined}
          className={cn(
            "cyber-select block",
            error && "cyber-select--error",
            className,
          )}
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
            aria-hidden="true"
            className="h-4 w-4 fill-current"
            viewBox="0 0 20 20"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" />
          </svg>
        </div>
      </div>
      {helper && !error && (
        <p id={helperId} className="font-mono text-xs text-slate-400">
          {helper}
        </p>
      )}
      {error && (
        <p id={errorId} role="alert" className="cyber-field-error">
          <span>[ERR]</span> {error}
        </p>
      )}
    </div>
  );
}
