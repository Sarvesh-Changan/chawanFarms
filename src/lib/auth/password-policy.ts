import commonPasswords from "./common-passwords.json";

const commonPasswordSet = new Set(commonPasswords.map((p) => p.toLowerCase()));

export type PasswordValidationResult =
  | { valid: true }
  | { valid: false; reason: string };

export function validateAdminPassword(
  password: string,
  email?: string,
): PasswordValidationResult {
  // Check length: min 12, max 128
  if (!password || password.length < 12) {
    return { valid: false, reason: "Password must be at least 12 characters long." };
  }
  if (password.length > 128) {
    return { valid: false, reason: "Password must be at most 128 characters long." };
  }

  // Reject 1,000 most common passwords
  const lowerPassword = password.toLowerCase();
  if (commonPasswordSet.has(lowerPassword)) {
    return {
      valid: false,
      reason: "This password is too common and easily guessed. Please choose a more secure password.",
    };
  }

  // Reject passwords containing email local part
  if (email && email.includes("@")) {
    const localPart = email.split("@")[0]?.toLowerCase().trim();
    if (localPart && localPart.length >= 3 && lowerPassword.includes(localPart)) {
      return {
        valid: false,
        reason: "Password must not contain your email username or local part.",
      };
    }
  }

  return { valid: true };
}

