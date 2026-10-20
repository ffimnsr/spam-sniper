import {
  AsYouType,
  type CountryCode,
  getCountryCallingCode,
  parsePhoneNumberFromString,
} from "libphonenumber-js";

export interface CountryItem {
  code: string;
  name: string;
  dial: string;
}

export const POPULAR_COUNTRIES: CountryItem[] = [
  { code: "PH", name: "Philippines", dial: "+63" },
  { code: "US", name: "United States", dial: "+1" },
  { code: "GB", name: "United Kingdom", dial: "+44" },
  { code: "SG", name: "Singapore", dial: "+65" },
  { code: "CA", name: "Canada", dial: "+1" },
  { code: "AU", name: "Australia", dial: "+61" },
  { code: "JP", name: "Japan", dial: "+81" },
  { code: "DE", name: "Germany", dial: "+49" },
  { code: "FR", name: "France", dial: "+33" },
  { code: "IN", name: "India", dial: "+91" },
  { code: "MY", name: "Malaysia", dial: "+60" },
  { code: "ID", name: "Indonesia", dial: "+62" },
  { code: "TH", name: "Thailand", dial: "+66" },
  { code: "VN", name: "Vietnam", dial: "+84" },
  { code: "HK", name: "Hong Kong", dial: "+852" },
  { code: "TW", name: "Taiwan", dial: "+886" },
  { code: "KR", name: "South Korea", dial: "+82" },
  { code: "NZ", name: "New Zealand", dial: "+64" },
  { code: "AE", name: "UAE", dial: "+971" },
  { code: "SA", name: "Saudi Arabia", dial: "+966" },
  { code: "BR", name: "Brazil", dial: "+55" },
  { code: "MX", name: "Mexico", dial: "+52" },
  { code: "ES", name: "Spain", dial: "+34" },
  { code: "IT", name: "Italy", dial: "+39" },
  { code: "NL", name: "Netherlands", dial: "+31" },
];

export interface PhoneValidationResult {
  isValid: boolean;
  formattedInternational?: string;
  formattedNational?: string;
  e164?: string;
  country?: string;
  possibleCountryMismatch?: boolean;
}

/**
 * Validate phone number with optional country context
 */
export function validatePhoneNumber(
  input: string,
  country?: string,
): PhoneValidationResult {
  const trimmed = input.trim();
  if (!trimmed) {
    return { isValid: false };
  }

  try {
    const parsed = country
      ? parsePhoneNumberFromString(trimmed, country as CountryCode)
      : parsePhoneNumberFromString(trimmed);

    if (!parsed) {
      return { isValid: false };
    }

    const isValid = parsed.isValid();
    const hasMismatch = Boolean(
      country && parsed.country && parsed.country !== country,
    );

    return {
      isValid,
      formattedInternational: parsed.formatInternational(),
      formattedNational: parsed.formatNational(),
      e164: parsed.format("E.164"),
      country: parsed.country,
      possibleCountryMismatch: hasMismatch,
    };
  } catch {
    return { isValid: false };
  }
}

/**
 * Format phone as user types based on country
 */
export function formatAsYouType(input: string, country?: string): string {
  try {
    const formatter = country
      ? new AsYouType(country as CountryCode)
      : new AsYouType();
    return formatter.input(input);
  } catch {
    return input;
  }
}

/**
 * Detect country code from dial prefix if input starts with '+'
 */
export function detectCountryFromInput(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed.startsWith("+")) return null;

  try {
    const parsed = parsePhoneNumberFromString(trimmed);
    if (parsed?.country) {
      return parsed.country;
    }
  } catch {
    // Ignore detection error
  }
  return null;
}

export function getDialCode(countryCode: string): string {
  try {
    return `+${getCountryCallingCode(countryCode as CountryCode)}`;
  } catch {
    return "";
  }
}
