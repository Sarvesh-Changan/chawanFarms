import { formatINR } from "@/lib/money";

export type StayPackageSource = {
  id: string;
  slug: string;
  name: unknown;
  summary: unknown;
  description: unknown;
  meta: unknown;
  minGuests: number | null;
  maxGuests: number | null;
  isDayVisit: boolean;
  isGroupOnly: boolean;
  heroMedia: {
    publicId: string;
    kind: "IMAGE" | "VIDEO";
    altText: unknown;
    focalX: number | null;
    focalY: number | null;
  } | null;
  rates: readonly {
    audience: "ADULT" | "CHILD_4_10" | "INFANT_UNDER_4";
    foodPreference: "VEG" | "NON_VEG" | null;
    amountPaise: number;
    percentOfAdult: number | null;
  }[];
  accommodations: readonly {
    accommodation: { type: string; name: unknown };
  }[];
};

export type StayCategory = { id: string; label: string };

export type StayCardData = {
  id: string;
  slug: string;
  number: string;
  title: string;
  description: string;
  category: StayCategory | null;
  image: {
    publicId: string;
    resourceType: "image" | "video";
    alt: string;
    focalX: number | null;
    focalY: number | null;
  } | null;
  foodOptions: string[];
  groupNote: string | null;
  priceLabel: string;
  childLabel: string | null;
  infantLabel: string | null;
};

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

export function localized(value: unknown): string {
  if (typeof value === "string") return value;
  const english = record(value).en;
  return typeof english === "string" ? english : "";
}

function categoryFromPackage(item: StayPackageSource): StayCategory | null {
  const categoryLabel = localized(record(item.meta).categoryLabel);
  if (categoryLabel) return { id: slugify(categoryLabel), label: categoryLabel };
  if (item.isDayVisit) return { id: "day-picnic", label: "Day Picnic" };
  if (item.isGroupOnly) return { id: "camp-organiser", label: "Camp Organiser" };

  const types = new Set(item.accommodations.map(({ accommodation }) => accommodation.type));
  if (types.has("GUEST_HOUSE")) return { id: "guest-house", label: "Guest House" };
  if (types.has("TENT") || types.has("DORMITORY")) return { id: "tent-dormitory", label: "Tent & Dormitory" };
  return null;
}

function slugify(value: string): string {
  return value.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "category";
}

function foodLabel(value: "VEG" | "NON_VEG"): string {
  return value === "NON_VEG" ? "Non-veg" : "Veg";
}

function lowestRate(rates: StayPackageSource["rates"], audience: StayPackageSource["rates"][number]["audience"]) {
  return rates.filter((rate) => rate.audience === audience).sort((a, b) => a.amountPaise - b.amountPaise)[0] ?? null;
}

function groupNote(item: StayPackageSource): string | null {
  if (item.minGuests === null || item.minGuests === undefined) return null;
  return item.maxGuests === null || item.maxGuests === undefined
    ? `Minimum ${item.minGuests} persons`
    : `${item.minGuests}–${item.maxGuests} persons`;
}

export function mapStayPackage(item: StayPackageSource, index: number): StayCardData {
  const adultRates = item.rates.filter((rate) => rate.audience === "ADULT");
  const lowestAdultRate = adultRates.sort((a, b) => a.amountPaise - b.amountPaise)[0];
  const childRate = lowestRate(item.rates, "CHILD_4_10");
  const infantRate = lowestRate(item.rates, "INFANT_UNDER_4");
  const foodOptions = [...new Set(adultRates.flatMap((rate) => rate.foodPreference ? [foodLabel(rate.foodPreference)] : []))];

  return {
    id: item.id,
    slug: item.slug,
    number: String(index + 1).padStart(2, "0"),
    title: localized(item.name),
    description: localized(item.summary) || localized(item.description),
    category: categoryFromPackage(item),
    image: item.heroMedia ? {
      publicId: item.heroMedia.publicId,
      resourceType: item.heroMedia.kind === "VIDEO" ? "video" : "image",
      alt: localized(item.heroMedia.altText),
      focalX: item.heroMedia.focalX,
      focalY: item.heroMedia.focalY,
    } : null,
    foodOptions,
    groupNote: groupNote(item),
    priceLabel: lowestAdultRate ? `from ${formatINR(lowestAdultRate.amountPaise)} per person` : "Contact us for rates",
    childLabel: childRate ? `Children 4–10: ${childRate.percentOfAdult !== null ? `${childRate.percentOfAdult}% of adult rate` : formatINR(childRate.amountPaise)}` : null,
    infantLabel: infantRate ? `Under 4: ${infantRate.amountPaise === 0 ? "free" : formatINR(infantRate.amountPaise)}` : null,
  };
}

export function mapStayPackages(items: readonly StayPackageSource[]): StayCardData[] {
  return items.map(mapStayPackage);
}

export function stayCategories(items: readonly StayCardData[]): StayCategory[] {
  const categories = new Map<string, StayCategory>();
  items.forEach((item) => {
    if (item.category) categories.set(item.category.id, item.category);
  });
  return [{ id: "all", label: "All" }, ...categories.values()];
}

export function filterStayPackages(items: readonly StayCardData[], categoryId: string): StayCardData[] {
  if (!categoryId || categoryId === "all") return [...items];
  return items.filter((item) => item.category?.id === categoryId);
}
