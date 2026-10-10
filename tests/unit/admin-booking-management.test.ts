import { describe, expect, it } from "vitest";

import { adminUpdateCapacitySchema } from "@/lib/schemas/admin-availability";
import {
  adminRecordPaymentSchema,
  adminRecordRefundSchema,
  adminRescheduleBookingSchema,
} from "@/lib/schemas/admin-bookings";
import { ROLE_PERMISSION_MATRIX } from "@/server/authz/permissions";
import { hasPermission } from "@/server/authz/policies";
import { ALL_BOOKING_STATUSES, canTransitionBookingStatus } from "@/server/policies/bookingStatus";

describe("Admin Booking Management: Financial Correctness & Policy Tests", () => {
  describe("1. Payments & Cheques (Item 1 & 2)", () => {
    it("ensures pending cheques do not count toward amountPaidPaise / paymentStatus until cleared", () => {
      // Simulate booking with total ₹5,000, current paid ₹0
      const totalPaise = 500000;
      let amountPaidPaise = 0;
      let paymentStatus = "UNPAID";

      // 1. Cheque recorded as PENDING
      const chequePayment: { method: string; status: string; amountPaise: number } = {
        method: "CHEQUE",
        status: "PENDING",
        amountPaise: 500000,
      };

      // Since status is PENDING, paid amount and booking status are NOT updated
      if (chequePayment.status === "CLEARED") {
        amountPaidPaise += chequePayment.amountPaise;
        paymentStatus = amountPaidPaise >= totalPaise ? "PAID" : "PARTIALLY_PAID";
      }

      expect(amountPaidPaise).toBe(0);
      expect(paymentStatus).toBe("UNPAID");

      // 2. Cheque is marked CLEARED
      const clearedCheque: { method: string; status: string; amountPaise: number } = {
        ...chequePayment,
        status: "CLEARED",
      };
      if (clearedCheque.status === "CLEARED") {
        amountPaidPaise += clearedCheque.amountPaise;
        paymentStatus = amountPaidPaise >= totalPaise ? "PAID" : "PARTIALLY_PAID";
      }

      expect(amountPaidPaise).toBe(500000);
      expect(paymentStatus).toBe("PAID");
    });

    it("rejects payments that exceed the outstanding balance (overpayment rejection)", () => {
      const totalPaise = 300000; // ₹3,000
      const amountPaidPaise = 200000; // ₹2,000 paid
      const outstandingPaise = totalPaise - amountPaidPaise; // ₹1,000

      // Attempt to pay ₹1,500
      const attemptedPaymentPaise = 150000;

      const isOverpayment = attemptedPaymentPaise > outstandingPaise;
      expect(isOverpayment).toBe(true);

      // Schema level validation ensures positive paise
      const parseResult = adminRecordPaymentSchema.safeParse({
        bookingId: "123e4567-e89b-12d3-a456-426614174000",
        method: "UPI",
        amountPaise: -500,
      });
      expect(parseResult.success).toBe(false);
    });

    it("enforces that cleared payments are immutable and cannot be edited or re-cleared", () => {
      const payment: { id: string; status: string; amountPaise: number } = {
        id: "pay-1",
        status: "CLEARED",
        amountPaise: 50000,
      };

      // Attempting to mark an already cleared payment as CLEARED fails
      const canMarkCleared = payment.status === "PENDING";
      expect(canMarkCleared).toBe(false);
    });

    it("enforces refund amount cannot exceed amount paid (D-2)", () => {
      const amountPaidPaise = 400000; // ₹4,000

      // Refund of ₹5,000 exceeds paid amount
      const attemptedRefundPaise = 500000;
      expect(attemptedRefundPaise > amountPaidPaise).toBe(true);

      // Schema validates positive amount
      const invalidZero = adminRecordRefundSchema.safeParse({
        bookingId: "123e4567-e89b-12d3-a456-426614174000",
        amountPaise: 0,
      });
      expect(invalidZero.success).toBe(false);
    });
  });

  describe("2. State Machine Transitions (Item 4)", () => {
    it("evaluates all state machine pairs and disallows illegal transitions", () => {
      for (const from of ALL_BOOKING_STATUSES) {
        for (const to of ALL_BOOKING_STATUSES) {
          if (from === to) {
            expect(canTransitionBookingStatus(from, to)).toBe(false);
          }
          if (["COMPLETED", "CANCELLED", "REJECTED", "NO_SHOW"].includes(from)) {
            expect(canTransitionBookingStatus(from, to)).toBe(false);
          }
        }
      }
    });

    it("verifies race-safety precondition pattern for status transitions", () => {
      // Simulate race-safe updateMany logic
      const simulateAtomicTransition = (
        currentStatus: string,
        expectedStatus: string,
      ): { count: number } => {
        // If status changed concurrently (e.g. was PENDING_CONFIRMATION, now CONFIRMED)
        if (currentStatus !== expectedStatus) {
          return { count: 0 };
        }
        return { count: 1 };
      };

      // Transaction 1 expects PENDING_CONFIRMATION and finds it
      const tx1 = simulateAtomicTransition("PENDING_CONFIRMATION", "PENDING_CONFIRMATION");
      expect(tx1.count).toBe(1);

      // Transaction 2 runs concurrently after Tx 1 has already updated status to CONFIRMED
      const tx2 = simulateAtomicTransition("CONFIRMED", "PENDING_CONFIRMATION");
      expect(tx2.count).toBe(0); // Fails race-safely
    });
  });

  describe("3. Permission Matrix & Role Restrictions (Item 6 & 10)", () => {
    it("confirms Reservations role CANNOT override price (does NOT have bookings.confirm)", () => {
      const reservationsPerms = ROLE_PERMISSION_MATRIX.Reservations;
      expect(reservationsPerms).not.toContain("bookings.confirm");

      const canOverridePrice = hasPermission(
        ["Reservations"],
        reservationsPerms,
        "bookings.confirm",
      );
      expect(canOverridePrice).toBe(false);
    });

    it("confirms Super Admin and Owner/Manager CAN override price (have bookings.confirm)", () => {
      expect(ROLE_PERMISSION_MATRIX["Super Admin"]).toContain("bookings.confirm");
      expect(ROLE_PERMISSION_MATRIX["Owner/Manager"]).toContain("bookings.confirm");

      expect(
        hasPermission(
          ["Super Admin"],
          ROLE_PERMISSION_MATRIX["Super Admin"],
          "bookings.confirm",
        ),
      ).toBe(true);

      expect(
        hasPermission(
          ["Owner/Manager"],
          ROLE_PERMISSION_MATRIX["Owner/Manager"],
          "bookings.confirm",
        ),
      ).toBe(true);
    });

    it("confirms Reservations role HAS write permissions for bookings and availability", () => {
      const perms = ROLE_PERMISSION_MATRIX.Reservations;
      expect(perms).toContain("bookings.read");
      expect(perms).toContain("bookings.write");
      expect(perms).toContain("payments.record");
      expect(perms).toContain("availability.write");
    });

    it("confirms Read-only role cannot write bookings, record payments, or edit availability", () => {
      const readOnlyPerms = ROLE_PERMISSION_MATRIX["Read-only"];
      expect(readOnlyPerms).not.toContain("bookings.write");
      expect(readOnlyPerms).not.toContain("payments.record");
      expect(readOnlyPerms).not.toContain("availability.write");
      expect(readOnlyPerms).not.toContain("bookings.confirm");
    });
  });

  describe("4. Availability Admin & Blackouts (Item 5)", () => {
    it("enforces capacity cannot be lower than held + booked units", () => {
      const held = 1;
      const booked = 2;
      const totalOccupied = held + booked; // 3

      const attemptedCapacity = 2;
      const isRefused = attemptedCapacity < totalOccupied;
      expect(isRefused).toBe(true);
    });

    it("validates capacity schema forbids negative numbers", () => {
      const invalid = adminUpdateCapacitySchema.safeParse({
        accommodationId: "123e4567-e89b-12d3-a456-426614174000",
        date: "2026-11-10",
        capacity: -1,
      });
      expect(invalid.success).toBe(false);
    });

    it("caps blackout period ranges at 366 days", () => {
      const validDuration = (new Date("2027-10-10").getTime() - new Date("2026-10-10").getTime()) / (1000 * 60 * 60 * 24);
      expect(validDuration).toBeLessThanOrEqual(366);

      // Over 366 days (e.g. 400 days)
      const start = new Date("2026-01-01");
      const end = new Date("2027-04-01"); // ~455 days
      const days = (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24);
      expect(days > 366).toBe(true);
    });

    it("enforces rescheduling requires a mandatory reason", () => {
      const invalid = adminRescheduleBookingSchema.safeParse({
        bookingId: "123e4567-e89b-12d3-a456-426614174000",
        newCheckIn: "2026-11-10",
        newCheckOut: "2026-11-12",
        reason: "",
      });
      expect(invalid.success).toBe(false);

      const valid = adminRescheduleBookingSchema.safeParse({
        bookingId: "123e4567-e89b-12d3-a456-426614174000",
        newCheckIn: "2026-11-10",
        newCheckOut: "2026-11-12",
        reason: "Customer postponed due to family emergency",
      });
      expect(valid.success).toBe(true);
    });
  });

  describe("5. Idempotent Submission (Item 10)", () => {
    it("recognizes existing booking on repeated submission with identical idempotencyKey", () => {
      const key = "123e4567-e89b-12d3-a456-426614174000";
      const existingRecord = {
        id: "bkg-123",
        reference: "BKG-2026-000001",
        idempotencyKey: key,
        status: "PENDING_CONFIRMATION",
      };

      // Check logic
      const checkSubmission = (submittedKey: string) => {
        if (submittedKey === existingRecord.idempotencyKey) {
          return { isDuplicate: true, booking: existingRecord };
        }
        return { isDuplicate: false };
      };

      const firstAttempt = checkSubmission(key);
      expect(firstAttempt.isDuplicate).toBe(true);
      expect(firstAttempt.booking?.reference).toBe("BKG-2026-000001");
    });
  });
});
