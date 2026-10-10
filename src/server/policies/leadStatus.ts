export const LEAD_STATUS_TRANSITIONS = {
  NEW: ["CONTACTED", "QUALIFIED", "CLOSED"],
  CONTACTED: ["QUALIFIED", "CLOSED"],
  QUALIFIED: ["CONTACTED", "CONVERTED", "CLOSED"],
  CONVERTED: ["CLOSED"],
  CLOSED: ["CONTACTED"],
} as const;

export type LeadStatusValue = keyof typeof LEAD_STATUS_TRANSITIONS;
const transitionMap = new Map<LeadStatusValue, readonly LeadStatusValue[]>(Object.entries(LEAD_STATUS_TRANSITIONS).map(([status, next]) => [status as LeadStatusValue, next]));

export function canTransitionLeadStatus(
  from: LeadStatusValue,
  to: LeadStatusValue,
  context: { canAssign?: boolean; note?: string } = {},
): boolean {
  if (from === "CLOSED" && to === "CONTACTED") return context.canAssign === true && Boolean(context.note?.trim());
  return transitionMap.get(from)?.includes(to) ?? false;
}

export function canEditLeadScope(input: {
  assignedToId: string | null;
  actorId: string;
  canAssign: boolean;
}): boolean {
  return input.canAssign || input.assignedToId === null || input.assignedToId === input.actorId;
}
