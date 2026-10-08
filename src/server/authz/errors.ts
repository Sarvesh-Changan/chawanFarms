import type { ErrorCode } from "@/lib/result";

export class AuthorizationError extends Error {
  readonly code: ErrorCode;

  constructor(code: ErrorCode, message: string) {
    super(message);
    this.name = "AuthorizationError";
    this.code = code;
  }
}
