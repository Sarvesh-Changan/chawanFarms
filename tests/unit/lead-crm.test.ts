import { describe, expect, it } from "vitest";

import { escapeCsvCell, toCsv } from "@/lib/csv";
import { leadFilterSchema, leadListQuerySchema, saveLeadFilterSchema } from "@/lib/schemas/leads-crm";
import { ROLE_PERMISSION_MATRIX } from "@/server/authz/permissions";
import { canEditLeadScope, canTransitionLeadStatus, LEAD_STATUS_TRANSITIONS, type LeadStatusValue } from "@/server/policies/leadStatus";

const statuses = Object.keys(LEAD_STATUS_TRANSITIONS) as LeadStatusValue[];
const allowedPairs = new Set(["NEW:CONTACTED", "NEW:QUALIFIED", "NEW:CLOSED", "CONTACTED:QUALIFIED", "CONTACTED:CLOSED", "QUALIFIED:CONTACTED", "QUALIFIED:CONVERTED", "QUALIFIED:CLOSED", "CONVERTED:CLOSED"]);

describe("lead CRM edit scope", () => {
  it("allows leads.write staff to claim an unassigned lead but not edit someone else's assignment", () => {
    expect(canEditLeadScope({ assignedToId: null, actorId: "staff-a", canAssign: false })).toBe(true);
    expect(canEditLeadScope({ assignedToId: "staff-a", actorId: "staff-a", canAssign: false })).toBe(true);
    expect(canEditLeadScope({ assignedToId: "staff-b", actorId: "staff-a", canAssign: false })).toBe(false);
    expect(canEditLeadScope({ assignedToId: "staff-b", actorId: "staff-a", canAssign: true })).toBe(true);
  });

  it("keeps export out of the Reservations role", () => {
    expect(ROLE_PERMISSION_MATRIX.Reservations).not.toContain("leads.export");
  });
});

describe("saved lead filter validation", () => {
  it("requires the strict, bounded filter shape", () => {
    const filters = { status: ["NEW"], source: ["website"], assigneeId: "unassigned", dateFrom: "2026-10-01", dateTo: "2026-10-08", followUpDue: true, search: "family" };
    expect(leadFilterSchema.safeParse(filters).success).toBe(true);
    expect(saveLeadFilterSchema.safeParse({ name: "Family enquiries", filters, userId: "untrusted" }).success).toBe(false);
    expect(leadFilterSchema.safeParse({ ...filters, search: "x".repeat(101) }).success).toBe(false);
    expect(leadFilterSchema.safeParse({ ...filters, unexpected: true }).success).toBe(false);
    expect(leadListQuerySchema.safeParse({ dateFrom: "", dateTo: "", assigneeId: "", followUpDue: "false" }).success).toBe(true);
    expect(leadListQuerySchema.safeParse({ followUpDue: "perhaps" }).success).toBe(false);
  });
});

describe("lead status state machine", () => {
  it.each(statuses.flatMap((from) => statuses.flatMap((to) => [false, true].flatMap((canAssign) => [false, true].map((hasNote) => [from, to, canAssign, hasNote] as const))))) (
    "%s -> %s (assign=%s, note=%s)",
    (from, to, canAssign, hasNote) => {
      const explicitlyAllowed = allowedPairs.has(`${from}:${to}`);
      const expected = from === "CLOSED" && to === "CONTACTED" ? canAssign && hasNote : explicitlyAllowed;
      expect(canTransitionLeadStatus(from, to, { canAssign, note: hasNote ? "Reviewed with guest" : "" })).toBe(expected);
    },
  );
});

describe("CSV formula injection protection", () => {
  it.each(["=1+1", "+SUM(A1:A2)", "-1+2", "@SUM(A1:A2)"])('prefixes formula cell %s with apostrophe', (value) => {
    expect(escapeCsvCell(value)).toBe(`'${value}`);
  });

  it("quotes and escapes delimiters after formula neutralisation", () => {
    expect(escapeCsvCell('=1,"x"')).toBe("\"'=1,\"\"x\"\"\"");
    expect(toCsv([["name", "value"], ["Lead", "=1+1"]])).toBe("name,value\r\nLead,'=1+1");
  });
});
