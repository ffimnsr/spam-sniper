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
        <label className="flex items-center justify-between font-mono text-xs font-bold uppercase tracking-wider text-cyan-400">
          <span className="cyber-label">{label}</span>
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
            className="cyber-select w-full pl-3 pr-7 text-xs text-cyan-200 disabled:opacity-50"
          >
            {POPULAR_COUNTRIES.map((c) => (
              <option
                key={c.code}
                value={c.code}
                className="bg-[var(--cp-surface)] text-slate-100"
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
            className={`cyber-input w-full px-4 py-2.5 text-sm disabled:opacity-50 ${
              error ? "cyber-input--error text-red-100" : ""
            }`}
          />
        </div>
      </div>

      {/* Live validation feedback */}
      {value.trim() && (
        <div className="flex flex-wrap items-center justify-between text-xs pt-0.5">
          {validation.isValid ? (
            <span className="flex items-center gap-1.5 text-emerald-400">
              <span className="h-1.5 w-1.5 bg-emerald-400 shadow-[0_0_6px_#00ff88]" />
              VALID E.164: {validation.e164}
            </span>
          ) : (
            <span className="flex items-center gap-1.5 text-amber-400/90">
              <span className="h-1.5 w-1.5 bg-amber-400" />
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
        <p className="cyber-field-error">
          <span>[ERR]</span> {error}
        </p>
      )}
    </div>
  );
}
