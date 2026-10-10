import { describe, expect, it } from "vitest";

import type { BookingStatus } from "@/generated/prisma/client";
import {
  ALL_BOOKING_STATUSES,
  ALLOWED_STATUS_TRANSITIONS,
  canTransitionBookingStatus,
  validateBookingStatusTransition,
} from "@/server/policies/bookingStatus";

const transitionsMap = new Map<BookingStatus, readonly BookingStatus[]>(
  Object.entries(ALLOWED_STATUS_TRANSITIONS) as [BookingStatus, readonly BookingStatus[]][],
);

describe("Booking Status State Machine", () => {
  it("allows all explicitly allowed transitions", () => {
    for (const [current, targets] of transitionsMap.entries()) {
      for (const target of targets) {
        expect(canTransitionBookingStatus(current, target)).toBe(true);
        const result = validateBookingStatusTransition(current, target);
        expect(result.valid).toBe(true);
      }
    }
  });

  it("disallows all transitions that are not in the allowed matrix", () => {
    for (const from of ALL_BOOKING_STATUSES) {
      const allowed = transitionsMap.get(from) ?? [];
      for (const to of ALL_BOOKING_STATUSES) {
        if (!allowed.includes(to)) {
          expect(canTransitionBookingStatus(from, to)).toBe(false);
          const result = validateBookingStatusTransition(from, to);
          expect(result.valid).toBe(false);
        }
      }
    }
  });

  it("disallows transitioning to the same status", () => {
    for (const status of ALL_BOOKING_STATUSES) {
      expect(canTransitionBookingStatus(status, status)).toBe(false);
      const result = validateBookingStatusTransition(status, status);
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.reason).toContain(`already in status '${status}'`);
      }
    }
  });

  it("enforces terminal states (COMPLETED, CANCELLED, REJECTED, NO_SHOW)", () => {
    const terminalStates: BookingStatus[] = ["COMPLETED", "CANCELLED", "REJECTED", "NO_SHOW"];
    for (const term of terminalStates) {
      for (const target of ALL_BOOKING_STATUSES) {
        expect(canTransitionBookingStatus(term, target)).toBe(false);
      }
    }
  });
});
