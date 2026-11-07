import { render } from "@testing-library/react";
import { axe } from "jest-axe";
import { describe, expect, it, vi } from "vitest";

import { GuestIdStep } from "@/components/booking/GuestIdStep";
import {
  GUEST_ID_TYPES,
  ID_RETENTION_DAYS_AFTER_CHECKOUT,
  ID_RETENTION_DAYS_AFTER_CANCEL_OR_REJECT,
  getIdTypesForAgeGroup,
} from "@/config/booking-id";
import { mediaPolicy } from "@/config/media";
import type { BookingGuestIdType } from "@/generated/prisma/client";
import { bookingSubmissionSchema } from "@/lib/schemas/booking";
import { ROLE_PERMISSION_MATRIX } from "@/server/authz/permissions";
import { hasPermission } from "@/server/authz/policies";
import { createAuthenticatedGuestIdViewUrl } from "@/server/integrations/cloudinary";

vi.mock("@/config/env", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/config/env")>();
  return {
    ...actual,
    env: {
      ...actual.env,
      CLOUDINARY_TEST_MODE: true,
      APP_ENV: "test",
    },
  };
});

// Mock server actions for component test
vi.mock("@/server/actions/booking-id", () => ({
  createGuestIdSignatureAction: vi.fn(),
  verifyGuestIdUploadAction: vi.fn(),
  removeGuestIdUploadAction: vi.fn(),
  viewGuestIdDocumentAction: vi.fn(),
}));

describe("Mandatory Guest Identity Document Upload & Security", () => {
  const validDraftKey = "11111111-1111-4111-8111-111111111111";

  const baseValidBooking = {
    checkIn: "2026-12-01",
    checkOut: "2026-12-03",
    adults: 2,
    children4to10: 1,
    infantsUnder4: 0,
    packageSlug: "package-a",
    accommodationSlug: "tent",
    foodPreference: "VEG" as const,
    contactName: "Ashok Patil",
    contactPhone: "+919876543210",
    contactEmail: "ashok@example.com",
    policyAccepted: true as const,
    policyVersionId: "00000000-0000-4000-8000-000000000001",
    idempotencyKey: validDraftKey,
    idConsentAccepted: true as const,
    guests: [
      {
        fullName: "Ashok Patil",
        ageGroup: "ADULT" as const,
        idType: "AADHAAR" as const,
        mediaPublicId: `private/booking-ids/${validDraftKey}/asset-1`,
      },
      {
        fullName: "Sunita Patil",
        ageGroup: "ADULT" as const,
        idType: "PASSPORT" as const,
        mediaPublicId: `private/booking-ids/${validDraftKey}/asset-2`,
      },
      {
        fullName: "Rohan Patil",
        ageGroup: "CHILD_4_10" as const,
        idType: "STUDENT_ID" as const,
        mediaPublicId: `private/booking-ids/${validDraftKey}/asset-3`,
      },
    ],
  };

  describe("1. Schema & Validation Enforcement", () => {
    it("accepts a completely valid submission with all guest IDs and consent", () => {
      const parsed = bookingSubmissionSchema.safeParse(baseValidBooking);
      expect(parsed.success).toBe(true);
    });

    it("rejects submission when guests array is empty or missing", () => {
      const invalid = { ...baseValidBooking, guests: [] };
      const parsed = bookingSubmissionSchema.safeParse(invalid);
      expect(parsed.success).toBe(false);
      if (!parsed.success) {
        expect(parsed.error.issues.some((i) => i.path.includes("guests"))).toBe(true);
      }
    });

    it("rejects submission when idConsentAccepted is not true", () => {
      const invalid = { ...baseValidBooking, idConsentAccepted: false };
      const parsed = bookingSubmissionSchema.safeParse(invalid);
      expect(parsed.success).toBe(false);
      if (!parsed.success) {
        expect(parsed.error.issues.some((i) => i.path.includes("idConsentAccepted"))).toBe(true);
      }
    });

    it("rejects guest with empty or too-short full name", () => {
      const invalid = {
        ...baseValidBooking,
        guests: [
          { ...baseValidBooking.guests[0], fullName: "A" },
          baseValidBooking.guests[1],
          baseValidBooking.guests[2],
        ],
      };
      const parsed = bookingSubmissionSchema.safeParse(invalid);
      expect(parsed.success).toBe(false);
    });

    it("rejects guest with invalid ID type", () => {
      const invalid = {
        ...baseValidBooking,
        guests: [
          { ...baseValidBooking.guests[0], idType: "INVALID_CARD" as unknown as BookingGuestIdType },
          baseValidBooking.guests[1],
          baseValidBooking.guests[2],
        ],
      };
      const parsed = bookingSubmissionSchema.safeParse(invalid);
      expect(parsed.success).toBe(false);
    });

    it("rejects guest with empty mediaPublicId", () => {
      const invalid = {
        ...baseValidBooking,
        guests: [
          { ...baseValidBooking.guests[0], mediaPublicId: "" },
          baseValidBooking.guests[1],
          baseValidBooking.guests[2],
        ],
      };
      const parsed = bookingSubmissionSchema.safeParse(invalid);
      expect(parsed.success).toBe(false);
    });
  });

  describe("2. Storage & Private Delivery Security", () => {
    it("enforces authenticated deliveryType and private folder in media policy", () => {
      const draftKey = "22222222-2222-4222-8222-222222222222";
      const policy = mediaPolicy("booking_guest_id");
      const folder = typeof policy.folder === "function" ? policy.folder(draftKey) : policy.folder;

      expect(policy.deliveryType).toBe("authenticated");
      expect(folder).toBe(`private/booking-ids/${draftKey}`);
      expect(policy.maxBytes).toBe(5_000_000); // 5 MB max
      expect(policy.formats).toEqual(["jpg", "png", "webp", "pdf"]);
      expect(policy.eagerTransformations).toEqual([]);
    });

    it("creates authenticated view URL with short expiration and never a public URL", () => {
      const publicId = `private/booking-ids/${validDraftKey}/asset-1`;
      const url = createAuthenticatedGuestIdViewUrl({ publicId, format: "jpg" });

      expect(url).toContain("authenticated");
      expect(url).not.toContain("/upload/");
      expect(url).toMatch(/expires=\d+/);
    });
  });

  describe("3. Role-Based Permissions & Staff Access Control", () => {
    it("grants bookings.ids.read to Super Admin, Owner/Manager and Reservations", () => {
      const superAdminPerms = ROLE_PERMISSION_MATRIX["Super Admin"];
      expect(superAdminPerms.includes("bookings.ids.read")).toBe(true);
      expect(hasPermission(["Super Admin"], superAdminPerms, "bookings.ids.read")).toBe(true);

      const ownerPerms = ROLE_PERMISSION_MATRIX["Owner/Manager"];
      expect(ownerPerms.includes("bookings.ids.read")).toBe(true);
      expect(hasPermission(["Owner/Manager"], ownerPerms, "bookings.ids.read")).toBe(true);

      const reservationsPerms = ROLE_PERMISSION_MATRIX["Reservations"];
      expect(reservationsPerms.includes("bookings.ids.read")).toBe(true);
      expect(hasPermission(["Reservations"], reservationsPerms, "bookings.ids.read")).toBe(true);
    });

    it("explicitly denies bookings.ids.read to Read-Only staff", () => {
      const readOnlyPerms = ROLE_PERMISSION_MATRIX["Read-only"];
      expect(readOnlyPerms.includes("bookings.ids.read")).toBe(false);
      expect(hasPermission(["Read-only"], readOnlyPerms, "bookings.ids.read")).toBe(false);
    });
  });

  describe("4. Config & Retention Rules", () => {
    it("defines 30-day post-checkout retention and 7-day post-cancel retention", () => {
      expect(ID_RETENTION_DAYS_AFTER_CHECKOUT).toBe(30);
      expect(ID_RETENTION_DAYS_AFTER_CANCEL_OR_REJECT).toBe(7);
    });

    it("filters ID types correctly by age group (children get student ID & birth certificate)", () => {
      const adultTypes = getIdTypesForAgeGroup("ADULT");
      expect(adultTypes.some((t) => t.key === "AADHAAR")).toBe(true);
      expect(adultTypes.some((t) => t.key === "DRIVING_LICENCE")).toBe(true);

      const childTypes = getIdTypesForAgeGroup("CHILD_4_10");
      expect(childTypes.some((t) => t.key === "STUDENT_ID")).toBe(true);
      expect(childTypes.some((t) => t.key === "BIRTH_CERTIFICATE")).toBe(true);
      expect(childTypes.some((t) => t.key === "DRIVING_LICENCE")).toBe(false);

      const infantTypes = getIdTypesForAgeGroup("INFANT_UNDER_4");
      expect(infantTypes.some((t) => t.key === "BIRTH_CERTIFICATE")).toBe(true);
      expect(infantTypes.some((t) => t.key === "DRIVING_LICENCE")).toBe(false);
    });

    it("recommends masked Aadhaar with explicit helper text", () => {
      const aadhaarConfig = GUEST_ID_TYPES.find((t) => t.key === "AADHAAR");
      expect(aadhaarConfig).toBeDefined();
      expect(aadhaarConfig?.hint).toContain("Masked Aadhaar");
    });
  });

  describe("5. Accessibility & Mobile UX (GuestIdStep)", () => {
    it("renders with no axe accessibility violations", async () => {
      const onEntriesChange = vi.fn();
      const onConsentChange = vi.fn();

      const { container } = render(
        <GuestIdStep
          draftKey={validDraftKey}
          adults={1}
          children4to10={1}
          infantsUnder4={0}
          entries={[]}
          idConsentAccepted={false}
          onEntriesChange={onEntriesChange}
          onConsentChange={onConsentChange}
        />,
      );

      const results = await axe(container);
      expect(results.violations).toEqual([]);
    });

    it("renders guest tabs and document consent checkbox on narrow 360px viewport", () => {
      const { getByText, getByLabelText } = render(
        <div style={{ width: "360px" }}>
          <GuestIdStep
            draftKey={validDraftKey}
            adults={2}
            children4to10={0}
            infantsUnder4={0}
            entries={[]}
            idConsentAccepted={false}
            onEntriesChange={vi.fn()}
            onConsentChange={vi.fn()}
          />
        </div>,
      );

      expect(getByText("Adult 1")).toBeInTheDocument();
      expect(getByText("Adult 2")).toBeInTheDocument();
      expect(getByLabelText(/I consent to identity document collection/i)).toBeInTheDocument();
    });
  });
});
