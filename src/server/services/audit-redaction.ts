export type SafeJson = string | number | boolean | null | SafeJson[] | { [key: string]: SafeJson };

const sensitiveKeyPattern = /password|token|secret|authorization|cookie|api[-_]?key|otp|backup[-_]?code|reset[-_]?code|verification[-_]?code/i;

function maskEmail(value: string): string {
  const separator = value.indexOf("@");
  if (separator <= 0 || separator === value.length - 1) return "[REDACTED_EMAIL]";
  const local = value.slice(0, separator);
  const domain = value.slice(separator + 1);
  return `${local.slice(0, 1)}***@${domain}`;
}

function maskPhone(value: string): string {
  const digits = value.replace(/\D/g, "");
  if (digits.length < 4) return "[REDACTED_PHONE]";
  return `***${digits.slice(-2)}`;
}

export function redactSensitive(value: unknown, depth = 0): SafeJson {
  if (depth > 8) return "[TRUNCATED]";
  if (value === null || typeof value === "boolean" || typeof value === "number") return value;
  if (typeof value === "string") return value.slice(0, 2000);
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map((item) => redactSensitive(item, depth + 1));
  if (typeof value !== "object") return "[REDACTED]";

  return Object.fromEntries(
    Object.entries(value).map(([key, child]) => {
      if (sensitiveKeyPattern.test(key)) return [key, "[REDACTED]"];
      if (/^e[-_]?mail$/i.test(key)) {
        return [key, typeof child === "string" ? maskEmail(child) : "[REDACTED_EMAIL]"];
      }
      if (/^(phone|mobile|telephone|contact[-_]?number)$/i.test(key)) {
        return [key, typeof child === "string" ? maskPhone(child) : "[REDACTED_PHONE]"];
      }
      return [key, redactSensitive(child, depth + 1)];
    }),
  ) as { [key: string]: SafeJson };
}
