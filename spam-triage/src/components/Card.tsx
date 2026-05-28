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
      className={cn("overflow-hidden rounded-lg bg-white shadow", className)}
    >
      {children}
    </div>
  );
}

export function CardHeader({ children, className }: CardProps) {
  return (
    <div
      className={cn("border-b border-gray-200 px-4 py-5 sm:px-6", className)}
    >
      {children}
    </div>
  );
}

export function CardBody({ children, className }: CardProps) {
  return <div className={cn("px-4 py-5 sm:p-6", className)}>{children}</div>;
}
