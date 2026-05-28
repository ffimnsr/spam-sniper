import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  options: { value: string; label: string }[];
  error?: string;
}

export function Select({
  label,
  options,
  error,
  className,
  ...props
}: SelectProps) {
  return (
    <div className="space-y-1">
      {label && (
        <label className="block text-sm font-medium text-gray-700">
          {label}
        </label>
      )}
      <select
        className={cn(
          "block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm",
          error && "border-red-500",
          className,
        )}
        {...props}
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
