import { PrismaPg } from "@prisma/adapter-pg";
import { config as loadEnv } from "dotenv";
import { z } from "zod";

import { PrismaClient, Prisma } from "../src/generated/prisma/client";
import { pageBuilderSchema } from "../src/lib/schemas/cms/pages";
import {
  PERMISSIONS,
  ROLE_PERMISSION_MATRIX,
} from "../src/server/authz/permissions";

loadEnv({ path: ".env.local" });
loadEnv();

const seedEnvSchema = z
  .object({
    DATABASE_URL: z.string().url(),
    DIRECT_URL: z.string().url().optional(),
  })
  .strict();

const seedEnv = seedEnvSchema.parse({
  DATABASE_URL: process.env.DATABASE_URL,
  DIRECT_URL: process.env.DIRECT_URL,
});

const db = new PrismaClient({
  adapter: new PrismaPg({
    connectionString: seedEnv.DATABASE_URL,
  }),
});

const pdfMeta = { source: "client-pdf" } satisfies Prisma.InputJsonObject;
const policyMeta = {
  source: "client-pdf",
  pendingDecision: "D-2 cancellation conflict",
  status: "DRAFT",
} satisfies Prisma.InputJsonObject;

const localizedTextSchema = z
  .object({ en: z.string().trim().min(1) })
  .strict();
const metaSchema = z
  .object({
    source: z.literal("client-pdf"),
    pendingDecision: z.string().optional(),
    status: z.literal("DRAFT").optional(),
  })
  .strict();

const permissionKeys = PERMISSIONS;

const permissionSeedSchema = z.array(
  z.object({ key: z.string().min(1), description: z.string().min(1) }).strict(),
);
const permissionSeeds = permissionSeedSchema.parse(
  permissionKeys.map((key) => ({ key, description: `Permission: ${key}` })),
);

const accommodationSeeds = [
  {
    slug: "tent",
    type: "TENT" as const,
    name: { en: "Camping Tent" },
    description: { en: "Camping tents" },
  },
  {
    slug: "dormitory",
    type: "DORMITORY" as const,
    name: { en: "Dormitory" },
    description: { en: "Dormitory" },
  },
  {
    slug: "guest-house",
    type: "GUEST_HOUSE" as const,
    name: { en: "Guest House" },
    description: { en: "2 self-contained AC rooms with terrace" },
  },
  {
    slug: "camp-lawn",
    type: "CAMP_LAWN" as const,
    name: { en: "Camp Lawn" },
    description: {
      en: "Lawn area only for Camp Organisers; set up own tents + dining area + washroom facility (Indian & Western) + campfire + electricity + service.",
    },
  },
] as const;

const packageSeeds = [
  {
    slug: "package-a",
    code: "A",
    name: { en: "Package A" },
    description: { en: "Camping tents / Dormitory" },
    inclusions: { en: "Includes breakfast, lunch, evening tea, dinner" },
  },
  {
    slug: "package-b",
    code: "B",
    name: { en: "Package B" },
    description: { en: "Guest House (2 AC rooms w/ terrace)" },
    inclusions: {
      en: "Includes breakfast, lunch, evening tea, dinner. Rates valid for group of minimum 10 persons.",
    },
    minGuests: 10,
  },
  {
    slug: "package-c",
    code: "C",
    name: { en: "Package C" },
    description: { en: "Camp Organiser (lawn only)" },
    inclusions: {
      en: "Includes morning breakfast, evening tea + nasta, dinner; organiser brings tents; property damage by campers recovered from organiser.",
    },
    conditions: {
      en: "Group size 30–50; rates valid one month; timing 5 pm to 11 am next morning.",
    },
    minGuests: 30,
    maxGuests: 50,
    isGroupOnly: true,
    timingNote: { en: "5 pm to 11 am next morning" },
  },
  {
    slug: "one-day-picnic",
    code: "PICNIC",
    name: { en: "One-day Picnic" },
    inclusions: {
      en: "Includes breakfast & tea, lunch, evening tea; veg / non-veg (chicken).",
    },
    isDayVisit: true,
  },
] as const;

const activitySeeds = [
  { slug: "night-campfire", name: "Night campfire for cold evening" },
  { slug: "mountain-trek", name: "Mountain trek" },
  { slug: "white-water-river-rafting", name: "White-water river rafting" },
  { slug: "jungle-trail", name: "Jungle trail" },
  {
    slug: "biodiversity-wildlife-slide-show",
    name: "Slide show on biodiversity/wildlife documentaries",
  },
  { slug: "star-gazing", name: "Star gazing" },
  { slug: "fishing", name: "Fishing" },
  {
    slug: "bullock-cart",
    name: "Bullock cart",
    isExtraCost: true,
    needsPriorNotice: true,
    priceNote: "extra cost with prior notification",
  },
] as const;

const experienceSeeds = [
  {
    slug: "horticultural-farming",
    title: { en: "Horticultural Farming" },
    summary: { en: "Mango, cashew, coconut, beetle nuts (supari) and aromatic spice plantations." },
    body: { en: "Experience farm life firsthand and explore extensive orchards of Alphonso mangoes, cashews, coconuts, and spices in Baitwadi, Kolad." },
    sortOrder: 0,
  },
  {
    slug: "dairy-and-poultry",
    title: { en: "Dairy & Poultry Farming" },
    summary: { en: "Hands-on rural learning with traditional dairy cattle and poultry care." },
    body: { en: "Connect with rural roots and learn animal husbandry and sustainable milk production in a serene village atmosphere." },
    sortOrder: 1,
  },
  {
    slug: "organic-farming",
    title: { en: "Organic Farming & Nature Trails" },
    summary: { en: "Chemical-free sustainable farming, Kundalika riverbank walks, and rich biodiversity." },
    body: { en: "Rediscover nature with native trees, bird watching, and natural organic agriculture suited for families and school children." },
    sortOrder: 2,
  },
] as const;

const amenitySeeds = [
  "morning & evening tea",
  "breakfast",
  "lunch (veg/non-veg)",
  "dinner (veg/non-veg)",
  "open dining area",
  "swimming in river & small tank",
  "volleyball, badminton, carrom, cricket, archery etc. with ample outdoor space",
  "karaoke system",
] as const;

const menuCategorySeeds = [
  { seedKey: "menu:breakfast", slug: "breakfast", name: "Breakfast" },
  {
    seedKey: "menu:lunch-dinner-veg",
    slug: "lunch-dinner-veg",
    name: "Lunch/Dinner (veg)",
  },
  {
    seedKey: "menu:lunch-dinner-non-veg",
    slug: "lunch-dinner-non-veg",
    name: "Lunch/Dinner (non-veg)",
  },
  {
    seedKey: "menu:part-c-evening",
    slug: "part-c-evening",
    name: "Part C evening",
  },
  { seedKey: "menu:extras", slug: "extras", name: "Extras" },
] as const;

const menuItemSeeds = [
  { seedKey: "menu:breakfast:kanda-poha", category: "menu:breakfast", name: "kanda-poha", foodPreference: "VEG" as const },
  { seedKey: "menu:breakfast:sweet-sheera", category: "menu:breakfast", name: "sweet sheera", foodPreference: "VEG" as const },
  { seedKey: "menu:breakfast:upma", category: "menu:breakfast", name: "upma", foodPreference: "VEG" as const },
  { seedKey: "menu:breakfast:misal-pav", category: "menu:breakfast", name: "misal-pav", foodPreference: "VEG" as const },
  { seedKey: "menu:breakfast:idli-sambar", category: "menu:breakfast", name: "idli-sambar", foodPreference: "VEG" as const },
  { seedKey: "menu:breakfast:bread-omelette", category: "menu:breakfast", name: "bread-omelette", foodPreference: "NON_VEG" as const },
  { seedKey: "menu:breakfast:egg-bhurji", category: "menu:breakfast", name: "egg bhurji", foodPreference: "NON_VEG" as const },
  { seedKey: "menu:breakfast:bread-butter-4-pieces", category: "menu:breakfast", name: "bread & butter (4 pieces)", foodPreference: "VEG" as const },
  { seedKey: "menu:breakfast:2-egg-omelette-pav-2", category: "menu:breakfast", name: "2-egg omelette & pav (2)", foodPreference: "NON_VEG" as const },
  { seedKey: "menu:breakfast:2-egg-bhurji-pav-2", category: "menu:breakfast", name: "2-egg bhurji & pav (2)", foodPreference: "NON_VEG" as const },
  { seedKey: "menu:breakfast:zunka-bhakri", category: "menu:breakfast", name: "zunka bhakri", foodPreference: "VEG" as const },
  { seedKey: "menu:breakfast:kanda-bhaji", category: "menu:breakfast", name: "kanda bhaji", foodPreference: "VEG" as const },
  { seedKey: "menu:lunch-dinner-veg:dal", category: "menu:lunch-dinner-veg", name: "dal", foodPreference: "VEG" as const },
  { seedKey: "menu:lunch-dinner-veg:rice", category: "menu:lunch-dinner-veg", name: "rice", foodPreference: "VEG" as const },
  { seedKey: "menu:lunch-dinner-veg:chapati-bhakri", category: "menu:lunch-dinner-veg", name: "four chapati / three bhakri", foodPreference: "VEG" as const },
  { seedKey: "menu:lunch-dinner-veg:2-vegetables", category: "menu:lunch-dinner-veg", name: "2 vegetables", foodPreference: "VEG" as const },
  { seedKey: "menu:lunch-dinner-veg:sweet", category: "menu:lunch-dinner-veg", name: "sweet", foodPreference: "VEG" as const },
  { seedKey: "menu:lunch-dinner-veg:pickle", category: "menu:lunch-dinner-veg", name: "pickle", foodPreference: "VEG" as const },
  { seedKey: "menu:lunch-dinner-veg:papad", category: "menu:lunch-dinner-veg", name: "papad", foodPreference: "VEG" as const },
  { seedKey: "menu:lunch-dinner-veg:salad", category: "menu:lunch-dinner-veg", name: "salad", foodPreference: "VEG" as const },
  { seedKey: "menu:lunch-dinner-non-veg:dal", category: "menu:lunch-dinner-non-veg", name: "dal", foodPreference: "NON_VEG" as const },
  { seedKey: "menu:lunch-dinner-non-veg:rice", category: "menu:lunch-dinner-non-veg", name: "rice", foodPreference: "NON_VEG" as const },
  { seedKey: "menu:lunch-dinner-non-veg:chapati-bhakri", category: "menu:lunch-dinner-non-veg", name: "four chapati / three bhakri", foodPreference: "NON_VEG" as const },
  { seedKey: "menu:lunch-dinner-non-veg:chicken-mutton-curry", category: "menu:lunch-dinner-non-veg", name: "chicken/mutton curry", foodPreference: "NON_VEG" as const },
  { seedKey: "menu:lunch-dinner-non-veg:chicken-mutton-masala", category: "menu:lunch-dinner-non-veg", name: "chicken/mutton masala", foodPreference: "NON_VEG" as const },
  { seedKey: "menu:lunch-dinner-non-veg:sweet", category: "menu:lunch-dinner-non-veg", name: "sweet", foodPreference: "NON_VEG" as const },
  { seedKey: "menu:lunch-dinner-non-veg:pickle", category: "menu:lunch-dinner-non-veg", name: "pickle", foodPreference: "NON_VEG" as const },
  { seedKey: "menu:lunch-dinner-non-veg:papad", category: "menu:lunch-dinner-non-veg", name: "papad", foodPreference: "NON_VEG" as const },
  { seedKey: "menu:lunch-dinner-non-veg:salad", category: "menu:lunch-dinner-non-veg", name: "salad", foodPreference: "NON_VEG" as const },
  { seedKey: "menu:part-c-evening:tea-coffee", category: "menu:part-c-evening", name: "tea/coffee", foodPreference: "VEG" as const },
  { seedKey: "menu:part-c-evening:batata-wada", category: "menu:part-c-evening", name: "batata wada", foodPreference: "VEG" as const },
  { seedKey: "menu:part-c-evening:mung-bhaji", category: "menu:part-c-evening", name: "mung bhaji", foodPreference: "VEG" as const },
  { seedKey: "menu:extras:mutton-per-kg", category: "menu:extras", name: "mutton prepared as gravy and masala", description: "mutton charged per kg (extra)", foodPreference: "NON_VEG" as const, isExtraCharge: true, extraUnitLabel: "per kg" },
  { seedKey: "menu:extras:chicken-per-kg", category: "menu:extras", name: "chicken prepared as gravy and masala", description: "chicken charged per kg (extra)", foodPreference: "NON_VEG" as const, isExtraCharge: true, extraUnitLabel: "per kg" },
  { seedKey: "menu:extras:fish", category: "menu:extras", name: "fish/shellfish as per availability & size", description: "extra charges", foodPreference: "NON_VEG" as const, isExtraCharge: true },
  { seedKey: "menu:extras:barbecue", category: "menu:extras", name: "barbecue facility available", description: "extra", isExtraCharge: true },
] as const;

const rolePermissionMap = ROLE_PERMISSION_MATRIX;

const roleNames = Object.keys(rolePermissionMap);
const roleSeedSchema = z.array(z.string().min(1));

const settingSeeds = [
  { key: "business.name", value: { en: "Chawan Farms — Agri-Tourism Centre" } },
  { key: "business.address", value: { en: "Baitwadi, Kolad, Tal. Roha, Raigad, Maharashtra, India" } },
  { key: "business.phones", value: ["9821502956", "9821089375", "9359895322"] },
  { key: "business.email", value: Prisma.JsonNull },
  { key: "whatsapp.number", value: Prisma.JsonNull },
  { key: "catalogue.amenities", value: amenitySeeds },
] as const;

const policyBody = {
  en: "<p>Confirm check-in/out time at booking.</p><p>Outside food, catering and alcohol/beverages not permitted.</p><p>Mosquito coil provided; bring repellents.</p><p>Not responsible for accidents/loss of belongings.</p><p>Animals &amp; pets not permitted.</p><p>Management may vacate guests for noise, nuisance, unruly behaviour.</p><p>Original photo ID mandatory at check-in (driver's licence, passport, photo credit card etc.).</p><p>Bank details provided on request.</p><p>Booking confirmed against 100% payment (cheque: after realisation).</p><p>Guests visit an agricultural farm; insects and animals are common; basic first aid available; bring mosquito/insect repellent, painkillers, band-aids.</p><h2>Cancellation statements — pending decision D-2</h2><p>No Refund, Cancellation or Postponement shall be accepted for whatsoever Reasons given by the guest once confirmed &amp; paid.</p><p>25% charged when booking cancelled seven days before checking.</p>",
} satisfies Prisma.InputJsonObject;

const homePageSections: Array<{ type: string; content: Prisma.InputJsonObject; isVisible?: boolean }> = [
  { type: "hero", content: { eyebrow: { en: "Chawan Farms — Agri-Tourism Centre" }, heading: { en: "Come live, experience & rediscover yourself & nature at its best" } } },
  { type: "why-chawan", content: { heading: { en: "Agri-tourism could create awareness about rural life and knowledge about agriculture science among the urban school children as well as citizens" }, items: [] } },
  { type: "experiences-grid", content: { heading: { en: "Horticultural farming, dairy, poultry" }, body: { en: "Organic farming" } } },
  { type: "accommodation", content: { heading: { en: "Camping tents / Dormitory · Guest House" }, body: { en: "Lawn area only for Camp Organisers" } } },
  { type: "packages", content: { heading: { en: "Per person per day, one night stay" } } },
  { type: "food", content: { heading: { en: "Breakfast Menu" } } },
  { type: "activities", content: { heading: { en: "Optional activities" }, body: { en: "Arranged according to prevailing conditions and availability" } } },
  { type: "gallery", content: {} },
  { type: "stories", content: {} },
  { type: "rewards-teaser", content: {}, isVisible: false },
  { type: "location", content: { heading: { en: "Baitwadi, Kolad, Tal. Roha, Raigad, Maharashtra, India" } } },
  { type: "final-cta", content: { heading: { en: "Come live, experience & rediscover yourself & nature at its best" } } },
];

const aboutPageSections: Array<{ type: string; content: Prisma.InputJsonObject; isVisible?: boolean }> = [
  { type: "hero", content: { eyebrow: { en: "Chawan Farms — Agri-Tourism Centre" }, heading: { en: "Come live, experience & rediscover yourself & nature at its best" } } },
  { type: "rich-text", content: { heading: { en: "Agri-Tourism" }, body: { en: "Agri-tourism could create awareness about rural life and knowledge about agriculture science among the urban school children as well as citizens." } } },
  { type: "image-text", content: { heading: { en: "Agri-Tourism" }, body: { en: "Agri-Tourism: An Inexpensive gateway, curiosity about the farming industry and life style, restoration of rural culture……etc." }, imageMediaId: null, imageSide: "right" } },
];

function validateSeedData(): void {
  metaSchema.parse(pdfMeta);
  metaSchema.parse(policyMeta);
  localizedTextSchema.array().parse(
    accommodationSeeds.flatMap((item) => [item.name, item.description]),
  );
  localizedTextSchema.array().parse(
    packageSeeds.flatMap((item) => [item.name, item.inclusions]),
  );
  roleSeedSchema.parse(roleNames);
  z.array(z.string().trim().min(1)).parse(amenitySeeds);
  z.record(z.string(), z.array(z.string().min(1))).parse(rolePermissionMap);
  z.array(z.object({ key: z.string().min(1) }).passthrough()).parse(settingSeeds);
  z.record(z.string(), z.unknown()).parse(policyBody);
  pageBuilderSchema.parse({ id: "00000000-0000-4000-8000-000000000001", title: { en: "Home" }, sections: homePageSections.map((section) => ({ ...section, isVisible: section.isVisible ?? true })) });
  pageBuilderSchema.parse({ id: "00000000-0000-4000-8000-000000000002", title: { en: "About" }, sections: aboutPageSections.map((section) => ({ ...section, isVisible: section.isVisible ?? true })) });
}

async function seedPermissionsAndRoles(): Promise<void> {
  const permissions = new Map<string, string>();

  const permissionRows = await Promise.all(
    permissionSeeds.map((permission) =>
      db.permission.upsert({
        where: { key: permission.key },
        update: { description: permission.description },
        create: permission,
      }),
    ),
  );
  for (const row of permissionRows) {
    permissions.set(row.key, row.id);
  }

  for (const [roleName, keys] of Object.entries(rolePermissionMap)) {
    const role = await db.role.upsert({
      where: { name: roleName },
      update: { isSystem: true },
      create: { name: roleName, isSystem: true },
    });

    if (roleName === "Reservations") {
      const exportPermissionId = permissions.get("leads.export");
      if (exportPermissionId) {
        await db.rolePermission.deleteMany({ where: { roleId: role.id, permissionId: exportPermissionId } });
      }
    }

    await Promise.all(
      keys.map((key) => {
        const permissionId = permissions.get(key);
        if (!permissionId) throw new Error(`Missing permission seed: ${key}`);

        return db.rolePermission.upsert({
          where: {
            roleId_permissionId: { roleId: role.id, permissionId },
          },
          update: {},
          create: { roleId: role.id, permissionId },
        });
      }),
    );
  }
}

async function seedSettings(): Promise<void> {
  await Promise.all(
    settingSeeds.map((setting) =>
      db.setting.upsert({
        where: { key: setting.key },
        update: { value: setting.value, meta: pdfMeta },
        create: { key: setting.key, value: setting.value, meta: pdfMeta },
      }),
    ),
  );
}

async function seedCatalogue(): Promise<void> {
  const accommodations = new Map<string, string>();
  const accommodationRows = await Promise.all(
    accommodationSeeds.map((accommodation) =>
      db.accommodation.upsert({
        where: { slug: accommodation.slug },
        update: {
          type: accommodation.type,
          name: accommodation.name,
          description: accommodation.description,
          status: "PUBLISHED",
          meta: pdfMeta,
        },
        create: { ...accommodation, status: "PUBLISHED", meta: pdfMeta },
      }),
    ),
  );
  for (const row of accommodationRows) {
    accommodations.set(row.slug, row.id);
  }

  const packages = new Map<string, string>();
  const packageRows = await Promise.all(
    packageSeeds.map((packageSeed) =>
      db.package.upsert({
        where: { slug: packageSeed.slug },
        update: { ...packageSeed, status: "PUBLISHED", meta: pdfMeta },
        create: { ...packageSeed, status: "PUBLISHED", meta: pdfMeta },
      }),
    ),
  );
  for (const row of packageRows) {
    packages.set(row.slug, row.id);
  }

  const packageAccommodationMap = [
    ["package-a", "tent"],
    ["package-a", "dormitory"],
    ["package-b", "guest-house"],
    ["package-c", "camp-lawn"],
  ] as const;
  await Promise.all(
    packageAccommodationMap.map(([packageSlug, accommodationSlug]) => {
      const packageId = packages.get(packageSlug);
      const accommodationId = accommodations.get(accommodationSlug);
      if (!packageId || !accommodationId) throw new Error("Missing catalogue relation seed");

      return db.packageAccommodation.upsert({
        where: { packageId_accommodationId: { packageId, accommodationId } },
        update: {},
        create: { packageId, accommodationId },
      });
    }),
  );

  const rateSeeds = [
    ["package-a", "VEG", "ADULT", 140000, null, 0],
    ["package-a", "NON_VEG", "ADULT", 180000, null, 0],
    ["package-a", "VEG", "CHILD_4_10", 84000, 60, 0],
    ["package-a", "NON_VEG", "CHILD_4_10", 108000, 60, 0],
    ["package-a", "VEG", "INFANT_UNDER_4", 0, 0, 0],
    ["package-a", "NON_VEG", "INFANT_UNDER_4", 0, 0, 0],
    ["package-b", "VEG", "ADULT", 230000, null, 0],
    ["package-b", "NON_VEG", "ADULT", 280000, null, 0],
    ["package-b", "VEG", "CHILD_4_10", 138000, 60, 0],
    ["package-b", "NON_VEG", "CHILD_4_10", 168000, 60, 0],
    ["package-b", "VEG", "INFANT_UNDER_4", 0, 0, 0],
    ["package-b", "NON_VEG", "INFANT_UNDER_4", 0, 0, 0],
    ["package-c", "VEG", "ADULT", 120000, null, 0],
    ["package-c", "NON_VEG", "ADULT", 180000, null, 0],
    ["package-c", "VEG", "CHILD_4_10", 72000, 60, 0],
    ["package-c", "NON_VEG", "CHILD_4_10", 108000, 60, 0],
    ["package-c", "VEG", "INFANT_UNDER_4", 0, 0, 0],
    ["package-c", "NON_VEG", "INFANT_UNDER_4", 0, 0, 0],
    ["one-day-picnic", null, "ADULT", 110000, null, 0],
    ["one-day-picnic", null, "CHILD_4_10", 75000, null, 0],
    ["one-day-picnic", null, "INFANT_UNDER_4", 0, 0, 0],
  ] as const;

  await Promise.all(
    rateSeeds.map(([packageSlug, foodPreference, audience, amountPaise, percentOfAdult]) => {
      const packageId = packages.get(packageSlug);
      if (!packageId) throw new Error(`Missing package seed: ${packageSlug}`);
      const foodKey = foodPreference ?? "ALL";
      const seedKey = `pkg-${packageSlug.replace("package-", "")}:${foodKey}:${audience}`;
      return db.packageRate.upsert({
        where: { seedKey },
        update: {
          packageId,
          foodPreference,
          audience,
          unit: "PER_PERSON_PER_DAY",
          amountPaise,
          percentOfAdult,
          isActive: true,
          meta: pdfMeta,
        },
        create: {
          seedKey,
          packageId,
          foodPreference,
          audience,
          unit: "PER_PERSON_PER_DAY",
          amountPaise,
          percentOfAdult,
          isActive: true,
          meta: pdfMeta,
        },
      });
    }),
  );

  const categories = new Map<string, string>();
  const categoryRows = await Promise.all(
    menuCategorySeeds.map((category) =>
      db.menuCategory.upsert({
        where: { seedKey: category.seedKey },
        update: { slug: category.slug, name: { en: category.name }, status: "PUBLISHED", meta: pdfMeta },
        create: {
          seedKey: category.seedKey,
          slug: category.slug,
          name: { en: category.name },
          status: "PUBLISHED",
          meta: pdfMeta,
        },
      }),
    ),
  );
  for (const row of categoryRows) {
    if (row.seedKey) categories.set(row.seedKey, row.id);
  }

  await Promise.all(
    menuItemSeeds.map((item, sortOrder) => {
      const categoryId = categories.get(item.category);
      if (!categoryId) throw new Error(`Missing menu category seed: ${item.category}`);
      const description = "description" in item ? item.description : undefined;
      const foodPreference = "foodPreference" in item ? item.foodPreference : undefined;
      const isExtraCharge = "isExtraCharge" in item ? item.isExtraCharge : false;
      const extraUnitLabel = "extraUnitLabel" in item ? item.extraUnitLabel : undefined;
      return db.menuItem.upsert({
        where: { seedKey: item.seedKey },
        update: {
          categoryId,
          name: { en: item.name },
          description: description ? { en: description } : undefined,
          foodPreference,
          isExtraCharge,
          extraPricePaise: null,
          extraUnitLabel,
          isPublished: true,
          status: "PUBLISHED",
          sortOrder,
          meta: pdfMeta,
        },
        create: {
          seedKey: item.seedKey,
          categoryId,
          name: { en: item.name },
          description: description ? { en: description } : undefined,
          foodPreference,
          isExtraCharge,
          extraPricePaise: null,
          extraUnitLabel,
          isPublished: true,
          status: "PUBLISHED",
          sortOrder,
          meta: pdfMeta,
        },
      });
    }),
  );

  await Promise.all(
    activitySeeds.map((activity, sortOrder) => {
      const isExtraCost = "isExtraCost" in activity ? activity.isExtraCost : false;
      const needsPriorNotice = "needsPriorNotice" in activity ? activity.needsPriorNotice : false;
      const priceNote = "priceNote" in activity ? activity.priceNote : undefined;
      return db.activity.upsert({
        where: { slug: activity.slug },
        update: {
          name: { en: activity.name },
          isExtraCost,
          needsPriorNotice,
          priceNote: priceNote ? { en: priceNote } : undefined,
          conditionsNote: { en: "Arranged according to prevailing conditions and availability" },
          status: "PUBLISHED",
          sortOrder,
          meta: pdfMeta,
        },
        create: {
          slug: activity.slug,
          name: { en: activity.name },
          isExtraCost,
          needsPriorNotice,
          priceNote: priceNote ? { en: priceNote } : undefined,
          conditionsNote: { en: "Arranged according to prevailing conditions and availability" },
          status: "PUBLISHED",
          sortOrder,
          meta: pdfMeta,
        },
      });
    }),
  );
}

async function seedPoliciesAndRewards(): Promise<void> {
  await db.policyVersion.upsert({
    where: { key_version: { key: "stay-rules-and-cancellation", version: 1 } },
    update: {
      status: "PUBLISHED",
      publishedAt: new Date(),
    },
    create: {
      key: "stay-rules-and-cancellation",
      version: 1,
      title: "Stay rules and cancellation policy",
      body: policyBody,
      meta: policyMeta,
      status: "PUBLISHED",
      publishedAt: new Date(),
    },
  });

  await db.rewardRule.upsert({
    where: { version: 1 },
    update: {
      isActive: false,
      pointsPerApprovedVideo: 0,
      maxPointsPerCustomer: null,
      maxSubmissionsPerPeriod: null,
      periodDays: null,
      pointExpiryDays: null,
      minPointsToRedeem: 0,
      couponValidityDays: 0,
      allowCombineWithOffers: false,
      allowMultipleCouponsPerBooking: false,
      manualAdjustMaxPoints: 0,
      manualAdjustApprovalThreshold: 0,
      meta: pdfMeta,
    },
    create: {
      version: 1,
      isActive: false,
      pointsPerApprovedVideo: 0,
      minPointsToRedeem: 0,
      couponValidityDays: 0,
      manualAdjustMaxPoints: 0,
      manualAdjustApprovalThreshold: 0,
      meta: pdfMeta,
    },
  });
}

async function seedExperiences(): Promise<void> {
  await Promise.all(
    experienceSeeds.map((exp) =>
      db.experience.upsert({
        where: { slug: exp.slug },
        update: {
          title: exp.title,
          summary: exp.summary,
          body: exp.body,
          status: "PUBLISHED",
          sortOrder: exp.sortOrder,
        },
        create: {
          slug: exp.slug,
          title: exp.title,
          summary: exp.summary,
          body: exp.body,
          status: "PUBLISHED",
          sortOrder: exp.sortOrder,
        },
      }),
    ),
  );
}

async function seedCmsPages(): Promise<void> {
  const home = await db.page.upsert({
    where: { slug: "home" },
    update: {
      status: "PUBLISHED",
    },
    create: {
      slug: "home",
      title: { en: "Home" },
      status: "PUBLISHED",
      meta: pdfMeta,
    },
  });

  for (const [sortOrder, section] of homePageSections.entries()) {
    const existing = await db.pageSection.findFirst({
      where: { pageId: home.id, type: section.type },
    });
    if (existing) {
      await db.pageSection.update({
        where: { id: existing.id },
        data: {
          content: section.content,
          sortOrder,
          isVisible: section.isVisible ?? true,
        },
      });
    } else {
      await db.pageSection.create({
        data: {
          pageId: home.id,
          type: section.type,
          content: section.content,
          sortOrder,
          isVisible: section.isVisible ?? true,
        },
      });
    }
  }

  const about = await db.page.upsert({
    where: { slug: "about" },
    update: {
      status: "PUBLISHED",
    },
    create: {
      slug: "about",
      title: { en: "About" },
      status: "PUBLISHED",
      meta: pdfMeta,
    },
  });

  for (const [sortOrder, section] of aboutPageSections.entries()) {
    const existing = await db.pageSection.findFirst({
      where: { pageId: about.id, type: section.type },
    });
    if (existing) {
      await db.pageSection.update({
        where: { id: existing.id },
        data: {
          content: section.content,
          sortOrder,
          isVisible: section.isVisible ?? true,
        },
      });
    } else {
      await db.pageSection.create({
        data: {
          pageId: about.id,
          type: section.type,
          content: section.content,
          sortOrder,
          isVisible: section.isVisible ?? true,
        },
      });
    }
  }
}

async function main(): Promise<void> {
  console.log("1. Validating seed data...");
  validateSeedData();
  console.log("2. Seeding permissions and roles...");
  await seedPermissionsAndRoles();
  console.log("3. Seeding settings...");
  await seedSettings();
  console.log("4. Seeding catalogue...");
  await seedCatalogue();
  console.log("5. Seeding experiences...");
  await seedExperiences();
  console.log("6. Seeding policies and rewards...");
  await seedPoliciesAndRewards();
  console.log("7. Seeding CMS pages...");
  await seedCmsPages();
  console.log("Prisma seed completed: permissions, roles, PDF catalogue, experiences, published policies/pages, and inactive RewardRule v1.");
}

main()
  .catch((error: unknown) => {
    console.error(
      "Prisma seed failed:",
      error instanceof Error ? error.message : "unknown error",
    );
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.$disconnect();
  });
