import { PrismaPg } from "@prisma/adapter-pg";
import { config as loadEnv } from "dotenv";
import { z } from "zod";

import { PrismaClient, Prisma } from "../src/generated/prisma/client";
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
    connectionString: seedEnv.DIRECT_URL ?? seedEnv.DATABASE_URL,
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
  rules: [
    "Confirm check-in/out time at booking.",
    "Outside food, catering and alcohol/beverages not permitted.",
    "Mosquito coil provided; bring repellents.",
    "Not responsible for accidents/loss of belongings.",
    "Animals & pets not permitted.",
    "Management may vacate guests for noise, nuisance, unruly behaviour.",
    "Original photo ID mandatory at check-in (driver's licence, passport, photo credit card etc.).",
    "Bank details provided on request.",
    "Booking confirmed against 100% payment (cheque: after realisation).",
    "Guests visit an agricultural farm; insects and animals are common; basic first aid available; bring mosquito/insect repellent, painkillers, band-aids.",
  ],
  cancellationConflict: [
    "No refund/cancellation/postponement for any reason once confirmed & paid.",
    "25% charged when booking cancelled seven days before check-in.",
  ],
} satisfies Prisma.InputJsonObject;

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
}

async function seedPermissionsAndRoles(): Promise<void> {
  const permissions = new Map<string, string>();

  for (const permission of permissionSeeds) {
    const row = await db.permission.upsert({
      where: { key: permission.key },
      update: { description: permission.description },
      create: permission,
    });
    permissions.set(row.key, row.id);
  }

  for (const [roleName, keys] of Object.entries(rolePermissionMap)) {
    const role = await db.role.upsert({
      where: { name: roleName },
      update: { isSystem: true },
      create: { name: roleName, isSystem: true },
    });

    for (const key of keys) {
      const permissionId = permissions.get(key);
      if (!permissionId) throw new Error(`Missing permission seed: ${key}`);

      await db.rolePermission.upsert({
        where: {
          roleId_permissionId: { roleId: role.id, permissionId },
        },
        update: {},
        create: { roleId: role.id, permissionId },
      });
    }
  }
}

async function seedSettings(): Promise<void> {
  for (const setting of settingSeeds) {
    await db.setting.upsert({
      where: { key: setting.key },
      update: { value: setting.value, meta: pdfMeta },
      create: { key: setting.key, value: setting.value, meta: pdfMeta },
    });
  }
}

async function seedCatalogue(): Promise<void> {
  const accommodations = new Map<string, string>();
  for (const accommodation of accommodationSeeds) {
    const row = await db.accommodation.upsert({
      where: { slug: accommodation.slug },
      update: {
        type: accommodation.type,
        name: accommodation.name,
        description: accommodation.description,
        meta: pdfMeta,
      },
      create: { ...accommodation, meta: pdfMeta },
    });
    accommodations.set(accommodation.slug, row.id);
  }

  const packages = new Map<string, string>();
  for (const packageSeed of packageSeeds) {
    const row = await db.package.upsert({
      where: { slug: packageSeed.slug },
      update: { ...packageSeed, meta: pdfMeta },
      create: { ...packageSeed, meta: pdfMeta },
    });
    packages.set(packageSeed.slug, row.id);
  }

  const packageAccommodationMap = [
    ["package-a", "tent"],
    ["package-a", "dormitory"],
    ["package-b", "guest-house"],
    ["package-c", "camp-lawn"],
  ] as const;
  for (const [packageSlug, accommodationSlug] of packageAccommodationMap) {
    const packageId = packages.get(packageSlug);
    const accommodationId = accommodations.get(accommodationSlug);
    if (!packageId || !accommodationId) throw new Error("Missing catalogue relation seed");

    await db.packageAccommodation.upsert({
      where: { packageId_accommodationId: { packageId, accommodationId } },
      update: {},
      create: { packageId, accommodationId },
    });
  }

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

  for (const [packageSlug, foodPreference, audience, amountPaise, percentOfAdult] of rateSeeds) {
    const packageId = packages.get(packageSlug);
    if (!packageId) throw new Error(`Missing package seed: ${packageSlug}`);
    const foodKey = foodPreference ?? "ALL";
    const seedKey = `pkg-${packageSlug.replace("package-", "")}:${foodKey}:${audience}`;
    await db.packageRate.upsert({
      where: { seedKey },
      update: {
        packageId,
        foodPreference,
        audience,
        unit: "PER_PERSON_PER_DAY",
        amountPaise,
        percentOfAdult,
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
        meta: pdfMeta,
      },
    });
  }

  const categories = new Map<string, string>();
  for (const category of menuCategorySeeds) {
    const row = await db.menuCategory.upsert({
      where: { seedKey: category.seedKey },
      update: { slug: category.slug, name: { en: category.name }, meta: pdfMeta },
      create: {
        seedKey: category.seedKey,
        slug: category.slug,
        name: { en: category.name },
        meta: pdfMeta,
      },
    });
    categories.set(category.seedKey, row.id);
  }

  for (const [sortOrder, item] of menuItemSeeds.entries()) {
    const categoryId = categories.get(item.category);
    if (!categoryId) throw new Error(`Missing menu category seed: ${item.category}`);
    const description = "description" in item ? item.description : undefined;
    const foodPreference = "foodPreference" in item ? item.foodPreference : undefined;
    const isExtraCharge = "isExtraCharge" in item ? item.isExtraCharge : false;
    const extraUnitLabel = "extraUnitLabel" in item ? item.extraUnitLabel : undefined;
    await db.menuItem.upsert({
      where: { seedKey: item.seedKey },
      update: {
        categoryId,
        name: { en: item.name },
        description: description ? { en: description } : undefined,
        foodPreference,
        isExtraCharge,
        extraPricePaise: null,
        extraUnitLabel,
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
        sortOrder,
        meta: pdfMeta,
      },
    });
  }

  for (const [sortOrder, activity] of activitySeeds.entries()) {
    const isExtraCost = "isExtraCost" in activity ? activity.isExtraCost : false;
    const needsPriorNotice = "needsPriorNotice" in activity ? activity.needsPriorNotice : false;
    const priceNote = "priceNote" in activity ? activity.priceNote : undefined;
    await db.activity.upsert({
      where: { slug: activity.slug },
      update: {
        name: { en: activity.name },
        isExtraCost,
        needsPriorNotice,
        priceNote: priceNote ? { en: priceNote } : undefined,
        conditionsNote: { en: "Arranged according to prevailing conditions and availability" },
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
        sortOrder,
        meta: pdfMeta,
      },
    });
  }
}

async function seedPoliciesAndRewards(): Promise<void> {
  await db.policyVersion.upsert({
    where: { key_version: { key: "stay-rules-and-cancellation", version: 1 } },
    update: { title: "Stay rules and cancellation policy", body: policyBody, meta: policyMeta },
    create: {
      key: "stay-rules-and-cancellation",
      version: 1,
      title: "Stay rules and cancellation policy",
      body: policyBody,
      meta: policyMeta,
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

async function main(): Promise<void> {
  validateSeedData();
  await seedPermissionsAndRoles();
  await seedSettings();
  await seedCatalogue();
  await seedPoliciesAndRewards();
  console.log("Prisma seed completed: permissions, roles, PDF catalogue, policies, and inactive RewardRule v1.");
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
