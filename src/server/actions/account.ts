"use server";

import { parsePhoneNumberFromString } from "libphonenumber-js";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";

import { Prisma } from "@/generated/prisma/client";
import { err, ok, type Result } from "@/lib/result";
import {
  deletionCancelSchema,
  deletionRequestSchema,
  favouriteDeleteSchema,
  notificationReadSchema,
  profileUpdateSchema,
  redeemPointsSchema,
} from "@/lib/schemas/account";
import { auth, requireUser } from "@/server/auth";
import { db } from "@/server/db";
import { getCustomerIdentity } from "@/server/services/account";
import { audit } from "@/server/services/audit";
import { redeemPoints } from "@/server/services/rewards";
import { withdrawSubmission } from "@/server/services/videoSubmissions";

function requestMetadata(headerList: Headers) {
  const forwarded = headerList.get("x-forwarded-for")?.split(",")[0]?.trim();
  const ip = (forwarded || headerList.get("cf-connecting-ip") || headerList.get("x-real-ip") || "127.0.0.1").slice(0, 128);
  return { ip, userAgent: headerList.get("user-agent")?.slice(0, 512) };
}

async function activeCustomer() {
  const session = await requireUser();
  const identity = await getCustomerIdentity(session.user.id);
  if (!identity || identity.status !== "ACTIVE") return { session, identity: null };
  return { session, identity };
}

export async function updateProfileAction(rawInput: unknown): Promise<Result<{ updated: true }>> {
  const parsed = profileUpdateSchema.safeParse(rawInput);
  if (!parsed.success) return err("VALIDATION", "Please check your profile details.", parsed.error.flatten().fieldErrors);
  const { session, identity } = await activeCustomer();
  if (!identity) return err("FORBIDDEN", "Your account cannot update profile details right now.");

  let phone: string | null = null;
  if (parsed.data.phone) {
    const parsedPhone = parsePhoneNumberFromString(parsed.data.phone, "IN");
    if (!parsedPhone?.isValid()) return err("VALIDATION", "Please enter a valid phone number.", { phone: ["Use a valid phone number with country code."] });
    phone = parsedPhone.number;
  }
  const city = parsed.data.city?.trim() || null;
  const name = parsed.data.name.trim();
  const headerList = await headers();
  const metadata = requestMetadata(headerList);
  try {
    await db.$transaction(async (tx) => {
      await tx.user.update({ where: { id: session.user.id }, data: { name } });
      await tx.customerProfile.upsert({ where: { userId: session.user.id }, create: { userId: session.user.id, referralCode: `CF${session.user.id.replace(/-/g, "").slice(0, 8).toUpperCase()}`, phone, city, marketingConsent: parsed.data.marketingConsent }, update: { phone, city, marketingConsent: parsed.data.marketingConsent } });
      if (identity.profile?.marketingConsent !== parsed.data.marketingConsent) {
        const versionSetting = await tx.setting.findUnique({ where: { key: "policy.marketingConsentVersion" }, select: { value: true } });
        const policyVersion = typeof versionSetting?.value === "string" ? versionSetting.value : null;
        await tx.consentRecord.create({ data: { userId: session.user.id, purpose: "marketing", granted: parsed.data.marketingConsent, policyVersion, ip: metadata.ip, userAgent: metadata.userAgent } });
      }
      await audit({ actor: { id: session.user.id, type: "CUSTOMER" }, action: "account.profile.updated", entityType: "User", entityId: session.user.id, before: { name: identity.name, phone: identity.profile?.phone, city: identity.profile?.city, marketingConsent: identity.profile?.marketingConsent }, after: { name, phone, city, marketingConsent: parsed.data.marketingConsent }, ip: metadata.ip, userAgent: metadata.userAgent }, tx);
    });
  } catch {
    return err("CONFLICT", "Your profile could not be updated. Please try again.");
  }
  revalidatePath("/account");
  revalidatePath("/account/profile");
  return ok({ updated: true });
}

export async function redeemPointsAction(rawInput: unknown): Promise<Result<{ couponId: string }>> {
  const parsed = redeemPointsSchema.safeParse(rawInput);
  if (!parsed.success) return err("VALIDATION", "This redemption request is invalid.");
  const { session, identity } = await activeCustomer();
  if (!identity) return err("FORBIDDEN", "Your account cannot redeem points right now.");
  if (!identity.emailVerified) return err("FORBIDDEN", "Verify your email before redeeming points.");
  const result = await redeemPoints({ userId: session.user.id, tierId: parsed.data.tierId, clientKey: parsed.data.idempotencyKey });
  if (!result.ok) return err(result.error.code === "UNAVAILABLE" ? "REWARDS_DISABLED" : result.error.code, result.error.message);
  const coupon = result.data.coupon;
  if (!coupon || typeof coupon !== "object" || !("id" in coupon) || typeof coupon.id !== "string") return err("INTERNAL", "The coupon could not be issued.");
  revalidatePath("/account");
  revalidatePath("/account/rewards");
  revalidatePath("/account/coupons");
  return ok({ couponId: coupon.id });
}

export async function withdrawVideoAction(rawInput: unknown): Promise<Result<{ submissionId: string }>> {
  const { session, identity } = await activeCustomer();
  if (!identity) return err("FORBIDDEN", "Your account cannot withdraw videos right now.");
  const result = await withdrawSubmission(session.user.id, rawInput);
  if (!result.ok) return result;
  revalidatePath("/account/videos");
  revalidatePath("/account");
  return result;
}

export async function removeFavouriteAction(rawInput: unknown): Promise<Result<{ removed: true }>> {
  const parsed = favouriteDeleteSchema.safeParse(rawInput);
  if (!parsed.success) return err("VALIDATION", "This favourite could not be removed.");
  const { session, identity } = await activeCustomer();
  if (!identity) return err("FORBIDDEN", "Your account cannot update favourites right now.");
  await db.favourite.deleteMany({ where: { userId: session.user.id, entityType: parsed.data.entityType, entityId: parsed.data.entityId } });
  revalidatePath("/account/favourites");
  return ok({ removed: true });
}

export async function markNotificationReadAction(rawInput: unknown): Promise<Result<{ updated: true }>> {
  const parsed = notificationReadSchema.safeParse(rawInput);
  if (!parsed.success) return err("VALIDATION", "This notification could not be updated.");
  const { session, identity } = await activeCustomer();
  if (!identity) return err("FORBIDDEN", "Your account cannot update notifications right now.");
  await db.notification.updateMany({ where: { id: parsed.data.notificationId, userId: session.user.id, readAt: null }, data: { readAt: new Date() } });
  revalidatePath("/account/notifications");
  return ok({ updated: true });
}

export async function markAllNotificationsReadAction(): Promise<Result<{ updated: true }>> {
  const { session, identity } = await activeCustomer();
  if (!identity) return err("FORBIDDEN", "Your account cannot update notifications right now.");
  await db.notification.updateMany({ where: { userId: session.user.id, readAt: null }, data: { readAt: new Date() } });
  revalidatePath("/account/notifications");
  return ok({ updated: true });
}

async function hasFreshSession(headerList: Headers): Promise<boolean> {
  try {
    await auth.api.listSessions({ headers: headerList });
    return true;
  } catch {
    return false;
  }
}

export async function requestAccountDeletionAction(rawInput: unknown): Promise<Result<{ requestId: string }>> {
  const parsed = deletionRequestSchema.safeParse(rawInput);
  if (!parsed.success) return err("VALIDATION", "Please check the deletion request.", parsed.error.flatten().fieldErrors);
  const session = await requireUser();
  const identity = await getCustomerIdentity(session.user.id);
  if (!identity || identity.status !== "ACTIVE") return err("FORBIDDEN", "Your account cannot request deletion right now.");
  const headerList = await headers();
  const metadata = requestMetadata(headerList);
  const fresh = await hasFreshSession(headerList);
  if (!fresh && !parsed.data.password) return err("FORBIDDEN", "Re-enter your password or sign in again before requesting deletion.");
  if (!fresh && parsed.data.password) {
    try {
      await auth.api.verifyPassword({ body: { password: parsed.data.password }, headers: headerList });
    } catch {
      return err("FORBIDDEN", "The password could not be verified.");
    }
  }
  try {
    const request = await db.accountDeletionRequest.create({ data: { userId: session.user.id, reasonText: parsed.data.reasonText?.trim() || null } });
    await audit({ actor: { id: session.user.id, type: "CUSTOMER" }, action: "account.deletion.requested", entityType: "AccountDeletionRequest", entityId: request.id, after: { status: request.status, reasonText: request.reasonText }, ip: metadata.ip, userAgent: metadata.userAgent });
    revalidatePath("/account/privacy");
    return ok({ requestId: request.id });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") return err("CONFLICT", "You already have a pending deletion request.");
    return err("CONFLICT", "The deletion request could not be created.");
  }
}

export async function cancelAccountDeletionAction(rawInput: unknown): Promise<Result<{ cancelled: true }>> {
  const parsed = deletionCancelSchema.safeParse(rawInput);
  if (!parsed.success) return err("VALIDATION", "This deletion request is invalid.");
  const { session, identity } = await activeCustomer();
  if (!identity) return err("FORBIDDEN", "Your account cannot cancel deletion right now.");
  const headerList = await headers();
  const metadata = requestMetadata(headerList);
  const updated = await db.accountDeletionRequest.updateMany({ where: { id: parsed.data.requestId, userId: session.user.id, status: "PENDING" }, data: { status: "CANCELLED", decidedAt: new Date(), decisionNote: "Cancelled by customer." } });
  if (updated.count !== 1) return err("NOT_FOUND", "The pending deletion request was not found.");
  await audit({ actor: { id: session.user.id, type: "CUSTOMER" }, action: "account.deletion.cancelled", entityType: "AccountDeletionRequest", entityId: parsed.data.requestId, after: { status: "CANCELLED" }, ip: metadata.ip, userAgent: metadata.userAgent });
  revalidatePath("/account/privacy");
  return ok({ cancelled: true });
}
