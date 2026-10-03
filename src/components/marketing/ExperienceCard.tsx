import Image from "next/image";
import Link from "next/link";

import { PROTOTYPE_IMAGE } from "@/lib/prototype-data";

type ExperienceCardProps = {
  title: string;
  description: string;
  label: string;
  imageAlt: string;
};

export function ExperienceCard({ title, description, label, imageAlt }: ExperienceCardProps) {
  return (
    <article className="group bg-forest-900 text-cream-50 relative min-h-[25rem] overflow-hidden rounded-[1.5rem]">
      <Image src={PROTOTYPE_IMAGE} alt={imageAlt} fill sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw" className="object-cover opacity-35 transition duration-500 group-hover:scale-105" />
      <div className="from-forest-900/95 absolute inset-0 bg-gradient-to-t via-forest-900/20 to-transparent" />
      <div className="relative flex min-h-[25rem] flex-col justify-end p-6 sm:p-7">
        <p className="text-paddy-300 text-xs font-semibold tracking-[0.18em] uppercase">{label}</p>
        <h3 className="font-heading mt-2 text-3xl leading-tight">{title}</h3>
        <p className="text-cream-50/80 mt-3 max-w-sm text-sm leading-6">{description}</p>
        <Link href="/book" className="text-turmeric-500 mt-5 inline-flex min-h-11 w-fit items-center rounded-md font-semibold underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-turmeric-500">Enquire about this experience →</Link>
      </div>
    </article>
  );
}
