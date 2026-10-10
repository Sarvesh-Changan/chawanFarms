"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { headers } from "next/headers";

import { CMS_MUTATION_RATE_LIMIT } from "@/config/cms";
import { err, ok, type Result } from "@/lib/result";
import { accommodationFormSchema } from "@/lib/schemas/cms/accommodation";
import { entityReferenceSchema, publishInputSchema, reorderInputSchema } from "@/lib/schemas/cms/common";
import { packageFormSchema, packageRateFormSchema } from "@/lib/schemas/cms/package";
import { settingsFormSchema } from "@/lib/schemas/cms/settings";
import { requirePermission } from "@/server/authz";
import { AuthorizationError } from "@/server/authz/errors";
import type { Permission } from "@/server/authz/permissions";
import { limit } from "@/server/integrations/ratelimit";
import { audit } from "@/server/services/audit";
import { getAccommodationForEditor, saveAccommodation } from "@/server/services/cms/accommodations";
import { getCmsEntity, reorderCmsEntity, restoreCmsEntity, softDeleteCmsEntity, updateCmsEntityStatus } from "@/server/services/cms/entities";
import { createPackageRate, getPackageForEditor, savePackage } from "@/server/services/cms/packages";
import { getCmsSettings, saveCmsSettings } from "@/server/services/cms/settings";
import type { CmsEntityType } from "@/server/services/cms/types";

type MutationContext = { actorId: string; ip?: string; userAgent?: string; requestId?: string };

function clientIp(value: string | null): string {
  return (value?.split(",")[0]?.trim() || "unknown").slice(0, 128).replace(/[^a-zA-Z0-9:._-]/g, "_");
}

async function beginMutation(action: string, permission: Permission): Promise<Result<MutationContext>> {
  const requestHeaders = await headers();
  const ip = clientIp(requestHeaders.get("cf-connecting-ip") ?? requestHeaders.get("x-forwarded-for"));
  try {
    const ipRate = await limit(`cms:${action}:ip:${ip}`, CMS_MUTATION_RATE_LIMIT.max, CMS_MUTATION_RATE_LIMIT.windowSeconds);
    if (!ipRate.allowed) return err("RATE_LIMITED", "Too many admin changes. Try again later.");
  } catch {
    return err("UNAVAILABLE", "CMS changes are temporarily unavailable.");
  }

  let actorId: string;
  try {
    const principal = await requirePermission(permission);
    if (!("id" in principal)) return err("FORBIDDEN", "Staff permission required.");
    actorId = principal.id;
  } catch (error) {
    return error instanceof AuthorizationError && error.code === "UNAUTHENTICATED"
      ? err("UNAUTHENTICATED", "Please sign in to continue.")
      : err("FORBIDDEN", "You do not have permission to make this change.");
  }

  try {
    const userRate = await limit(`cms:${action}:staff:${actorId}`, CMS_MUTATION_RATE_LIMIT.max, CMS_MUTATION_RATE_LIMIT.windowSeconds);
    if (!userRate.allowed) return err("RATE_LIMITED", "Too many admin changes. Try again later.");
  } catch {
    return err("UNAVAILABLE", "CMS changes are temporarily unavailable.");
  }
  return ok({
    actorId,
    ip,
    userAgent: requestHeaders.get("user-agent")?.slice(0, 512),
    requestId: requestHeaders.get("x-request-id")?.slice(0, 128) ?? undefined,
  });
}

async function completeMutation(input: {
  context: MutationContext;
  action: string;
  entityType: string;
  entityId: string;
  before: unknown;
  after: unknown;
  tags: string[];
  paths: string[];
}): Promise<Result<{ id: string }>> {
  const auditResult = await audit({
    actor: { id: input.context.actorId, type: "STAFF" },
    action: input.action,
    entityType: input.entityType,
    entityId: input.entityId,
    before: input.before,
    after: input.after,
    ip: input.context.ip,
    userAgent: input.context.userAgent,
    requestId: input.context.requestId,
  });
  for (const tag of input.tags) revalidateTag(tag, "max");
  for (const path of input.paths) revalidatePath(path);
  return auditResult.ok ? ok({ id: input.entityId }) : auditResult;
}

function entityTag(type: CmsEntityType, slug?: string): string {
  const collection = type === "package" ? "packages" : "accommodations";
  return slug ? `cms:${type}:${slug}` : `cms:${collection}`;
}

function listPath(type: CmsEntityType): string {
  return type === "package" ? "/admin/cms/packages" : "/admin/cms/accommodations";
}

export async function savePackageAction(rawInput: unknown): Promise<Result<{ id: string }>> {
  const started = await beginMutation("package.save", "cms.write");
  if (!started.ok) return started;
  const parsed = packageFormSchema.safeParse(rawInput);
  if (!parsed.success) return err("VALIDATION", "Please review the package fields.", parsed.error.flatten().fieldErrors);
  try {
    const before = parsed.data.id ? await getPackageForEditor(parsed.data.id) : null;
    const saved = await savePackage(parsed.data);
    const auditResult = await completeMutation({
      context: started.data,
      action: before ? "cms.package.update" : "cms.package.create",
      entityType: "Package",
      entityId: saved.id,
      before,
      after: saved,
      tags: [entityTag("package"), ...(before?.slug ? [entityTag("package", before.slug)] : []), entityTag("package", saved.slug)],
      paths: [listPath("package"), "/admin/cms"],
    });
    return auditResult.ok ? ok({ id: saved.id }) : auditResult;
  } catch {
    return err("CONFLICT", "The package could not be saved. Check for a duplicate slug or linked record.");
  }
}

export async function saveAccommodationAction(rawInput: unknown): Promise<Result<{ id: string }>> {
  const started = await beginMutation("accommodation.save", "cms.write");
  if (!started.ok) return started;
  const parsed = accommodationFormSchema.safeParse(rawInput);
  if (!parsed.success) return err("VALIDATION", "Please review the accommodation fields.", parsed.error.flatten().fieldErrors);
  try {
    const before = parsed.data.id ? await getAccommodationForEditor(parsed.data.id) : null;
    const saved = await saveAccommodation(parsed.data);
    const auditResult = await completeMutation({
      context: started.data,
      action: before ? "cms.accommodation.update" : "cms.accommodation.create",
      entityType: "Accommodation",
      entityId: saved.id,
      before,
      after: saved,
      tags: [entityTag("accommodation"), ...(before?.slug ? [entityTag("accommodation", before.slug)] : []), entityTag("accommodation", saved.slug)],
      paths: [listPath("accommodation"), "/admin/cms"],
    });
    return auditResult.ok ? ok({ id: saved.id }) : auditResult;
  } catch {
    return err("CONFLICT", "The accommodation could not be saved. Check for a duplicate slug.");
  }
}

export async function createPackageRateAction(rawInput: unknown): Promise<Result<{ id: string }>> {
  const started = await beginMutation("package.rate", "cms.write");
  if (!started.ok) return started;
  const parsed = packageRateFormSchema.safeParse(rawInput);
  if (!parsed.success) return err("VALIDATION", "Please review the package rate fields.", parsed.error.flatten().fieldErrors);
  try {
    const before = await getPackageForEditor(parsed.data.packageId);
    if (!before || before.deletedAt) return err("NOT_FOUND", "Package not found.");
    const created = await createPackageRate(parsed.data);
    const after = await getPackageForEditor(parsed.data.packageId);
    const auditResult = await completeMutation({
      context: started.data,
      action: "cms.package.rate.create",
      entityType: "PackageRate",
      entityId: created.id,
      before: { package: before, rates: before.rates },
      after: { packageId: before.id, newRate: created, rates: after?.rates },
      tags: [entityTag("package"), entityTag("package", before.slug)],
      paths: [listPath("package"), `/admin/cms/packages/${before.id}`],
    });
    return auditResult.ok ? ok({ id: created.id }) : auditResult;
  } catch {
    return err("CONFLICT", "The new rate could not be created. Check for a conflicting validity date.");
  }
}

export async function changeCmsPublishStatusAction(rawInput: unknown): Promise<Result<{ id: string }>> {
  const started = await beginMutation("cms.publish-state", "cms.publish");
  if (!started.ok) return started;
  const parsed = publishInputSchema.safeParse(rawInput);
  if (!parsed.success) return err("VALIDATION", "Please review the publish settings.", parsed.error.flatten().fieldErrors);
  try {
    const before = await getCmsEntity(parsed.data.entityType, parsed.data.id);
    if (!before || before.deletedAt) return err("NOT_FOUND", "CMS item not found.");
    const saved = await updateCmsEntityStatus({
      entityType: parsed.data.entityType,
      id: parsed.data.id,
      status: parsed.data.status,
      publishAt: parsed.data.publishAt ? new Date(parsed.data.publishAt) : null,
    });
    const slug = before.slug;
    const auditResult = await completeMutation({
      context: started.data,
      action: `cms.${parsed.data.entityType}.status.${parsed.data.status.toLowerCase()}`,
      entityType: parsed.data.entityType === "package" ? "Package" : "Accommodation",
      entityId: saved.id,
      before,
      after: saved,
      tags: [entityTag(parsed.data.entityType), entityTag(parsed.data.entityType, slug)],
      paths: [listPath(parsed.data.entityType), "/admin/cms"],
    });
    return auditResult.ok ? ok({ id: saved.id }) : auditResult;
  } catch {
    return err("NOT_FOUND", "CMS item not found.");
  }
}

export async function softDeleteCmsEntityAction(rawInput: unknown): Promise<Result<{ id: string }>> {
  const started = await beginMutation("cms.delete", "cms.delete");
  if (!started.ok) return started;
  const parsed = entityReferenceSchema.safeParse(rawInput);
  if (!parsed.success) return err("VALIDATION", "Invalid CMS item.");
  try {
    const before = await getCmsEntity(parsed.data.entityType, parsed.data.id);
    if (!before || before.deletedAt) return err("NOT_FOUND", "CMS item not found.");
    const saved = await softDeleteCmsEntity(parsed.data.entityType, parsed.data.id);
    const auditResult = await completeMutation({
      context: started.data,
      action: `cms.${parsed.data.entityType}.soft_delete`,
      entityType: parsed.data.entityType === "package" ? "Package" : "Accommodation",
      entityId: saved.id,
      before,
      after: saved,
      tags: [entityTag(parsed.data.entityType), entityTag(parsed.data.entityType, before.slug)],
      paths: [listPath(parsed.data.entityType), `${listPath(parsed.data.entityType)}/trash`],
    });
    return auditResult.ok ? ok({ id: saved.id }) : auditResult;
  } catch {
    return err("NOT_FOUND", "CMS item not found.");
  }
}

export async function restoreCmsEntityAction(rawInput: unknown): Promise<Result<{ id: string }>> {
  const started = await beginMutation("cms.restore", "cms.write");
  if (!started.ok) return started;
  const parsed = entityReferenceSchema.safeParse(rawInput);
  if (!parsed.success) return err("VALIDATION", "Invalid CMS item.");
  try {
    const before = await getCmsEntity(parsed.data.entityType, parsed.data.id);
    if (!before || !before.deletedAt) return err("NOT_FOUND", "Trashed CMS item not found.");
    const saved = await restoreCmsEntity(parsed.data.entityType, parsed.data.id);
    const auditResult = await completeMutation({
      context: started.data,
      action: `cms.${parsed.data.entityType}.restore`,
      entityType: parsed.data.entityType === "package" ? "Package" : "Accommodation",
      entityId: saved.id,
      before,
      after: saved,
      tags: [entityTag(parsed.data.entityType), entityTag(parsed.data.entityType, before.slug)],
      paths: [listPath(parsed.data.entityType), `${listPath(parsed.data.entityType)}/trash`],
    });
    return auditResult.ok ? ok({ id: saved.id }) : auditResult;
  } catch {
    return err("NOT_FOUND", "Trashed CMS item not found.");
  }
}

export async function reorderCmsEntityAction(rawInput: unknown): Promise<Result<{ id: string }>> {
  const started = await beginMutation("cms.reorder", "cms.write");
  if (!started.ok) return started;
  const parsed = reorderInputSchema.safeParse(rawInput);
  if (!parsed.success) return err("VALIDATION", "Invalid reordering request.");
  try {
    const before = await getCmsEntity(parsed.data.entityType, parsed.data.id);
    if (!before || before.deletedAt) return err("NOT_FOUND", "CMS item not found.");
    const change = await reorderCmsEntity(parsed.data.entityType, parsed.data.id, parsed.data.direction);
    const after = await getCmsEntity(parsed.data.entityType, parsed.data.id);
    const auditResult = await completeMutation({
      context: started.data,
      action: `cms.${parsed.data.entityType}.reorder`,
      entityType: parsed.data.entityType === "package" ? "Package" : "Accommodation",
      entityId: parsed.data.id,
      before,
      after: { entity: after, change },
      tags: [entityTag(parsed.data.entityType)],
      paths: [listPath(parsed.data.entityType)],
    });
    return auditResult.ok ? ok({ id: parsed.data.id }) : auditResult;
  } catch {
    return err("CONFLICT", "The CMS item could not be reordered.");
  }
}

export async function saveCmsSettingsAction(rawInput: unknown): Promise<Result<{ id: string }>> {
  const started = await beginMutation("settings.save", "settings.write");
  if (!started.ok) return started;
  const parsed = settingsFormSchema.safeParse(rawInput);
  if (!parsed.success) return err("VALIDATION", "Please review the settings fields.", parsed.error.flatten().fieldErrors);
  try {
    const before = await getCmsSettings();
    const updated = await saveCmsSettings(parsed.data, started.data.actorId);
    const auditResult = await completeMutation({
      context: started.data,
      action: "settings.update",
      entityType: "Setting",
      entityId: "business-and-booking",
      before,
      after: parsed.data,
      tags: ["cms:settings"],
      paths: ["/admin/settings", "/", "/about", "/packages", "/book", "/contact"],
    });
    return auditResult.ok ? ok({ id: updated.updatedKeys.join(",") }) : auditResult;
  } catch {
    return err("INTERNAL", "Settings could not be saved.");
  }
}
