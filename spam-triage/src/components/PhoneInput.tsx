import { useEffect, useState } from "react";
import {
  detectCountryFromInput,
  formatAsYouType,
  POPULAR_COUNTRIES,
  validatePhoneNumber,
} from "../lib/phone-helper.ts";

interface PhoneInputProps {
  value?: string;
  country?: string;
  onChange: (value: string) => void;
  onCountryChange?: (country: string) => void;
  label?: string;
  error?: string;
  helper?: string;
  placeholder?: string;
  disabled?: boolean;
}

export function PhoneInput({
  value = "",
  country = "PH",
  onChange,
  onCountryChange,
  label = "Target Phone Number",
  error,
  helper,
  placeholder,
  disabled = false,
}: PhoneInputProps) {
  const [selectedCountry, setSelectedCountry] = useState(country);

  useEffect(() => {
    setSelectedCountry(country);
  }, [country]);

  // Run live validation on phone number
  const validation = validatePhoneNumber(value, selectedCountry);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;

    // Check if user typed an international prefix (+1, +63, etc.)
    const detected = detectCountryFromInput(raw);
    if (detected && detected !== selectedCountry) {
      setSelectedCountry(detected);
      onCountryChange?.(detected);
    }

    const formatted = formatAsYouType(raw, detected || selectedCountry);
    onChange(formatted);
  };

  const handleCountrySelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const nextCountry = e.target.value;
    setSelectedCountry(nextCountry);
    onCountryChange?.(nextCountry);

    // Re-format existing value with new country rules
    if (value) {
      const formatted = formatAsYouType(value, nextCountry);
      onChange(formatted);
    }
  };

  // Find placeholder based on country
  const defaultPlaceholder =
    selectedCountry === "PH"
      ? "+63 917 123 4567"
      : selectedCountry === "US"
        ? "+1 (555) 234-5678"
        : selectedCountry === "GB"
          ? "+44 7911 123456"
          : "+...";

  return (
    <div className="space-y-1.5 font-mono">
      {label && (
        <label className="flex items-center justify-between font-rajdhani text-xs font-bold uppercase tracking-wider text-cyan-400">
          <span className="flex items-center gap-1.5">
            <span className="text-[#ff0055]">//</span> {label}
          </span>
          <span className="text-slate-500 font-mono text-[10px]">
            [REGION: {selectedCountry}]
          </span>
        </label>
      )}

      <div className="flex gap-2">
        {/* Country Selector */}
        <div className="relative w-36 shrink-0">
          <select
            value={selectedCountry}
            onChange={handleCountrySelect}
            disabled={disabled}
            className="w-full appearance-none rounded-sm border border-cyan-500/30 bg-[#060a16] px-3 py-2.5 pr-7 font-mono text-xs text-cyan-200 outline-none transition-all focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400/50 cursor-pointer disabled:opacity-50"
          >
            {POPULAR_COUNTRIES.map((c) => (
              <option
                key={c.code}
                value={c.code}
                className="bg-[#090f1e] text-slate-100"
              >
                {c.code} ({c.dial})
              </option>
            ))}
          </select>
          <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-cyan-400">
            <svg
              className="h-3.5 w-3.5 fill-current"
              viewBox="0 0 20 20"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" />
            </svg>
          </div>
        </div>

        {/* Phone Input Field */}
        <div className="relative flex-1">
          <input
            type="tel"
            value={value}
            onChange={handleInputChange}
            disabled={disabled}
            placeholder={placeholder || defaultPlaceholder}
            className={`w-full rounded-sm border bg-[#060a16] px-4 py-2.5 font-mono text-sm text-slate-100 placeholder:text-slate-600 transition-all outline-none disabled:opacity-50 ${
              error
                ? "border-[#ff0055]/70 focus:border-[#ff0055] focus:ring-1 focus:ring-[#ff0055]/50 text-red-100"
                : "border-cyan-500/30 focus:border-cyan-400 focus:bg-[#080e20] focus:ring-1 focus:ring-cyan-400/50 focus:shadow-[0_0_15px_rgba(0,240,255,0.25)]"
            }`}
          />
        </div>
      </div>

      {/* Live validation feedback */}
      {value.trim() && (
        <div className="flex flex-wrap items-center justify-between text-xs pt-0.5">
          {validation.isValid ? (
            <span className="flex items-center gap-1.5 text-[#00ff9d]">
              <span className="h-1.5 w-1.5 rounded-full bg-[#00ff9d] shadow-[0_0_6px_#00ff9d]" />
              VALID E.164: {validation.e164}
            </span>
          ) : (
            <span className="flex items-center gap-1.5 text-amber-400/90">
              <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
              Awaiting standard format digits
            </span>
          )}

          {validation.formattedInternational && validation.isValid && (
            <span className="text-slate-400 text-[11px]">
              Intl: {validation.formattedInternational}
            </span>
          )}
        </div>
      )}

      {helper && !error && (
        <p className="font-mono text-xs text-slate-400">{helper}</p>
      )}

      {error && (
        <p className="flex items-center gap-1 font-mono text-xs text-[#ff3377]">
          <span>[ERR]</span> {error}
        </p>
      )}
    </div>
  );
}
