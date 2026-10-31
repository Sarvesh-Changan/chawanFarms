import { safeCallbackUrl } from "@/lib/safe-url";

export type PostLoginUserType = "STAFF" | "CUSTOMER";
export type PostLoginStep = "email-verification" | "two-factor-setup" | "two-factor-verify" | null;

export type PostLoginDestination = {
  destination: string;
  redirectTo: string;
  step: PostLoginStep;
};

function callbackPath(callbackUrl: string): string {
  try {
    let pathname = new URL(callbackUrl, "https://same-site.invalid").pathname;
    for (let depth = 0; depth < 3; depth += 1) {
      if (!/%[0-9a-f]{2}/i.test(pathname)) break;
      pathname = decodeURIComponent(pathname);
    }
    return pathname;
  } catch {
    return "/";
  }
}

export function resolvePostLoginDestination({
  userType,
  callbackUrl,
  needsTwoFactorSetup,
  needsTwoFactorVerify,
  emailVerified = true,
}: {
  userType: PostLoginUserType;
  callbackUrl?: unknown;
  needsTwoFactorSetup: boolean;
  needsTwoFactorVerify: boolean;
  emailVerified?: boolean;
}): PostLoginDestination {
  const defaultDestination = userType === "STAFF" ? "/admin" : "/account";
  const safeCallback = safeCallbackUrl(callbackUrl, defaultDestination);
  const path = callbackPath(safeCallback);
  const callbackIsAdmin = path === "/admin" || path.startsWith("/admin/");
  const callbackAllowed = userType === "STAFF" ? callbackIsAdmin : !callbackIsAdmin;
  const destination = callbackAllowed ? safeCallback : defaultDestination;

  const step: PostLoginStep = !emailVerified
    ? "email-verification"
    : needsTwoFactorSetup
      ? "two-factor-setup"
      : needsTwoFactorVerify
        ? "two-factor-verify"
        : null;

  const redirectTo = step === "email-verification"
    ? `/verify-email?callbackUrl=${encodeURIComponent(destination)}`
    : step === "two-factor-setup" || step === "two-factor-verify"
      ? `/admin/security/two-factor?step=${step === "two-factor-setup" ? "setup" : "verify"}&callbackUrl=${encodeURIComponent(destination)}`
      : destination;

  return { destination, redirectTo, step };
}
