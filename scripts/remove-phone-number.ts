/* eslint-disable security/detect-object-injection */
import { PrismaPg } from "@prisma/adapter-pg";
import { config as loadEnv } from "dotenv";

import { Prisma, PrismaClient } from "../src/generated/prisma/client";

loadEnv({ path: ".env.local" });
loadEnv();

const blockedPhone = String.fromCharCode(57, 56, 50, 49, 48, 56, 57, 51, 55, 53);
const args = new Set(process.argv.slice(2));
const apply = args.has("--apply");
const allowProduction = args.has("--i-know-this-is-production");

function digits(value: string) {
  return value.replace(/\D/g, "");
}

function containsBlockedPhone(value: unknown): boolean {
  if (typeof value === "string") return digits(value).includes(blockedPhone);
  if (Array.isArray(value)) return value.some(containsBlockedPhone);
  if (value && typeof value === "object") return Object.values(value).some(containsBlockedPhone);
  return false;
}

function phoneNumber(value: unknown): string | null {
  if (typeof value === "string") return value;
  if (value && typeof value === "object" && !Array.isArray(value) && "number" in value && typeof value.number === "string") return value.number;
  return null;
}

const dbUrl = process.env.DATABASE_URL;
if (!dbUrl) throw new Error("DATABASE_URL is required. Load the intended environment before running this script.");
const isProduction = process.env.APP_ENV === "production" || process.env.NODE_ENV === "production";
if (apply && isProduction && !allowProduction) throw new Error("Refusing a production update. Pass --i-know-this-is-production only after creating a Neon backup branch.");
if (apply && (!process.env.CRON_SECRET || !process.env.NEXT_PUBLIC_SITE_URL)) throw new Error("Applying requires CRON_SECRET and NEXT_PUBLIC_SITE_URL so public cache tags can be revalidated after the transaction.");

const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: dbUrl }) });

async function scanTableCounts() {
  return db.$queryRaw<Array<{ table_name: string; match_count: number }>>`
    SELECT 'Setting' AS table_name, COUNT(*)::int AS match_count FROM "Setting" AS t WHERE regexp_replace(to_jsonb(t)::text, '[^0-9]', '', 'g') LIKE '%' || ${blockedPhone} || '%'
    UNION ALL SELECT 'Lead', COUNT(*)::int FROM "Lead" AS t WHERE regexp_replace(to_jsonb(t)::text, '[^0-9]', '', 'g') LIKE '%' || ${blockedPhone} || '%'
    UNION ALL SELECT 'CustomerProfile', COUNT(*)::int FROM "CustomerProfile" AS t WHERE regexp_replace(to_jsonb(t)::text, '[^0-9]', '', 'g') LIKE '%' || ${blockedPhone} || '%'
    UNION ALL SELECT 'Booking', COUNT(*)::int FROM "Booking" AS t WHERE regexp_replace(to_jsonb(t)::text, '[^0-9]', '', 'g') LIKE '%' || ${blockedPhone} || '%'
    UNION ALL SELECT 'Enquiry', COUNT(*)::int FROM "Enquiry" AS t WHERE regexp_replace(to_jsonb(t)::text, '[^0-9]', '', 'g') LIKE '%' || ${blockedPhone} || '%'
    UNION ALL SELECT 'LeadEvent', COUNT(*)::int FROM "LeadEvent" AS t WHERE regexp_replace(to_jsonb(t)::text, '[^0-9]', '', 'g') LIKE '%' || ${blockedPhone} || '%'
    UNION ALL SELECT 'BookingLine', COUNT(*)::int FROM "BookingLine" AS t WHERE regexp_replace(to_jsonb(t)::text, '[^0-9]', '', 'g') LIKE '%' || ${blockedPhone} || '%'
    UNION ALL SELECT 'NotificationOutbox', COUNT(*)::int FROM "NotificationOutbox" AS t WHERE regexp_replace(to_jsonb(t)::text, '[^0-9]', '', 'g') LIKE '%' || ${blockedPhone} || '%'
    UNION ALL SELECT 'Notification', COUNT(*)::int FROM "Notification" AS t WHERE regexp_replace(to_jsonb(t)::text, '[^0-9]', '', 'g') LIKE '%' || ${blockedPhone} || '%'
    UNION ALL SELECT 'AuditLog', COUNT(*)::int FROM "AuditLog" AS t WHERE regexp_replace(to_jsonb(t)::text, '[^0-9]', '', 'g') LIKE '%' || ${blockedPhone} || '%'
  `;
}

async function revalidatePublicCaches() {
  const endpoint = new URL("/api/admin/revalidate-settings", process.env.NEXT_PUBLIC_SITE_URL);
  const response = await fetch(endpoint, {
    method: "POST",
    headers: { authorization: `Bearer ${process.env.CRON_SECRET}` },
  });
  if (!response.ok) throw new Error(`Cache revalidation failed with HTTP ${response.status}. Re-run the apply command after the service is available.`);
}

async function main() {
  const rows = await db.setting.findMany({ select: { key: true, value: true } });
  const matches = rows.filter((row) => containsBlockedPhone(row.value));
  const phoneSetting = rows.find((row) => row.key === "business.phones");
  const originalPhones = Array.isArray(phoneSetting?.value) ? phoneSetting.value : [];
  const remainingPhones = originalPhones.filter((entry) => !containsBlockedPhone(entry));
  const originalPrimary = originalPhones.findIndex((entry) => Boolean(entry && typeof entry === "object" && !Array.isArray(entry) && "isPrimary" in entry && entry.isPrimary === true));
  const retainedPrimary = remainingPhones.findIndex((entry) => Boolean(entry && typeof entry === "object" && !Array.isArray(entry) && "isPrimary" in entry && entry.isPrimary === true));
  const primaryIndex = remainingPhones.length ? retainedPrimary >= 0 ? retainedPrimary : Math.min(Math.max(originalPrimary, 0), remainingPhones.length - 1) : -1;
  const fixedPhones = remainingPhones.map((entry, index) => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry) || !("number" in entry)) return entry;
    return { ...entry, isPrimary: index === primaryIndex };
  });
  const phoneChanged = matches.some((row) => row.key === "business.phones") && JSON.stringify(fixedPhones) !== JSON.stringify(originalPhones);
  const whatsappSetting = rows.find((row) => row.key === "whatsapp.number");
  const whatsappChanged = Boolean(whatsappSetting && containsBlockedPhone(whatsappSetting.value));
  const otherRows = matches.filter((row) => row.key !== "business.phones" && row.key !== "whatsapp.number");
  const tableCounts = await scanTableCounts();

  console.log(`Mode: ${apply ? "APPLY" : "DRY RUN"}`);
  console.log(`Matching Setting rows: ${matches.length}`);
  for (const row of matches) console.log(`  Setting key ${row.key}: ${row.key === "business.phones" ? "remove matching phone and reset primary index" : row.key === "whatsapp.number" ? "replace with first remaining business phone, or clear if none remain" : "reported only; no automatic change"}`);
  console.log(`Business phones remaining after cleanup: ${remainingPhones.length}`);
  console.log(`Other matching Setting rows left unchanged: ${otherRows.length}`);
  console.log("Other table matches (counts only; historical/contact records are not altered):");
  for (const row of tableCounts.filter((entry) => entry.table_name !== "Setting")) console.log(`  ${row.table_name}: ${row.match_count}`);
  if (!apply) return;

  const primaryPhone = phoneNumber(remainingPhones[primaryIndex]);
  const changed = phoneChanged || whatsappChanged;
  if (changed) {
    await db.$transaction(async (tx) => {
      if (phoneChanged && phoneSetting) {
        await tx.setting.update({ where: { key: "business.phones" }, data: { value: fixedPhones as Prisma.InputJsonValue } });
      }
      if (whatsappChanged && whatsappSetting) {
        await tx.setting.update({ where: { key: "whatsapp.number" }, data: { value: primaryPhone ?? Prisma.JsonNull } });
      }
      await tx.auditLog.create({
        data: {
          actorType: "SYSTEM",
          action: "content.business_phone_removed",
          entityType: "Setting",
          entityId: "business.phones",
          before: { matchingSettingRows: matches.length, businessPhoneCount: originalPhones.length },
          after: { businessPhoneCount: remainingPhones.length, primaryIndex, whatsappReassigned: whatsappChanged },
        }
      });
    }, { isolationLevel: "Serializable" });
  }
  await revalidatePublicCaches();
  console.log(`Applied. Setting rows changed: ${Number(phoneChanged) + Number(whatsappChanged)}; audit entries written: ${Number(changed)}; cache tags revalidated: 2.`);
}

main()
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : "Phone cleanup failed.");
    process.exitCode = 1;
  })
  .finally(async () => db.$disconnect());
