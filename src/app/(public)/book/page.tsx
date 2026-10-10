import type { Metadata } from "next";

import { BookingFlow, type StayTypeOption, type ActivityOption } from "@/components/booking/BookingFlow";
import { Footer } from "@/components/marketing/Footer";
import { Header } from "@/components/marketing/Header";
import { StickyCtaBar } from "@/components/marketing/StickyCtaBar";
import { getSession } from "@/server/auth";
import { db } from "@/server/db";

export const metadata: Metadata = {
  title: "Book Your Stay · Chawan Farms",
  description:
    "Plan your stay, camping, or day picnic at Chawan Farms agri-tourism centre in Kolad. Instant live estimate and easy reservation request.",
};

export const dynamic = "force-dynamic";

export default async function BookPage({
  searchParams,
}: {
  searchParams: Promise<{ package?: string; activity?: string }>;
}) {
  const params = await searchParams;

  // 1. Load session and customer profile
  let customerProfile: { name: string | null; email: string | null; phone: string | null } | null = null;
  let isStaff = false;

  try {
    const session = await getSession();
    if (session?.user?.id) {
      const user = await db.user.findUnique({
        where: { id: session.user.id },
        select: {
          id: true,
          name: true,
          email: true,
          type: true,
          profile: { select: { phone: true } },
        },
      });
      if (user) {
        isStaff = user.type === "STAFF";
        customerProfile = {
          name: user.name,
          email: user.email,
          phone: user.profile?.phone ?? null,
        };
      }
    }
  } catch {
    // Guest browsing
  }

  // 2. Fetch database catalogue: packages, accommodations, activities, policies, and settings
  const [packages, accommodations, dbActivities, publishedPolicy, fallbackPolicy, settingsRows] =
    await Promise.all([
      db.package.findMany({
        where: { deletedAt: null },
        orderBy: { sortOrder: "asc" },
      }),
      db.accommodation.findMany({
        where: { deletedAt: null },
      }),
      db.activity.findMany({
        where: { deletedAt: null },
        orderBy: { sortOrder: "asc" },
      }),
      db.policyVersion.findFirst({
        where: { key: "stay-rules-and-cancellation", status: "PUBLISHED" },
        orderBy: { version: "desc" },
      }),
      db.policyVersion.findFirst({
        where: { key: "stay-rules-and-cancellation" },
        orderBy: { version: "desc" },
      }),
      db.setting.findMany({
        where: {
          key: {
            in: [
              "feature.coupons",
              "whatsapp.number",
              "business.phones",
              "booking.minLeadDays",
              "booking.maxNights",
            ],
          },
        },
      }),
    ]);

  const activePolicy = publishedPolicy ?? fallbackPolicy;

  // 3. Construct stay types from database packages & accommodations
  const stayTypes: StayTypeOption[] = [];

  // Helper to extract localized text or string
  function getLocaleString(val: unknown, fallback: string): string {
    if (!val) return fallback;
    if (typeof val === "string") return val;
    if (typeof val === "object" && "en" in (val as Record<string, unknown>)) {
      return String((val as Record<string, unknown>).en);
    }
    return fallback;
  }

  for (const pkg of packages) {
    if (pkg.slug === "package-a") {
      const tentAcc = accommodations.find((a) => a.slug === "tent") ?? accommodations[0];
      stayTypes.push({
        key: "tent_dorm",
        name: getLocaleString(pkg.name, "Camping Tents / Dormitory"),
        packageSlug: pkg.slug,
        accommodationSlug: tentAcc?.slug ?? "tent",
        description: getLocaleString(
          pkg.inclusions,
          "Overnight stay in tents or dormitory with home-cooked farm meals.",
        ),
        isDayVisit: false,
        minGuests: 1,
      });
    } else if (pkg.slug === "package-b") {
      const ghAcc = accommodations.find((a) => a.slug === "guest-house") ?? accommodations[0];
      stayTypes.push({
        key: "guest_house",
        name: getLocaleString(pkg.name, "Guest House (2 AC Rooms)"),
        packageSlug: pkg.slug,
        accommodationSlug: ghAcc?.slug ?? "guest-house",
        description: getLocaleString(
          pkg.inclusions,
          "2 self-contained AC rooms with terrace and all meals. (Minimum 10 guests for group rate).",
        ),
        isDayVisit: false,
        minGuests: pkg.minGuests ?? 10,
      });
    } else if (pkg.slug === "one-day-picnic") {
      stayTypes.push({
        key: "picnic",
        name: getLocaleString(pkg.name, "One-day Picnic"),
        packageSlug: pkg.slug,
        accommodationSlug: "day-visit",
        description: getLocaleString(
          pkg.inclusions,
          "Day visit: breakfast, lunch, evening tea, and farm access (9:30 AM to 5:30 PM).",
        ),
        isDayVisit: true,
        minGuests: 1,
      });
    } else if (pkg.slug === "package-c") {
      const lawnAcc = accommodations.find((a) => a.slug === "camp-lawn") ?? accommodations[0];
      stayTypes.push({
        key: "camp_lawn",
        name: getLocaleString(pkg.name, "Camp Organiser (Lawn Only)"),
        packageSlug: pkg.slug,
        accommodationSlug: lawnAcc?.slug ?? "camp-lawn",
        description: getLocaleString(
          pkg.inclusions,
          "Lawn area only for camp organisers bringing own tents. Group size 30–50.",
        ),
        isDayVisit: false,
        minGuests: pkg.minGuests ?? 30,
        maxGuests: pkg.maxGuests ?? 50,
      });
    }
  }

  // If no packages matched, create safe fallback from existing DB records
  if (stayTypes.length === 0) {
    stayTypes.push({
      key: "default_stay",
      name: "Farm Stay Experience",
      packageSlug: packages[0]?.slug ?? "package-a",
      accommodationSlug: accommodations[0]?.slug ?? "tent",
      description: "Enjoy peaceful rural living and farm-fresh food.",
      isDayVisit: false,
      minGuests: 1,
    });
  }

  // 4. Transform activities
  const activities: ActivityOption[] = dbActivities.map((act) => ({
    id: act.id,
    slug: act.slug,
    name: getLocaleString(act.name, act.slug),
    isExtraCost: act.isExtraCost,
    priceNote: getLocaleString(act.priceNote, ""),
    conditionsNote: getLocaleString(act.conditionsNote, ""),
  }));

  // 5. Sanitize policy HTML:
  // Visible to staff only: "pending client confirmation (D-2)"
  let policyHtml = getLocaleString(activePolicy?.body, "<p>Standard stay rules apply.</p>");
  if (!isStaff) {
    policyHtml = policyHtml
      .replace(/<h2>Cancellation statements — pending decision D-2<\/h2>/gi, "<h2>Cancellation Policy</h2>")
      .replace(/ — pending decision D-2/gi, "");
  }

  // 6. Map Settings
  const settingsMap = new Map<string, unknown>();
  for (const s of settingsRows) {
    settingsMap.set(s.key, s.value);
  }

  const featureCoupons = Boolean(settingsMap.get("feature.coupons") ?? false);
  const whatsappNumber =
    typeof settingsMap.get("whatsapp.number") === "string"
      ? (settingsMap.get("whatsapp.number") as string)
      : null;
  const rawPhones = settingsMap.get("business.phones");
  const phoneNumbers = Array.isArray(rawPhones) ? rawPhones.map(String) : [];
  const minLeadDays =
    typeof settingsMap.get("booking.minLeadDays") === "number"
      ? (settingsMap.get("booking.minLeadDays") as number)
      : 0;
  const maxNights =
    typeof settingsMap.get("booking.maxNights") === "number"
      ? (settingsMap.get("booking.maxNights") as number)
      : 30;

  // 7. Validate prefilled params against database records
  const validPackageSlug =
    params.package &&
    packages.some(
      (p) => p.slug === params.package || accommodations.some((a) => a.slug === params.package),
    )
      ? params.package
      : null;

  const validActivitySlug =
    params.activity && activities.some((a) => a.slug === params.activity)
      ? params.activity
      : null;

  return (
    <>
      <Header />
      <main className="min-h-screen bg-clay-100/60 px-4 py-12 sm:px-6 sm:py-16 lg:px-8">
        <div className="mx-auto max-w-4xl text-center mb-8">
          <p className="text-laterite-600 text-xs font-semibold tracking-[0.2em] uppercase">
            Reservations &amp; Enquiries
          </p>
          <h1 className="font-heading text-forest-900 mt-2 text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight">
            Book your stay at Chawan Farms
          </h1>
          <p className="text-mist-500 mt-3 max-w-2xl mx-auto text-base sm:text-lg">
            Experience unhurried farm living in Kolad. Complete the steps below to calculate your estimate and send a booking request.
          </p>
        </div>

        <BookingFlow
          stayTypes={stayTypes}
          activities={activities}
          policy={{
            id: activePolicy?.id ?? "default-policy-id",
            title: activePolicy?.title ?? "Stay Rules and Policies",
            html: policyHtml,
          }}
          settings={{
            featureCoupons,
            whatsappNumber,
            phoneNumbers,
            minLeadDays,
            maxNights,
          }}
          customerProfile={customerProfile}
          prefill={{
            packageSlug: validPackageSlug,
            activitySlug: validActivitySlug,
          }}
        />
      </main>
      <StickyCtaBar />
      <Footer />
    </>
  );
}
