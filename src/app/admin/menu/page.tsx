import Link from "next/link";

import { CmsContentListPage } from "@/components/admin/cms/CmsContentAdminPage";

export default async function MenuPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const raw = await searchParams;
  const tabValue = Array.isArray(raw.tab) ? raw.tab[0] : raw.tab;
  const tab = tabValue === "items" ? "items" : "categories";
  const entityType = tab === "items" ? "menu-item" : "menu-category";
  const title = tab === "items" ? "Menu items" : "Menu categories";
  return <section className="space-y-6">
    <nav aria-label="Menu editor" className="flex flex-wrap gap-2 border-b pb-3">
      <Link className={tab === "categories" ? "rounded-md bg-forest-800 px-3 py-2 text-sm text-white" : "rounded-md border px-3 py-2 text-sm"} href="/admin/menu?tab=categories">Categories</Link>
      <Link className={tab === "items" ? "rounded-md bg-forest-800 px-3 py-2 text-sm text-white" : "rounded-md border px-3 py-2 text-sm"} href="/admin/menu?tab=items">Items</Link>
    </nav>
    <CmsContentListPage entityType={entityType} title={title} basePath="/admin/menu" editorPath={`/admin/menu/menu-${tab === "items" ? "item" : "category"}`} tab={tab} searchParams={searchParams} />
  </section>;
}
