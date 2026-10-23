import type { ReactNode } from "react";

import { SectionEyebrow } from "@/components/marketing/SectionEyebrow";
import { cn } from "@/lib/utils";

export type SectionHeadingProps = {
  eyebrow?: string;
  title: string;
  description?: string;
  id?: string;
  align?: "left" | "center";
  headingLevel?: 2 | 3 | 4;
  className?: string;
  eyebrowClassName?: string;
  descriptionClassName?: string;
  children?: ReactNode;
};

export function SectionHeading({
  eyebrow,
  title,
  description,
  id,
  align = "left",
  headingLevel = 2,
  className,
  eyebrowClassName,
  descriptionClassName,
  children,
}: SectionHeadingProps) {
  const Heading = headingLevel === 3 ? "h3" : headingLevel === 4 ? "h4" : "h2";

  return (
    <div className={cn("max-w-3xl", align === "center" && "mx-auto text-center", className)}>
      {eyebrow ? <SectionEyebrow className={eyebrowClassName}>{eyebrow}</SectionEyebrow> : null}
      <Heading id={id} className="font-heading text-forest-900 mt-3 text-[var(--type-display-lg)] leading-[var(--leading-display)] tracking-tight">
        {title}
      </Heading>
      {description ? <p className={cn("text-mist-500 mt-4 max-w-2xl text-[var(--type-body)] leading-[var(--leading-body)]", descriptionClassName)}>{description}</p> : null}
      {children}
    </div>
  );
}
