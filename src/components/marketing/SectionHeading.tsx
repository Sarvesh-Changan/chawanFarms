import type { ReactNode } from "react";

type SectionHeadingProps = {
  eyebrow?: string;
  title: string;
  description?: string;
  id?: string;
  align?: "left" | "center";
  children?: ReactNode;
};

export function SectionHeading({
  eyebrow,
  title,
  description,
  id,
  align = "left",
  children,
}: SectionHeadingProps) {
  return (
    <div className={`max-w-3xl ${align === "center" ? "mx-auto text-center" : ""}`}>
      {eyebrow ? (
        <p className="text-laterite-600 text-xs font-semibold tracking-[0.2em] uppercase">
          {eyebrow}
        </p>
      ) : null}
      <h2 id={id} className="font-heading text-forest-900 mt-3 text-[clamp(2rem,7vw,3.5rem)] leading-[1.08] tracking-tight">
        {title}
      </h2>
      {description ? <p className="text-mist-500 mt-4 max-w-2xl text-base leading-7">{description}</p> : null}
      {children}
    </div>
  );
}
