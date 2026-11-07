import type { BookingGuestAgeGroup, BookingGuestIdType } from "@/generated/prisma/client";

export type GuestIdTypeOption = {
  key: BookingGuestIdType;
  label: string;
  hint?: string;
  allowedAgeGroups: readonly BookingGuestAgeGroup[];
};

export const GUEST_ID_TYPES: readonly GuestIdTypeOption[] = [
  {
    key: "AADHAAR",
    label: "Aadhaar Card",
    hint: "Recommendation: Please upload a Masked Aadhaar (showing only the last 4 digits) for enhanced privacy.",
    allowedAgeGroups: ["ADULT", "CHILD_4_10", "INFANT_UNDER_4"],
  },
  {
    key: "PASSPORT",
    label: "Passport",
    allowedAgeGroups: ["ADULT", "CHILD_4_10", "INFANT_UNDER_4"],
  },
  {
    key: "DRIVING_LICENCE",
    label: "Driving Licence",
    allowedAgeGroups: ["ADULT"],
  },
  {
    key: "VOTER_ID",
    label: "Voter ID Card",
    allowedAgeGroups: ["ADULT"],
  },
  {
    key: "PAN",
    label: "PAN Card",
    allowedAgeGroups: ["ADULT"],
  },
  {
    key: "STUDENT_ID",
    label: "School / College ID Card",
    hint: "Accepted for children, minors, and college students.",
    allowedAgeGroups: ["CHILD_4_10", "INFANT_UNDER_4", "ADULT"],
  },
  {
    key: "BIRTH_CERTIFICATE",
    label: "Birth Certificate",
    hint: "Accepted for infants and children.",
    allowedAgeGroups: ["CHILD_4_10", "INFANT_UNDER_4"],
  },
] as const;

export const MAX_GUEST_ID_FILE_BYTES = 5 * 1024 * 1024; // 5 MB

export const ALLOWED_GUEST_ID_FORMATS = ["jpg", "jpeg", "png", "webp", "pdf"] as const;

export const ALLOWED_GUEST_ID_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
] as const;

/**
 * Provisional default retention settings.
 * Client confirmation required (see docs/OPEN_QUESTIONS.md).
 */
export const ID_RETENTION_DAYS_AFTER_CHECKOUT = 30;
export const ID_RETENTION_DAYS_AFTER_CANCEL_OR_REJECT = 7;

export function getIdTypesForAgeGroup(ageGroup: BookingGuestAgeGroup): readonly GuestIdTypeOption[] {
  return GUEST_ID_TYPES.filter((option) => option.allowedAgeGroups.includes(ageGroup));
}

