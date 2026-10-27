import Link from "next/link";

import { NoAccess } from "@/components/admin/NoAccess";
import { PageHeader } from "@/components/admin/PageHeader";
import { MenuManager, type MenuCategoryRow } from "@/components/admin/menu/MenuManager";
import { Button } from "@/components/ui/button";
import { getCmsPageStaff } from "@/server/services/cms/page-access";
import { getMenuAdmin } from "@/server/services/cms/menu";

export default async function MenuPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const staff = await getCmsPageStaff("cms.read"); if (!staff) return <NoAccess />;
  const raw = await searchParams; const trash = raw.trash === "1" || (Array.isArray(raw.trash) && raw.trash.includes("1"));
  const data = await getMenuAdmin({ q: "", trash });
  const categories: MenuCategoryRow[] = data.categories.map((category) => ({ id: category.id, name: category.name, status: category.status, sortOrder: category.sortOrder, deletedAt: category.deletedAt?.toISOString() ?? null, items: category.items.map((item) => ({ id: item.id, categoryId: item.categoryId, name: item.name, description: item.description, foodPreference: item.foodPreference, isExtraCharge: item.isExtraCharge, extraPricePaise: item.extraPricePaise, isPublished: item.isPublished, status: item.status, sortOrder: item.sortOrder, deletedAt: item.deletedAt?.toISOString() ?? null })) }));
  return <section className="space-y-6"><PageHeader title={trash ? "Menu trash" : "Menu"} description="Maintain the seeded catalogue without inventing dishes or prices." actions={<Button asChild variant="outline"><Link href={trash ? "/admin/menu" : "/admin/menu?trash=1"}>{trash ? "Active menu" : "Trash"}</Link></Button>}/><MenuManager initialCategories={categories} initialOptions={data.options} trash={trash}/></section>;
}
