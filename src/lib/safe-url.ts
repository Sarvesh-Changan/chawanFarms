const MAX_CALLBACK_URL_LENGTH = 1024;

function isSafeRelativePath(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const path = value.trim();
  if (!path || path.length > MAX_CALLBACK_URL_LENGTH || !path.startsWith("/") || path.startsWith("//")) return false;
  if (/[\\\u0000-\u001f\u007f]/.test(path)) return false;

  let decoded = path;
  for (let depth = 0; depth < 4; depth += 1) {
    if (decoded.startsWith("//") || /[\\\u0000-\u001f\u007f]/.test(decoded) || /%(?:25)*(?:2f|5c)/i.test(decoded)) return false;
    if (!/%[0-9a-f]{2}/i.test(decoded)) break;
    try {
      decoded = decodeURIComponent(decoded);
    } catch {
      return false;
    }
  }

  try {
    const url = new URL(path, "https://same-site.invalid");
    if (url.origin !== "https://same-site.invalid" || !url.pathname.startsWith("/") || url.pathname.startsWith("//")) return false;
  } catch {
    return false;
  }
  return true;
}

export function safeCallbackUrl(value: unknown, fallback = "/account"): string {
  if (isSafeRelativePath(value)) return value.trim();
  return isSafeRelativePath(fallback) ? fallback.trim() : "/";
}

export function isSafeCallbackUrl(value: unknown): value is string {
  return isSafeRelativePath(value);
}
