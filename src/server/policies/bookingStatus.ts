import type { BookingStatus } from "@/generated/prisma/client";

export const ALLOWED_STATUS_TRANSITIONS: Readonly<Record<BookingStatus, readonly BookingStatus[]>> = {
  ENQUIRY: ["PENDING_CONFIRMATION", "REJECTED", "CANCELLED"],
  PENDING_CONFIRMATION: ["CONFIRMED", "REJECTED", "CANCELLED"],
  CONFIRMED: ["COMPLETED", "CANCELLED", "NO_SHOW"],
  COMPLETED: [],
  CANCELLED: [],
  REJECTED: [],
  NO_SHOW: [],
};

export const ALL_BOOKING_STATUSES: readonly BookingStatus[] = [
  "ENQUIRY",
  "PENDING_CONFIRMATION",
  "CONFIRMED",
  "COMPLETED",
  "CANCELLED",
  "NO_SHOW",
  "REJECTED",
];

export function canTransitionBookingStatus(
  current: BookingStatus,
  target: BookingStatus,
): boolean {
  if (current === target) return false;
  switch (current) {
    case "ENQUIRY":
      return (
        target === "PENDING_CONFIRMATION" ||
        target === "REJECTED" ||
        target === "CANCELLED"
      );
    case "PENDING_CONFIRMATION":
      return (
        target === "CONFIRMED" ||
        target === "REJECTED" ||
        target === "CANCELLED"
      );
    case "CONFIRMED":
      return (
        target === "COMPLETED" ||
        target === "CANCELLED" ||
        target === "NO_SHOW"
      );
    case "COMPLETED":
    case "CANCELLED":
    case "REJECTED":
    case "NO_SHOW":
      return false;
  }
}

export function validateBookingStatusTransition(
  current: BookingStatus,
  target: BookingStatus,
): { valid: true } | { valid: false; reason: string } {
  if (current === target) {
    return { valid: false, reason: `Booking is already in status '${current}'.` };
  }
  if (!canTransitionBookingStatus(current, target)) {
    return {
      valid: false,
      reason: `Illegal status transition from '${current}' to '${target}'.`,
    };
  }
  return { valid: true };
}
