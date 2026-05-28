import {
  type CountryCode,
  parsePhoneNumberFromString,
} from "libphonenumber-js";

export interface NormalizedPhone {
  e164: string;
  countryCode: string | undefined;
  displayMask: string;
}

export function normalizePhone(
  input: string,
  country?: string,
): NormalizedPhone {
  const trimmed = input.trim();
  const parsed = country
    ? parsePhoneNumberFromString(trimmed, country as CountryCode)
    : parsePhoneNumberFromString(trimmed);

  if (!parsed || !parsed.isValid()) {
    throw new Error("INVALID_PHONE_NUMBER");
  }

  const e164 = parsed.format("E.164");
  const countryCode = parsed.country;
  const displayMask = maskPhone(e164, countryCode);

  return { e164, countryCode, displayMask };
}

function maskPhone(e164: string, countryCode?: string): string {
  // Keep country code prefix if available
  let digits = e164.replace(/\D/g, "");
  if (digits.startsWith("1") && countryCode === "US") {
    digits = digits.slice(1);
  }

  if (digits.length < 7) {
    return "***";
  }

  const last4 = digits.slice(-4);
  const prefixLen = Math.max(0, digits.length - 7);
  const prefix = digits.slice(0, prefixLen);

  if (prefix) {
    return `+${prefix} *** ${last4}`;
  }
  return `*** ${last4}`;
}
