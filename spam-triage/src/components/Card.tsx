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
  return <div className={cn("cyber-card relative", className)}>{children}</div>;
}

export function CardHeader({ children, className }: CardProps) {
  return (
    <div
      className={cn(
        "border-b border-dashed border-cyan-500/20 bg-[#041018]/80 px-5 py-4 sm:px-6 flex items-center justify-between",
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
