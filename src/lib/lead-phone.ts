import { parsePhoneNumberFromString, type CountryCode } from "libphonenumber-js";

export function normalizeLeadPhone(value: string, defaultCountry = "IN"): string {
  const parsed = parsePhoneNumberFromString(value, defaultCountry as CountryCode);
  if (!parsed?.isValid()) throw new Error("LEAD_PHONE_INVALID");
  return parsed.number;
}
