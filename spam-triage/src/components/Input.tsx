import { type ClassValue, clsx } from "clsx";
import { useId } from "react";
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
  id,
  ...props
}: InputProps) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const errorId = `${inputId}-error`;
  const helperId = `${inputId}-helper`;

  return (
    <div className="space-y-1.5">
      {label && (
        <label htmlFor={inputId} className="cyber-label">
          {label}
        </label>
      )}
      <div className="relative flex items-center">
        {leftAddon && (
          <div className="absolute left-3 z-10 flex items-center text-slate-400">
            {leftAddon}
          </div>
        )}
        <input
          {...props}
          id={inputId}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? errorId : helper ? helperId : undefined}
          className={cn(
            "cyber-input block",
            leftAddon ? "pl-11" : "",
            rightAddon ? "pr-11" : "",
            error && "cyber-input--error text-red-200",
            className,
          )}
        />
        {rightAddon && (
          <div className="absolute right-3 z-10 flex items-center text-slate-400">
            {rightAddon}
          </div>
        )}
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
