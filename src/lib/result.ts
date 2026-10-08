export const ERROR_CODES = [
  "UNAUTHENTICATED",
  "FORBIDDEN",
  "NOT_FOUND",
  "VALIDATION",
  "RATE_LIMITED",
  "CONFLICT",
  "UNAVAILABLE",
  "INTERNAL",
] as const;

export type ErrorCode = (typeof ERROR_CODES)[number];

export type ResultError = {
  code: ErrorCode;
  message: string;
  fieldErrors?: Record<string, string[]>;
};

export type Result<T> =
  | { ok: true; data: T }
  | { ok: false; error: ResultError };

export function ok<T>(data: T): Result<T> {
  return { ok: true, data };
}

export function err(
  code: ErrorCode,
  message: string,
  fieldErrors?: Record<string, string[]>,
): Result<never> {
  return {
    ok: false,
    error: fieldErrors ? { code, message, fieldErrors } : { code, message },
  };
}
