import "server-only";

import sanitizeHtml from "sanitize-html";

import { isAllowedCmsLink } from "@/lib/cms-links";

export function sanitizeCmsHtml(value: string): string {
  return sanitizeHtml(value, {
    allowedTags: ["p", "br", "hr", "h2", "h3", "h4", "strong", "b", "em", "i", "u", "s", "ul", "ol", "li", "blockquote", "a"],
    allowedAttributes: { a: ["href", "target", "rel"] },
    allowedSchemes: ["https", "mailto", "tel"],
    allowedSchemesByTag: { a: ["https", "mailto", "tel"] },
    allowProtocolRelative: false,
    nonTextTags: ["script", "style", "textarea", "option", "noscript", "iframe", "object", "embed"],
    transformTags: {
      a: (_tagName, attributes) => {
        const href = attributes.href && isAllowedCmsLink(attributes.href) ? attributes.href : undefined;
        return {
          tagName: "a",
          attribs: {
            ...(href ? { href } : {}),
            target: "_blank",
            rel: "noopener noreferrer nofollow",
          },
        };
      },
    },
  });
}

export function sanitizeLocalizedHtml(value: unknown): unknown {
  if (!value || typeof value !== "object" || Array.isArray(value)) return value;
  const localized = value as Record<string, unknown>;
  return Object.fromEntries(Object.entries(localized).map(([locale, html]) => [
    locale,
    typeof html === "string" ? sanitizeCmsHtml(html) : html,
  ]));
}
