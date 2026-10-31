export const ERROR_CODES = [
  "UNAUTHENTICATED",
  "FORBIDDEN",
  "NOT_FOUND",
  "VALIDATION",
  "RATE_LIMITED",
  "CONFLICT",
  "UNAVAILABLE",
  "REWARDS_DISABLED",
  "INTERNAL",
  "UPLOAD_IN_PROGRESS",
  "DAILY_LIMIT_EXCEEDED",
  "PERIOD_LIMIT_EXCEEDED",
  "PENDING_CAP_REACHED",
  "EMAIL_NOT_VERIFIED",
  "ACCOUNT_INELIGIBLE",
  "SERVICE_UNAVAILABLE",
] as const;

export type ErrorCode = (typeof ERROR_CODES)[number];

export type ResultError = {
  code: ErrorCode;
  message: string;
  fieldErrors?: Record<string, string[]>;
  retryAfter?: number;
  submissionId?: string;
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
  extra?: { fieldErrors?: Record<string, string[]>; retryAfter?: number; submissionId?: string } | Record<string, string[]>,
): Result<never> {
  const extraObj = extra && !("fieldErrors" in extra || "retryAfter" in extra || "submissionId" in extra)
    ? { fieldErrors: extra as Record<string, string[]> }
    : (extra as { fieldErrors?: Record<string, string[]>; retryAfter?: number; submissionId?: string } | undefined);

  return {
    ok: false,
    error: {
      code,
      message,
      ...(extraObj?.fieldErrors ? { fieldErrors: extraObj.fieldErrors } : {}),
      ...(extraObj?.retryAfter !== undefined ? { retryAfter: extraObj.retryAfter } : {}),
      ...(extraObj?.submissionId ? { submissionId: extraObj.submissionId } : {}),
    },
  };
}
