import { describe, expect, it } from "vitest";

import { accommodationFormSchema } from "@/lib/schemas/cms/accommodation";
import { packageFormSchema, packageRateFormSchema } from "@/lib/schemas/cms/package";
import { settingsFormSchema } from "@/lib/schemas/cms/settings";

const packageInput = {
  slug: "part-a",
  code: "A",
  name: { en: "Package A", mr: "", hi: "" },
  summary: { en: "", mr: "", hi: "" },
  description: { en: "", mr: "", hi: "" },
  inclusions: { en: "", mr: "", hi: "" },
  conditions: { en: "", mr: "", hi: "" },
  timingNote: { en: "", mr: "", hi: "" },
  minGuests: "",
  maxGuests: "",
  isDayVisit: false,
  isGroupOnly: false,
  heroMediaId: "",
  accommodationIds: [],
  activityIds: [],
};

describe("CMS schemas", () => {
  it("requires English for localised package names", () => {
    expect(packageFormSchema.safeParse({ ...packageInput, name: { en: "", mr: "मराठी", hi: "" } }).success).toBe(false);
    expect(packageFormSchema.safeParse(packageInput).success).toBe(true);
  });

  it("allows unknown accommodation capacities to stay empty", () => {
    const result = accommodationFormSchema.safeParse({
      slug: "guest-house",
      type: "GUEST_HOUSE",
      name: { en: "Guest house", mr: "", hi: "" },
      summary: { en: "", mr: "", hi: "" },
      description: { en: "", mr: "", hi: "" },
      amenities: { en: "", mr: "", hi: "" },
      unitsTotal: "",
      maxGuests: "",
      heroMediaId: "",
      imageMediaIds: [],
    });
    expect(result.success).toBe(true);
    if (result.success) expect([result.data.unitsTotal, result.data.maxGuests]).toEqual([null, null]);
  });

  it("converts rupees to integer paise without rounding extra precision", () => {
    const input = {
      packageId: "00000000-0000-4000-8000-000000000001",
      foodPreference: "VEG",
      audience: "ADULT",
      unit: "PER_PERSON_PER_DAY",
      amountRupees: "1400.01",
      percentOfAdult: "",
      validFrom: "",
      validTo: "",
      seasonLabel: "",
    };
    const parsed = packageRateFormSchema.safeParse(input);
    expect(parsed.success && parsed.data.amountPaise).toBe(140001);
    expect(packageRateFormSchema.safeParse({ ...input, amountRupees: "1400.001" }).success).toBe(false);
  });

  it("rejects impossible rate dates", () => {
    const input = {
      packageId: "00000000-0000-4000-8000-000000000001",
      foodPreference: "",
      audience: "ADULT",
      unit: "FLAT",
      amountRupees: "0",
      percentOfAdult: "",
      validFrom: "2026-02-30",
      validTo: "",
      seasonLabel: "",
    };
    expect(packageRateFormSchema.safeParse(input).success).toBe(false);
  });

  it("does not require client-unprovided business email or WhatsApp details", () => {
    const result = settingsFormSchema.safeParse({
      businessName: { en: "Chawan Farms", mr: "", hi: "" },
      businessPhones: "",
      businessEmail: "",
      address: { en: "Baitwadi", mr: "", hi: "" },
      socialLinks: [],
      whatsappNumber: "",
      whatsappDefaultMessage: { en: "", mr: "", hi: "" },
      minLeadTimeHours: "",
      minimumGroupSize: "",
      checkInTime: "",
      checkOutTime: "",
      bookingPolicyText: { en: "", mr: "", hi: "" },
      notificationRecipients: "",
    });
    expect(result.success).toBe(true);
  });
});
