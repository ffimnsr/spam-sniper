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
        "overflow-hidden rounded-[1.5rem] border border-[rgba(150,178,212,0.46)] bg-[linear-gradient(180deg,rgba(255,255,255,0.8)_0%,rgba(245,249,255,0.64)_100%)] shadow-[0_18px_42px_rgba(99,140,196,0.12)] backdrop-blur",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function CardHeader({ children, className }: CardProps) {
  return (
    <div
      className={cn(
        "border-b border-[rgba(150,178,212,0.32)] px-5 py-5 sm:px-6",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function CardBody({ children, className }: CardProps) {
  return <div className={cn("px-5 py-5 sm:p-6", className)}>{children}</div>;
}
