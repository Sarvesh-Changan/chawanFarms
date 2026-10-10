import type { Metadata } from "next";

import { CatalogueFrame, CatalogueIntro } from "@/components/catalogue/CatalogueLayout";
import { FoodMenu } from "@/components/catalogue/FoodMenu";
import { getPublicFood } from "@/server/services/public-content";

export const metadata: Metadata = { title: "Food · Chawan Farms", description: "Explore the published Chawan Farms menu." };
export const revalidate = 300;
export const dynamic = "force-dynamic";
export const dynamicParams = true;

export default async function FoodPage() {
  const categories = await getPublicFood();
  const menu = categories.map((category) => ({ id: category.id, name: localized(category.name), items: category.items.map((item) => ({ id: item.id, name: localized(item.name), description: localized(item.description), foodPreference: item.foodPreference, isExtraCharge: item.isExtraCharge, extraUnitLabel: item.extraUnitLabel })) }));
  return <CatalogueFrame><CatalogueIntro eyebrow="Chawan Farms · Food" title="Meals from the farm kitchen." description="Browse the published menu. Extra-charge items are marked where the catalogue provides that information."/><section className="mx-auto max-w-7xl px-4 py-12 sm:px-8 sm:py-16 lg:px-12 lg:py-24">{menu.length ? <FoodMenu categories={menu}/> : <p className="bg-clay-100 text-mist-500 rounded-2xl p-8 text-center text-sm">No published menu is available yet.</p>}</section></CatalogueFrame>;
}

function localized(value: unknown): string {
  if (!value || typeof value !== "object" || Array.isArray(value)) return "";
  const english = (value as Record<string, unknown>).en;
  return typeof english === "string" ? english : "";
}
