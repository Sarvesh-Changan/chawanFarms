const ALLOWED_LINK_PROTOCOLS = new Set(["https:", "mailto:", "tel:"]);

export function isAllowedCmsLink(value: string): boolean {
  try {
    return ALLOWED_LINK_PROTOCOLS.has(new URL(value).protocol);
  } catch {
    return false;
  }
}
