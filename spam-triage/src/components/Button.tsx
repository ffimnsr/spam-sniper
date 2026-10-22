import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import { soundFx } from "../lib/sound-fx.ts";

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "danger" | "ghost";
  loading?: boolean;
}

export function Button({
  children,
  variant = "primary",
  loading = false,
  className,
  disabled,
  onClick,
  onMouseEnter,
  ...props
}: ButtonProps) {
  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    soundFx.click();
    onClick?.(e);
  };

  const handleMouseEnter = (e: React.MouseEvent<HTMLButtonElement>) => {
    soundFx.hover();
    onMouseEnter?.(e);
  };

  return (
    <button
      disabled={disabled || loading}
      onClick={handleClick}
      onMouseEnter={handleMouseEnter}
      className={cn(
        "cyber-button group relative outline-none select-none",
        variant === "primary" && "cyber-button--primary",
        variant === "secondary" && "cyber-button--secondary",
        variant === "danger" && "cyber-button--danger",
        variant === "ghost" && "cyber-button--ghost",
        className,
      )}
      {...props}
    >
      {loading ? (
        <svg
          className="mr-2 h-4 w-4 animate-spin text-current"
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
            className="opacity-90"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
          />
        </svg>
      ) : null}
      <span className="relative z-10 flex items-center gap-1.5 font-mono text-sm font-bold tracking-widest">
        {children}
      </span>
    </button>
  );
}
