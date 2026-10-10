import { z } from "zod";

const uuid = z.string().uuid();
const leadStatus = z.enum(["NEW", "CONTACTED", "QUALIFIED", "CONVERTED", "CLOSED"]);
const closeReason = z.enum(["LOST", "DUPLICATE", "SPAM", "NOT_INTERESTED", "NO_RESPONSE"]);
const date = z.preprocess((value) => value === "" ? undefined : value, z.string().date().optional());
const assignee = z.preprocess((value) => value === "" ? undefined : value, z.union([uuid, z.literal("unassigned")]).optional());
const booleanQuery = z.preprocess((value) => value === "true" || value === "1" ? true : value === "false" || value === "0" ? false : value, z.boolean().default(false));

export const leadFilterSchema = z.object({
  status: z.array(leadStatus).max(5).default([]),
  source: z.array(z.string().trim().min(1).max(80)).max(50).default([]),
  assigneeId: assignee,
  dateFrom: date,
  dateTo: date,
  followUpDue: z.boolean().default(false),
  search: z.string().trim().max(100).default(""),
}).strict().superRefine((filters, context) => {
  if (filters.dateFrom && filters.dateTo && filters.dateFrom > filters.dateTo) {
    context.addIssue({ code: "custom", path: ["dateTo"], message: "End date must not precede start date." });
  }
  if (new Set(filters.status).size !== filters.status.length) context.addIssue({ code: "custom", path: ["status"], message: "Duplicate statuses are not allowed." });
  if (new Set(filters.source).size !== filters.source.length) context.addIssue({ code: "custom", path: ["source"], message: "Duplicate sources are not allowed." });
});

export const saveLeadFilterSchema = z.object({
  name: z.string().trim().min(1).max(60),
  filters: leadFilterSchema,
}).strict();

export const deleteLeadFilterSchema = z.object({ id: uuid }).strict();

export const leadListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
  search: z.string().trim().max(100).default(""),
  status: z.union([leadStatus, z.array(leadStatus)]).optional().transform((value) => value === undefined ? [] : Array.isArray(value) ? value : [value]),
  source: z.union([z.string().trim().min(1).max(80), z.array(z.string().trim().min(1).max(80))]).optional().transform((value) => value === undefined ? [] : Array.isArray(value) ? value : [value]),
  assigneeId: assignee,
  dateFrom: date,
  dateTo: date,
  followUpDue: booleanQuery,
  view: z.enum(["list", "kanban"]).default("list"),
  filterId: uuid.optional(),
  sort: z.enum(["name", "status", "createdAt", "followUpAt", "source"]).default("createdAt"),
  direction: z.enum(["asc", "desc"]).default("desc"),
}).strict().superRefine((query, context) => {
  if (query.dateFrom && query.dateTo && query.dateFrom > query.dateTo) context.addIssue({ code: "custom", path: ["dateTo"], message: "End date must not precede start date." });
});

export const updateLeadStatusSchema = z.object({
  leadId: uuid,
  status: leadStatus,
  closeReason: closeReason.optional(),
  note: z.string().trim().max(2_000).optional(),
}).strict().superRefine((input, context) => {
  if (input.status === "CLOSED" && !input.closeReason) context.addIssue({ code: "custom", path: ["closeReason"], message: "Choose a reason for closing this lead." });
  if (input.status !== "CLOSED" && input.closeReason) context.addIssue({ code: "custom", path: ["closeReason"], message: "Close reason is only valid when closing a lead." });
});

export const addLeadNoteSchema = z.object({ leadId: uuid, body: z.string().trim().min(1).max(4_000) }).strict();
export const updateLeadFollowUpSchema = z.object({ leadId: uuid, followUpAt: z.union([z.string().date(), z.string().datetime(), z.literal("")]) }).strict();
export const updateLeadAssignmentSchema = z.object({ leadId: uuid, assignedToId: z.union([uuid, z.null()]) }).strict();
export const bulkLeadActionSchema = z.object({
  leadIds: z.array(uuid).min(1).max(100),
  kind: z.enum(["assign", "status"]),
  assignedToId: z.union([uuid, z.null()]).optional(),
  status: leadStatus.optional(),
  closeReason: closeReason.optional(),
  note: z.string().trim().max(2_000).optional(),
}).strict().superRefine((input, context) => {
  if (new Set(input.leadIds).size !== input.leadIds.length) context.addIssue({ code: "custom", path: ["leadIds"], message: "Duplicate leads are not allowed." });
  if (input.kind === "assign" && input.assignedToId === undefined) context.addIssue({ code: "custom", path: ["assignedToId"], message: "Choose an assignment." });
  if (input.kind === "status" && !input.status) context.addIssue({ code: "custom", path: ["status"], message: "Choose a status." });
  if (input.kind === "status" && input.status === "CLOSED" && !input.closeReason) context.addIssue({ code: "custom", path: ["closeReason"], message: "Choose a close reason." });
});

export const leadExportQuerySchema = leadFilterSchema;
export type LeadFilters = z.output<typeof leadFilterSchema>;
