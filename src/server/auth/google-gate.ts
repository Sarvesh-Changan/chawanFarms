import "server-only";

import { db } from "@/server/db";

export type ValidateUserInfoInput = {
  user: {
    email?: string | null;
    emailVerified?: boolean | null;
    name?: string | null;
    image?: string | null;
    [key: string]: unknown;
  };
  source: {
    method?: string;
    oauth?: {
      providerId?: string;
      [key: string]: unknown;
    };
    [key: string]: unknown;
  };
};

export type ValidationResult =
  | {
      error: string;
      errorDescription: string;
    }
  | undefined;

export async function validateGoogleUserInfo(
  data: ValidateUserInfoInput,
): Promise<ValidationResult> {
  if (data.source.method === "oauth" && data.source.oauth?.providerId === "google") {
    if (!data.user.emailVerified) {
      return {
        error: "email_not_verified",
        errorDescription: "Your Google account email is not verified. Please verify it with Google before signing in.",
      };
    }

    const email = data.user.email?.trim().toLowerCase();
    if (!email) {
      return {
        error: "email_not_found",
        errorDescription: "An email address was not provided by Google.",
      };
    }

    const existingStaff = await db.user.findFirst({
      where: { email, type: "STAFF" },
      select: { id: true },
    });
    if (existingStaff) {
      return {
        error: "staff_account_not_allowed",
        errorDescription: "This email belongs to a staff account. Please sign in at the admin login page.",
      };
    }

    const pendingInvite = await db.staffInvite.findFirst({
      where: { email, revokedAt: null, usedAt: null, expiresAt: { gt: new Date() } },
      select: { id: true },
    });
    if (pendingInvite) {
      return {
        error: "staff_account_not_allowed",
        errorDescription: "This email belongs to a staff account. Please sign in at the admin login page.",
      };
    }
  }

  return undefined;
}

