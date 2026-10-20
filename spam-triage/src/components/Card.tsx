import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface CardProps {
  children: React.ReactNode;
  className?: string;
}

export function Card({ children, className }: CardProps) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-md border border-cyan-500/25 bg-[#080d1c]/80 shadow-[0_0_25px_rgba(0,240,255,0.06)] backdrop-blur-md transition-all duration-200",
        className,
      )}
    >
      {/* Subtle top tech stripe */}
      <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-cyan-400/40 to-transparent pointer-events-none" />

      {/* Top-right corner tech tick */}
      <div className="absolute top-0 right-0 w-3 h-3 pointer-events-none overflow-hidden">
        <div className="absolute top-0 right-0 w-4 h-[2px] bg-cyan-400 rotate-45 transform origin-top-right opacity-60" />
      </div>

      {children}
    </div>
  );
}

export function CardHeader({ children, className }: CardProps) {
  return (
    <div
      className={cn(
        "border-b border-cyan-500/20 bg-cyan-950/20 px-5 py-4 sm:px-6 flex items-center justify-between",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function CardBody({ children, className }: CardProps) {
  return (
    <div className={cn("px-5 py-5 sm:p-6 text-slate-200", className)}>
      {children}
    </div>
  );
}
