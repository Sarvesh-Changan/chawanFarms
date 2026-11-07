import Link from "next/link";

import { formatINR } from "@/lib/money";
import type { PublicHomeData } from "@/server/services/public-content";

type FoodCategory = NonNullable<PublicHomeData["food"]>[number];
type FoodItem = FoodCategory["items"][number];
type MealGroup = { id: "breakfast" | "lunch-dinner" | "evening-tea"; label: string; categories: FoodCategory[] };

function localized(value: unknown): string {
  if (typeof value === "string") return value;
  if (!value || typeof value !== "object" || Array.isArray(value)) return "";
  const english = (value as Record<string, unknown>).en;
  return typeof english === "string" ? english : "";
}

function preferenceIncludes(item: FoodItem, preference: "VEG" | "NON_VEG") {
  return item.foodPreference === null || item.foodPreference === preference;
}

function extraNoteItems(categories: FoodCategory[]) {
  const labels = ["mutton", "chicken", "fish", "barbecue"];
  return [...new Set(categories.flatMap((category) => category.items)
    .filter((item) => item.isExtraCharge)
    .flatMap((item) => {
      const name = localized(item.name).toLowerCase();
      return labels.filter((label) => name.includes(label));
    }))];
}

function MenuItemLine({ item }: { item: FoodItem }) {
  return <li className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 border-b border-forest-900/10 py-2.5 text-sm text-forest-900/85 last:border-0">
    <span>{localized(item.name)}{item.isExtraCharge ? <span className="ml-2 rounded bg-turmeric-500/20 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-laterite-600">Extra</span> : null}</span>
    {item.isExtraCharge && item.extraPricePaise !== null ? <span className="shrink-0 text-xs font-medium text-forest-900/70">{formatINR(item.extraPricePaise)}{item.extraUnitLabel ? ` / ${item.extraUnitLabel}` : ""}</span> : null}
  </li>;
}

function PreferenceColumn({ title, categories, preference }: { title: string; categories: FoodCategory[]; preference: "VEG" | "NON_VEG" }) {
  const items = categories.flatMap((category) => category.items).filter((item) => preferenceIncludes(item, preference));
  return <div>
    <h4 className="text-forest-700 text-xs font-semibold tracking-[0.16em] uppercase">{title}</h4>
    {items.length ? <ul className="mt-2">{items.map((item) => <MenuItemLine key={item.id} item={item} />)}</ul> : <p className="mt-2 text-sm text-mist-500">No items listed.</p>}
  </div>;
}

function groupCategories(categories: FoodCategory[]): MealGroup[] {
  const groups: MealGroup[] = [
    { id: "breakfast", label: "Breakfast", categories: [] },
    { id: "lunch-dinner", label: "Lunch & dinner", categories: [] },
    { id: "evening-tea", label: "Evening tea and snacks", categories: [] },
  ];
  for (const category of categories) {
    const value = `${category.slug} ${localized(category.name)}`.toLowerCase();
    const group = value.includes("breakfast") || value.includes("morning")
      ? groups[0]
      : value.includes("evening") || value.includes("tea") || value.includes("snack") || value.includes("part-c")
        ? groups[2]
        : groups[1];
    group.categories.push(category);
  }
  return groups.filter((group) => group.categories.some((category) => category.items.length > 0));
}

export function FoodMenuText({ categories }: { categories: FoodCategory[] }) {
  const groups = groupCategories(categories);
  if (!groups.length) return null;
  const noteItems = extraNoteItems(categories);
  return <div>
    <div className="grid gap-6 lg:grid-cols-3">
      {groups.map((group) => <section key={group.id} className="rounded-xl border border-forest-900/10 bg-cream-50/75 p-5 sm:p-6">
        <h3 className="font-heading text-2xl text-forest-900">{group.label}</h3>
        <div className="mt-5 grid gap-5 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
          <PreferenceColumn title="Veg" categories={group.categories} preference="VEG" />
          <PreferenceColumn title="Non-veg" categories={group.categories} preference="NON_VEG" />
        </div>
      </section>)}
    </div>
    {noteItems.length ? <p className="mt-5 text-sm text-forest-900/70">{noteItems.map((item) => item[0]?.toUpperCase() + item.slice(1)).join(", ")} {noteItems.length === 1 ? "is" : "are"} charged extra where marked.</p> : null}
    <Link href="/food" className="text-forest-900 mt-5 inline-flex min-h-11 items-center font-semibold text-sm underline-offset-4 hover:text-laterite-600 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-turmeric-500">Explore the full menu <span aria-hidden="true" className="ml-2">→</span></Link>
  </div>;
}
