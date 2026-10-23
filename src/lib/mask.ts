/**
 * Shared PII masking and CSV formula-injection sanitization helpers.
 */

export function maskEmail(value: string | null | undefined): string {
  if (!value) return "—";
  const separator = value.indexOf("@");
  if (separator <= 0 || separator === value.length - 1) return "[REDACTED_EMAIL]";
  const local = value.slice(0, separator);
  const domain = value.slice(separator + 1);
  return `${local.slice(0, 1)}***@${domain}`;
}

export function sanitizeCsvCell(value: unknown): string {
  if (value === null || value === undefined) return "";
  let str = String(value);
  // Protect against CSV formula injection: prefix cells starting with = + - @ \t \r with an apostrophe
  if (/^[=+\-@\t\r]/.test(str)) {
    str = `'${str}`;
  }
  if (/[",\n\r]/.test(str)) {
    str = `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}
