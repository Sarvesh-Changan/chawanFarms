export type SessionWithToken = { token: string };

export function matchesCurrentSessionToken(
  currentToken: string | null | undefined,
  sessionToken: string,
): boolean {
  return Boolean(currentToken && sessionToken && currentToken === sessionToken);
}

export function getSessionDeviceDescription(userAgent: string | null): string {
  if (!userAgent) return "Unknown device";

  const browser = /Edg\//i.test(userAgent)
    ? "Edge"
    : /OPR\//i.test(userAgent)
      ? "Opera"
      : /Firefox\//i.test(userAgent)
        ? "Firefox"
        : /Chrome\//i.test(userAgent) && !/Chromium/i.test(userAgent)
          ? "Chrome"
          : /Safari\//i.test(userAgent) && !/Chrome\//i.test(userAgent)
            ? "Safari"
            : /Chromium/i.test(userAgent)
              ? "Chromium"
              : "Browser";
  const operatingSystem = /Windows NT/i.test(userAgent)
    ? "Windows"
    : /Android/i.test(userAgent)
      ? "Android"
      : /iPhone|iPad|iPod/i.test(userAgent)
        ? "iOS"
        : /Mac OS X|Macintosh/i.test(userAgent)
          ? "macOS"
          : /Linux/i.test(userAgent)
            ? "Linux"
            : "unknown operating system";

  return `${browser} on ${operatingSystem}`;
}

export function getSessionIpLabel(ipAddress: string | null, isDevelopment: boolean): string {
  const ip = ipAddress?.trim();
  if (!ip || ip === "0.0.0.0" || ip === "::") return "Unknown";
  if (isDevelopment && (ip === "127.0.0.1" || ip === "::1")) return "This computer (local)";
  return ip;
}

export function getRelativeTime(date: Date, now = new Date()): string {
  const elapsedSeconds = Math.round((date.getTime() - now.getTime()) / 1000);
  const elapsedMinutes = Math.round(elapsedSeconds / 60);
  const elapsedHours = Math.round(elapsedMinutes / 60);
  const elapsedDays = Math.round(elapsedHours / 24);
  const elapsedMonths = Math.round(elapsedDays / 30);
  const elapsedYears = Math.round(elapsedDays / 365);
  const [value, unit] = Math.abs(elapsedYears) >= 1
    ? [elapsedYears, "year"]
    : Math.abs(elapsedMonths) >= 1
      ? [elapsedMonths, "month"]
      : Math.abs(elapsedDays) >= 1
        ? [elapsedDays, "day"]
        : Math.abs(elapsedHours) >= 1
          ? [elapsedHours, "hour"]
          : [Math.max(1, Math.abs(elapsedMinutes)), "minute"];
  const relative = new Intl.RelativeTimeFormat("en", { numeric: "auto" }).format(value, unit as Intl.RelativeTimeFormatUnit);
  return relative === "yesterday" ? "1 day ago" : relative === "tomorrow" ? "in 1 day" : relative;
}

export function formatSessionDate(date: Date): string {
  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "full",
    timeStyle: "long",
    timeZone: "Asia/Kolkata",
  }).format(date);
}
