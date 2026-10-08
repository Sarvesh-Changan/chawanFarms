import "server-only";

import { sanitizeCmsHtml } from "@/server/cms/html";

export function SafeHtml({ html, className }: { html: string; className?: string }) {
  const sanitizedHtml = sanitizeCmsHtml(html);
  return <div className={className} dangerouslySetInnerHTML={{ __html: sanitizedHtml }} />;
}
