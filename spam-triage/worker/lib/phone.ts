import {
  type CountryCode,
  type PhoneNumber,
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

  return {
    e164: parsed.format("E.164"),
    countryCode: parsed.country,
    displayMask: maskPhone(parsed),
  };
}

function maskPhone(parsed: PhoneNumber): string {
  const national = parsed.nationalNumber;
  if (national.length < 7) {
    return "***";
  }

  const last4 = national.slice(-4);
  const prefixLength = national.length - 7;
  const prefix = national.slice(0, prefixLength);
  const masked = prefix ? `${prefix} *** ${last4}` : `*** ${last4}`;

  return `+${parsed.countryCallingCode} ${masked}`;
}
