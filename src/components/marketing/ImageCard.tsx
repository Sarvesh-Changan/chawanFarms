import Image, { type ImageProps } from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";

import { MetaRow } from "@/components/marketing/MetaRow";
import { cn } from "@/lib/utils";

export type ImageCardProps = {
  src: ImageProps["src"];
  alt: string;
  title: string;
  href?: string;
  eyebrow?: string;
  description?: string;
  meta?: readonly ReactNode[];
  className?: string;
};

export function ImageCard({ src, alt, title, href, eyebrow, description, meta, className }: ImageCardProps) {
  const content = <>
    <Image src={src} alt={alt} fill sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw" className="object-cover transition-transform duration-[var(--motion-duration-ui)] ease-[var(--motion-ease-standard)] group-hover:scale-[1.03] group-focus-within:scale-[1.03] motion-reduce:transform-none" />
    <div aria-hidden="true" className="absolute inset-0 bg-[var(--overlay-image-bottom)] transition-opacity duration-[var(--motion-duration-ui)] group-hover:opacity-95 group-focus-within:opacity-95" />
    <div className="relative flex min-h-72 flex-col justify-end p-5 text-cream-50 sm:p-6">
      {eyebrow ? <p className="text-paddy-300 text-xs font-semibold tracking-[0.18em] uppercase">{eyebrow}</p> : null}
      <h3 className="font-heading mt-2 text-2xl leading-tight">{title}</h3>
      {description ? <p className="text-cream-50/85 mt-2 max-w-prose text-sm leading-6">{description}</p> : null}
      {meta ? <MetaRow className="text-cream-50/75 mt-4" items={meta} /> : null}
    </div>
  </>;

  return <article className={cn("group relative isolate min-h-72 overflow-hidden rounded-[var(--radius-card)] bg-forest-900", className)}>{href ? <Link href={href} className="absolute inset-0 z-10 rounded-[var(--radius-card)] focus-visible:outline-2 focus-visible:outline-offset-[-4px] focus-visible:outline-turmeric-500" aria-label={title} /> : null}{content}</article>;
}
