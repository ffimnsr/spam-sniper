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
        "group relative inline-flex items-center justify-center px-5 py-3 text-sm font-bold tracking-wider uppercase transition-all duration-200 outline-none select-none disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer",
        variant === "primary" &&
          "bg-[#00f0ff] text-[#050811] shadow-[0_0_20px_rgba(0,240,255,0.35)] hover:bg-[#4df4ff] hover:shadow-[0_0_30px_rgba(0,240,255,0.65)] hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.99]",
        variant === "secondary" &&
          "border border-cyan-500/40 bg-[#091122]/80 text-cyan-300 shadow-[0_0_12px_rgba(0,240,255,0.12)] hover:border-cyan-300 hover:bg-cyan-950/40 hover:text-cyan-100 hover:shadow-[0_0_20px_rgba(0,240,255,0.3)] hover:-translate-y-0.5 active:translate-y-0",
        variant === "danger" &&
          "border border-[#ff0055]/50 bg-[#250814]/80 text-[#ff3377] shadow-[0_0_15px_rgba(255,0,85,0.2)] hover:border-[#ff0055] hover:bg-[#ff0055]/20 hover:text-white hover:shadow-[0_0_25px_rgba(255,0,85,0.5)] hover:-translate-y-0.5 active:translate-y-0",
        variant === "ghost" &&
          "text-slate-400 hover:text-cyan-300 hover:bg-cyan-950/20",
        className,
      )}
      style={{
        clipPath:
          "polygon(0 0, calc(100% - 8px) 0, 100% 8px, 100% 100%, 8px 100%, 0 calc(100% - 8px))",
      }}
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
      <span className="relative z-10 flex items-center gap-1.5 font-rajdhani text-sm font-bold tracking-widest">
        {children}
      </span>
    </button>
  );
}
