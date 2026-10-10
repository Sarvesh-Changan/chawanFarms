"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";

import { err, ok, type Result } from "@/lib/result";
import {
  addLeadNoteSchema, bulkLeadActionSchema, deleteLeadFilterSchema, saveLeadFilterSchema,
  updateLeadAssignmentSchema, updateLeadFollowUpSchema, updateLeadStatusSchema,
} from "@/lib/schemas/leads-crm";
import { can, requirePermission } from "@/server/authz";
import { AuthorizationError } from "@/server/authz/errors";
import { audit } from "@/server/services/audit";
import { LeadCrmError, addLeadNote, changeLeadStatus, deleteSavedLeadFilter, saveLeadFilter, setLeadAssignment, setLeadFollowUp, type LeadActor } from "@/server/services/leads-crm";

type Gate = { actor: LeadActor; userAgent?: string; ip?: string; requestId?: string };

async function authorize(permission: "leads.read" | "leads.write" | "leads.assign"): Promise<Result<Gate>> {
  try {
    const principal = await requirePermission(permission);
    if (!("id" in principal)) return err("FORBIDDEN", "Staff permission required.");
    const requestHeaders = await headers();
    const canAssign = await can(principal, "leads.assign");
    return ok({ actor: { id: principal.id, canAssign }, ip: (requestHeaders.get("cf-connecting-ip") ?? requestHeaders.get("x-forwarded-for") ?? undefined)?.split(",")[0]?.trim().slice(0, 128), userAgent: requestHeaders.get("user-agent")?.slice(0, 512), requestId: requestHeaders.get("x-request-id")?.slice(0, 128) });
  } catch (error) {
    if (error instanceof AuthorizationError) return err(error.code, error.message);
    return err("UNAVAILABLE", "Lead tools are temporarily unavailable.");
  }
}

async function assignmentGate(): Promise<Result<Gate>> {
  const write = await authorize("leads.write");
  return write.ok ? write : authorize("leads.assign");
}

async function log(gate: Gate, action: string, entityType: string, entityId: string, before: unknown, after: unknown): Promise<Result<{ id: string }>> {
  return audit({ actor: { id: gate.actor.id, type: "STAFF" }, action, entityType, entityId, before, after, ip: gate.ip, userAgent: gate.userAgent, requestId: gate.requestId });
}

function asError(error: unknown): Result<never> {
  if (error instanceof LeadCrmError) return err(error.code, error.message);
  return err("UNAVAILABLE", "The lead could not be updated. Please try again.");
}

function refreshLeadViews(leadId?: string) {
  revalidatePath("/admin/leads");
  if (leadId) revalidatePath(`/admin/leads/${leadId}`);
}

export async function updateLeadStatusAction(raw: unknown): Promise<Result<{ updated: true }>> {
  const access = await authorize("leads.write");
  if (!access.ok) return access;
  const parsed = updateLeadStatusSchema.safeParse(raw);
  if (!parsed.success) return err("VALIDATION", "Please review the status fields.", parsed.error.flatten().fieldErrors);
  try {
    const changed = await changeLeadStatus(parsed.data, access.data.actor);
    const logged = await log(access.data, "lead.status.change", "Lead", parsed.data.leadId, changed.before, changed.after);
    if (!logged.ok) return logged;
    refreshLeadViews(parsed.data.leadId);
    return ok({ updated: true });
  } catch (error) { return asError(error); }
}

export async function addLeadNoteAction(raw: unknown): Promise<Result<{ id: string }>> {
  const access = await authorize("leads.write");
  if (!access.ok) return access;
  const parsed = addLeadNoteSchema.safeParse(raw);
  if (!parsed.success) return err("VALIDATION", "Enter a valid internal note.", parsed.error.flatten().fieldErrors);
  try {
    const note = await addLeadNote(parsed.data, access.data.actor);
    const logged = await log(access.data, "lead.note.add", "Lead", parsed.data.leadId, null, { noteId: note.id, bodyLength: note.body.length });
    if (!logged.ok) return logged;
    refreshLeadViews(parsed.data.leadId);
    return ok({ id: note.id });
  } catch (error) { return asError(error); }
}

export async function updateLeadFollowUpAction(raw: unknown): Promise<Result<{ updated: true }>> {
  const access = await authorize("leads.write");
  if (!access.ok) return access;
  const parsed = updateLeadFollowUpSchema.safeParse(raw);
  if (!parsed.success) return err("VALIDATION", "Choose a valid follow-up date.", parsed.error.flatten().fieldErrors);
  try {
    const changed = await setLeadFollowUp(parsed.data, access.data.actor);
    const logged = await log(access.data, "lead.follow_up.change", "Lead", parsed.data.leadId, changed.before, changed.after.followUpAt);
    if (!logged.ok) return logged;
    refreshLeadViews(parsed.data.leadId);
    return ok({ updated: true });
  } catch (error) { return asError(error); }
}

export async function updateLeadAssignmentAction(raw: unknown): Promise<Result<{ updated: true }>> {
  const access = await assignmentGate();
  if (!access.ok) return access;
  const parsed = updateLeadAssignmentSchema.safeParse(raw);
  if (!parsed.success) return err("VALIDATION", "Choose an active staff member.", parsed.error.flatten().fieldErrors);
  try {
    const changed = await setLeadAssignment(parsed.data, access.data.actor);
    const logged = await log(access.data, "lead.assignment.change", "Lead", parsed.data.leadId, { assignedToId: changed.before }, changed.after);
    if (!logged.ok) return logged;
    refreshLeadViews(parsed.data.leadId);
    return ok({ updated: true });
  } catch (error) { return asError(error); }
}

export async function bulkLeadAction(raw: unknown): Promise<Result<{ updated: number; skipped: number; reasons: string[] }>> {
  const access = await assignmentGate();
  if (!access.ok) return access;
  const parsed = bulkLeadActionSchema.safeParse(raw);
  if (!parsed.success) return err("VALIDATION", "Review the bulk action.", parsed.error.flatten().fieldErrors);
  if (parsed.data.kind === "status" && !(await can({ id: access.data.actor.id }, "leads.write"))) return err("FORBIDDEN", "You do not have permission to change lead status.");
  let updated = 0;
  const reasons = new Map<string, number>();
  for (const leadId of parsed.data.leadIds) {
    try {
      if (parsed.data.kind === "assign") {
        const changed = await setLeadAssignment({ leadId, assignedToId: parsed.data.assignedToId === undefined ? null : parsed.data.assignedToId }, access.data.actor);
        const logged = await log(access.data, "lead.bulk.assignment", "Lead", leadId, { assignedToId: changed.before }, changed.after);
        if (!logged.ok) throw new LeadCrmError("UNAVAILABLE", "Audit logging failed.");
      } else {
        const nextStatus = parsed.data.status;
        if (!nextStatus) throw new LeadCrmError("VALIDATION", "Choose a status.");
        const changed = await changeLeadStatus({ leadId, status: nextStatus, closeReason: parsed.data.closeReason, note: parsed.data.note }, access.data.actor);
        const logged = await log(access.data, "lead.bulk.status", "Lead", leadId, changed.before, changed.after);
        if (!logged.ok) throw new LeadCrmError("UNAVAILABLE", "Audit logging failed.");
      }
      updated += 1;
    } catch (error) {
      const reason = error instanceof LeadCrmError ? error.message : "Update failed.";
      reasons.set(reason, (reasons.get(reason) ?? 0) + 1);
    }
  }
  refreshLeadViews();
  return ok({ updated, skipped: parsed.data.leadIds.length - updated, reasons: [...reasons].map(([reason, count]) => `${count} skipped: ${reason}`) });
}

export async function saveLeadFilterAction(raw: unknown): Promise<Result<{ id: string }>> {
  const access = await authorize("leads.read");
  if (!access.ok) return access;
  const parsed = saveLeadFilterSchema.safeParse(raw);
  if (!parsed.success) return err("VALIDATION", "Enter a valid saved filter.", parsed.error.flatten().fieldErrors);
  try {
    const saved = await saveLeadFilter(parsed.data, access.data.actor.id);
    const logged = await log(access.data, "lead.filter.save", "SavedFilter", saved.id, null, { name: saved.name, scope: "leads" });
    return logged.ok ? ok({ id: saved.id }) : logged;
  } catch (error) { return asError(error); }
}

export async function deleteLeadFilterAction(raw: unknown): Promise<Result<{ deleted: true }>> {
  const access = await authorize("leads.read");
  if (!access.ok) return access;
  const parsed = deleteLeadFilterSchema.safeParse(raw);
  if (!parsed.success) return err("VALIDATION", "Invalid saved filter.", parsed.error.flatten().fieldErrors);
  let deleted: boolean;
  try { deleted = await deleteSavedLeadFilter(parsed.data.id, access.data.actor.id); }
  catch { return err("UNAVAILABLE", "The saved filter could not be deleted."); }
  if (!deleted) return err("NOT_FOUND", "Saved filter not found.");
  const logged = await log(access.data, "lead.filter.delete", "SavedFilter", parsed.data.id, { scope: "leads" }, null);
  return logged.ok ? ok({ deleted: true }) : logged;
}
