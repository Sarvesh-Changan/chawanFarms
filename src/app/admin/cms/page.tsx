import Link from "next/link";

import { NoAccess } from "@/components/admin/NoAccess";
import { PageHeader } from "@/components/admin/PageHeader";
import { Button } from "@/components/ui/button";
import { getCmsPageStaff } from "@/server/services/cms/page-access";

const sections = [
  { title: "Pages", description: "Build Home and About pages with typed, reorderable sections, preview and publish controls.", href: "/admin/cms/pages" },
  { title: "Policies", description: "Manage immutable, versioned stay rules, cancellation, privacy and terms.", href: "/admin/cms/policies" },
  { title: "Packages", description: "Edit package content, rate versions and catalogue relationships.", href: "/admin/cms/packages" },
  { title: "Accommodation", description: "Edit accommodation descriptions, capacities, amenities and images.", href: "/admin/cms/accommodations" },
  ...["activity", "experience", "menu-category", "menu-item", "faq", "offer", "testimonial", "gallery-item", "post", "post-category"].map((entity) => ({ title: entity.replaceAll("-", " ").replace(/^./, (letter) => letter.toUpperCase()), description: "Create and manage localized content with draft, schedule and publishing controls.", href: `/admin/cms/${entity}` })),
];

export default async function AdminCmsPage() {
  const staff = await getCmsPageStaff("cms.read");
  if (!staff) return <NoAccess />;
  return <section className="space-y-6"><PageHeader title="Content management" description="Manage catalogue and editorial content. New entries begin as drafts; only client-approved details should be published." />
    <div className="grid gap-4 md:grid-cols-2">{sections.map((section) => <article key={section.href} className="grid gap-3 rounded-2xl border border-border/70 bg-card p-5"><div><h2 className="font-heading text-2xl capitalize text-forest-900">{section.title}</h2><p className="mt-1 text-sm text-muted-foreground">{section.description}</p></div><Button asChild variant="outline" className="w-fit"><Link href={section.href}>Open {section.title.toLowerCase()}</Link></Button></article>)}</div>
  </section>;
}
