"use client";

import { Check, ChevronRight, AlertCircle, Share2, MessageCircle, Info } from "lucide-react";
import Link from "next/link";
import { useEffect, useId, useMemo, useRef, useState } from "react";

import { TurnstileField } from "@/components/auth/TurnstileField";
import { BookingDatePicker } from "@/components/booking/BookingDatePicker";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  calculateStayNights,
  formatDateDDMMYYYY,
  getKolkataToday,
} from "@/lib/booking-dates";
import { submitBookingAction } from "@/server/actions/booking";
import type { BookingResult } from "@/server/services/booking";

export type StayTypeOption = {
  key: string;
  name: string;
  packageSlug: string;
  accommodationSlug: string;
  description: string;
  isDayVisit: boolean;
  minGuests: number;
  maxGuests?: number | null;
  tagline?: string;
};

export type ActivityOption = {
  id: string;
  slug: string;
  name: string;
  isExtraCost: boolean;
  priceNote?: string | null;
  conditionsNote?: string | null;
};

export type BookingFlowProps = {
  stayTypes: StayTypeOption[];
  activities: ActivityOption[];
  policy: {
    id: string;
    title: string;
    html: string;
  };
  settings: {
    featureCoupons: boolean;
    whatsappNumber: string | null;
    phoneNumbers: string[];
    minLeadDays: number;
    maxNights: number;
  };
  customerProfile: {
    name?: string | null;
    email?: string | null;
    phone?: string | null;
  } | null;
  prefill?: {
    packageSlug?: string | null;
    activitySlug?: string | null;
  };
};

type QuoteEstimate = {
  subtotalPaise: number;
  discountPaise: number;
  taxPaise: number;
  totalPaise: number;
  formattedSubtotal: string;
  formattedDiscount: string;
  formattedTax: string;
  formattedTotal: string;
  nights: number;
  lines: Array<{
    description: string;
    quantity: number;
    unitPaise: number;
    totalPaise: number;
    formattedUnit: string;
    formattedTotal: string;
  }>;
  requiresManualQuote: boolean;
  manualQuoteReason?: string | null;
  disclaimer: string;
};

const STORAGE_KEY = "chawan_booking_state";

type SavedBookingState = {
  checkInIso?: string;
  checkOutIso?: string;
  adults?: number;
  children4to10?: number;
  infantsUnder4?: number;
  selectedStayKey?: string;
  foodPreference?: "VEG" | "NON_VEG";
  selectedActivitySlugs?: string[];
  extrasNotes?: string;
};

function getSavedBookingState(): SavedBookingState | null {
  if (typeof window === "undefined") return null;
  try {
    const saved = window.sessionStorage.getItem(STORAGE_KEY);
    return saved ? (JSON.parse(saved) as SavedBookingState) : null;
  } catch {
    return null;
  }
}

export function BookingFlow({
  stayTypes,
  activities,
  policy,
  settings,
  customerProfile,
  prefill,
}: BookingFlowProps) {
  const startedAtRef = useRef<number>(0);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const quoteAbortRef = useRef<AbortController | null>(null);
  const honeypotId = useId();

  useEffect(() => {
    if (!startedAtRef.current) {
      startedAtRef.current = Date.now();
    }
  }, []);

  // 1. Resolve initial stay type
  const defaultStayType = prefill?.packageSlug
    ? stayTypes.find(
        (s) => s.packageSlug === prefill.packageSlug || s.accommodationSlug === prefill.packageSlug,
      )?.key ?? stayTypes[0]?.key ?? "tent_dorm"
    : stayTypes[0]?.key ?? "tent_dorm";

  // Stepper state (1..5)
  const [currentStep, setCurrentStep] = useState<number>(1);

  // Form State with lazy initializers from sessionStorage
  const [checkInIso, setCheckInIso] = useState<string>(() => getSavedBookingState()?.checkInIso ?? "");
  const [checkOutIso, setCheckOutIso] = useState<string>(() => getSavedBookingState()?.checkOutIso ?? "");
  const [adults, setAdults] = useState<number>(() => getSavedBookingState()?.adults ?? 2);
  const [children4to10, setChildren4to10] = useState<number>(() => getSavedBookingState()?.children4to10 ?? 0);
  const [infantsUnder4, setInfantsUnder4] = useState<number>(() => getSavedBookingState()?.infantsUnder4 ?? 0);

  const [selectedStayKey, setSelectedStayKey] = useState<string>(() => {
    const saved = getSavedBookingState();
    if (saved?.selectedStayKey && stayTypes.some((s) => s.key === saved.selectedStayKey)) {
      return saved.selectedStayKey;
    }
    return defaultStayType;
  });
  const [foodPreference, setFoodPreference] = useState<"VEG" | "NON_VEG">(
    () => getSavedBookingState()?.foodPreference ?? "VEG",
  );

  const [selectedActivitySlugs, setSelectedActivitySlugs] = useState<string[]>(() => {
    const saved = getSavedBookingState();
    if (Array.isArray(saved?.selectedActivitySlugs)) {
      return saved.selectedActivitySlugs;
    }
    if (prefill?.activitySlug && activities.some((a) => a.slug === prefill.activitySlug)) {
      return [prefill.activitySlug];
    }
    return [];
  });
  const [extrasNotes, setExtrasNotes] = useState<string>(() => getSavedBookingState()?.extrasNotes ?? "");

  // Contact details (never autosaved to sessionStorage)
  const [contactName, setContactName] = useState<string>(customerProfile?.name ?? "");
  const [contactPhone, setContactPhone] = useState<string>(customerProfile?.phone ?? "");
  const [contactEmail, setContactEmail] = useState<string>(customerProfile?.email ?? "");
  const [couponCode, setCouponCode] = useState<string>("");
  const [specialRequests, setSpecialRequests] = useState<string>("");

  // Review step state
  const [policyAccepted, setPolicyAccepted] = useState<boolean>(false);
  const [turnstileToken, setTurnstileToken] = useState<string>("");
  const [honeypot, setHoneypot] = useState<string>("");

  // UUID Idempotency Key (client-generated per submission attempt)
  const [idempotencyKey, setIdempotencyKey] = useState<string>(() => crypto.randomUUID());

  // UI & Quote state
  const [quoteEstimate, setQuoteEstimate] = useState<QuoteEstimate | null>(null);
  const [quoteLoading, setQuoteLoading] = useState<boolean>(false);
  const [quoteError, setQuoteError] = useState<string | null>(null);

  // Submission & Validation state
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [submissionSuccess, setSubmissionSuccess] = useState<BookingResult | null>(null);
  const [copiedLink, setCopiedLink] = useState<boolean>(false);

  // Mobile sticky summary toggle
  const [mobileSummaryExpanded, setMobileSummaryExpanded] = useState<boolean>(false);

  // Minimum date from settings (minLeadDays in Asia/Kolkata)
  const minDate = useMemo(() => {
    const today = getKolkataToday();
    today.setDate(today.getDate() + (settings.minLeadDays ?? 0));
    return today;
  }, [settings.minLeadDays]);

  const selectedStay = useMemo(
    () => stayTypes.find((s) => s.key === selectedStayKey) ?? stayTypes[0],
    [selectedStayKey, stayTypes],
  );

  const effectiveCheckOutIso = selectedStay?.isDayVisit ? checkInIso : (checkOutIso || checkInIso);

  // Autosave non-PII selections to sessionStorage
  useEffect(() => {
    try {
      const stateToSave = {
        checkInIso,
        checkOutIso,
        adults,
        children4to10,
        infantsUnder4,
        selectedStayKey,
        foodPreference,
        selectedActivitySlugs,
        extrasNotes,
      };
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(stateToSave));
    } catch {
      // Ignore quota errors
    }
  }, [
    checkInIso,
    checkOutIso,
    adults,
    children4to10,
    infantsUnder4,
    selectedStayKey,
    foodPreference,
    selectedActivitySlugs,
    extrasNotes,
  ]);

  // Move focus to step heading whenever currentStep changes
  useEffect(() => {
    headingRef.current?.focus();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [currentStep]);

  // Live Quote Fetcher with 300ms debounce and AbortController
  useEffect(() => {
    if (!checkInIso || !selectedStay) {
      return;
    }

    if (quoteAbortRef.current) {
      quoteAbortRef.current.abort();
    }
    const controller = new AbortController();
    quoteAbortRef.current = controller;

    const timer = setTimeout(async () => {
      setQuoteLoading(true);
      setQuoteError(null);

      try {
        const payload = {
          checkIn: checkInIso,
          checkOut: effectiveCheckOutIso,
          adults,
          children4to10,
          infantsUnder4,
          packageSlug: selectedStay.packageSlug,
          accommodationSlug: selectedStay.accommodationSlug,
          foodPreference,
          extras: selectedActivitySlugs.map((slug) => {
            const act = activities.find((a) => a.slug === slug);
            return {
              name: act ? act.name : slug,
              quantity: 1,
              note: act?.priceNote ?? undefined,
            };
          }),
        };

        const res = await fetch("/api/quote", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
          signal: controller.signal,
        });

        if (res.status === 429) {
          setQuoteError("Rate limit reached. Please wait a moment before updating details.");
          return;
        }

        if (!res.ok) {
          setQuoteError("Unable to calculate estimate right now.");
          return;
        }

        const data = (await res.json()) as { estimate: QuoteEstimate };
        if (!controller.signal.aborted) {
          setQuoteEstimate(data.estimate);
        }
      } catch (err: unknown) {
        if (err instanceof Error && err.name === "AbortError") {
          return;
        }
        setQuoteError("Unable to reach pricing service.");
      } finally {
        if (!controller.signal.aborted) {
          setQuoteLoading(false);
        }
      }
    }, 300);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [
    checkInIso,
    effectiveCheckOutIso,
    adults,
    children4to10,
    infantsUnder4,
    selectedStay,
    foodPreference,
    selectedActivitySlugs,
    activities,
  ]);

  const activeEstimate = !checkInIso || !selectedStay ? null : quoteEstimate;

  // Validation helpers for navigation
  const validateStep1 = (): boolean => {
    const errors: Record<string, string[]> = {};
    if (!checkInIso) errors.checkIn = ["Please select a visit or check-in date."];
    if (!selectedStay?.isDayVisit && !checkOutIso) {
      errors.checkOut = ["Please select a check-out date."];
    }
    if (adults < 1) errors.adults = ["At least 1 adult is required."];

    if (!selectedStay?.isDayVisit && checkInIso && checkOutIso) {
      const nights = calculateStayNights(checkInIso, checkOutIso);
      if (nights <= 0) errors.checkOut = ["Check-out must be after check-in."];
      if (settings.maxNights && nights > settings.maxNights) {
        errors.checkOut = [`Maximum stay allowed is ${settings.maxNights} nights.`];
      }
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const validateStep2 = (): boolean => {
    const errors: Record<string, string[]> = {};
    if (!selectedStayKey) errors.stayType = ["Please choose a stay option."];
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const validateStep3 = (): boolean => {
    setFieldErrors({});
    return true;
  };

  const validateStep4 = (): boolean => {
    const errors: Record<string, string[]> = {};
    if (!contactName.trim() || contactName.trim().length < 2) {
      errors.contactName = ["Please provide your name (at least 2 characters)."];
    }
    if (!contactPhone.trim() || contactPhone.trim().length < 10) {
      errors.contactPhone = ["Please provide a valid 10-digit phone number."];
    }
    if (contactEmail.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactEmail.trim())) {
      errors.contactEmail = ["Please provide a valid email address."];
    }
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleNext = () => {
    setServerError(null);
    let valid = false;
    switch (currentStep) {
      case 1:
        valid = validateStep1();
        break;
      case 2:
        valid = validateStep2();
        break;
      case 3:
        valid = validateStep3();
        break;
      case 4:
        valid = validateStep4();
        break;
      default:
        valid = true;
    }
    if (valid) {
      setCurrentStep((prev) => Math.min(5, prev + 1));
    }
  };

  const handlePrev = () => {
    setServerError(null);
    setFieldErrors({});
    setCurrentStep((prev) => Math.max(1, prev - 1));
  };

  // Submission handler for Step 5
  const handleSubmitBooking = async () => {
    if (!policyAccepted) {
      setFieldErrors({ policy: ["You must review and accept the stay rules and policies."] });
      return;
    }

    setSubmitting(true);
    setServerError(null);
    setFieldErrors({});

    const payload = {
      idempotencyKey,
      checkIn: checkInIso,
      checkOut: effectiveCheckOutIso,
      adults,
      children4to10,
      infantsUnder4,
      packageSlug: selectedStay?.packageSlug,
      accommodationSlug: selectedStay?.accommodationSlug,
      foodPreference,
      contactName: contactName.trim(),
      contactPhone: contactPhone.trim(),
      contactEmail: contactEmail.trim() || undefined,
      specialRequests: specialRequests.trim() || undefined,
      policyAccepted: true as const,
      policyVersionId: policy.id,
      extras: selectedActivitySlugs.map((slug) => {
        const act = activities.find((a) => a.slug === slug);
        return {
          name: act ? act.name : slug,
          quantity: 1,
          note: act?.priceNote ?? undefined,
        };
      }),
      couponCode: settings.featureCoupons && couponCode.trim() ? couponCode.trim() : null,
      honeypot,
      turnstileToken: turnstileToken || undefined,
      startedAt: startedAtRef.current || Date.now(),
    };

    try {
      const res = await submitBookingAction(payload);
      if (res.ok) {
        try {
          sessionStorage.removeItem(STORAGE_KEY);
        } catch {
          // Ignore
        }
        setSubmissionSuccess(res.data);
      } else {
        setServerError(res.error.message);
        if (res.error.fieldErrors) {
          setFieldErrors(res.error.fieldErrors);
        }
        setIdempotencyKey(crypto.randomUUID());
        setTurnstileToken("");
      }
    } catch {
      setServerError("An unexpected network error occurred. Please check your connection and retry.");
      setIdempotencyKey(crypto.randomUUID());
      setTurnstileToken("");
    } finally {
      setSubmitting(false);
    }
  };

  const isGuestHouseBelowGroup =
    selectedStay?.packageSlug === "package-b" && adults + children4to10 < 10;
  const isCampOrganiserOutOfRange =
    selectedStay?.packageSlug === "package-c" &&
    (adults + children4to10 < 30 || adults + children4to10 > 50);

  // CONFIRMATION VIEW
  if (submissionSuccess) {
    const reference = submissionSuccess.reference;
    const whatsappText = `Hello Chawan Farms, I have submitted booking request ${reference}. Please share availability and bank transfer details.`;
    const whatsappUrl = settings.whatsappNumber
      ? `https://wa.me/${settings.whatsappNumber.replace(/[^0-9]/g, "")}?text=${encodeURIComponent(
          whatsappText,
        )}`
      : null;

    const handleShareLink = () => {
      if (typeof navigator !== "undefined" && navigator.share) {
        void navigator.share({
          title: "Chawan Farms Booking Request",
          text: `Booking Request: ${reference}`,
          url: window.location.href,
        });
      } else if (typeof navigator !== "undefined" && navigator.clipboard) {
        void navigator.clipboard.writeText(reference);
        setCopiedLink(true);
        setTimeout(() => setCopiedLink(false), 3000);
      }
    };

    return (
      <div className="mx-auto max-w-3xl rounded-2xl border border-forest-900/15 bg-white p-6 sm:p-10 shadow-sm">
        <div className="text-center">
          <div className="mx-auto flex size-14 items-center justify-center rounded-full bg-leaf-500/15 text-leaf-700">
            <Check className="size-8" />
          </div>
          <p className="mt-4 text-xs font-bold tracking-widest text-leaf-700 uppercase">
            Request Received
          </p>
          <h1
            ref={headingRef}
            tabIndex={-1}
            className="font-heading text-3xl font-bold text-forest-900 sm:text-4xl mt-1 focus:outline-none"
          >
            Thank you, {contactName || "Guest"}!
          </h1>
          <p className="mt-2 text-base text-mist-500">
            We have recorded your booking request. Our team will verify dates and arrangements.
          </p>
        </div>

        <div className="mt-8 rounded-xl border-2 border-dashed border-forest-700/40 bg-clay-100/50 p-6 text-center">
          <p className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
            Your Booking Reference
          </p>
          <p className="font-mono text-3xl font-bold text-forest-900 sm:text-4xl mt-2 tracking-wide">
            {reference}
          </p>
          <p className="mt-2 text-xs text-muted-foreground">
            Please quote this reference in all correspondence with the farm.
          </p>
        </div>

        <div className="mt-8 rounded-xl bg-forest-900/5 p-6 space-y-4">
          <h2 className="font-heading text-lg font-bold text-forest-900">
            Next Steps &amp; Payment Confirmation
          </h2>
          <ul className="space-y-3 text-sm text-foreground/90">
            <li className="flex items-start gap-2.5">
              <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-forest-700 text-xs font-bold text-white">
                1
              </span>
              <span>
                <strong>Team Review:</strong> Our farm manager will review availability, capacity,
                and meal options for your dates.
              </span>
            </li>
            <li className="flex items-start gap-2.5">
              <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-forest-700 text-xs font-bold text-white">
                2
              </span>
              <span>
                <strong>Payment Details:</strong> Bank transfer or cheque details are provided on
                request by our reservations team.
              </span>
            </li>
            <li className="flex items-start gap-2.5">
              <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-forest-700 text-xs font-bold text-white">
                3
              </span>
              <span>
                <strong>100% Payment Policy:</strong> Booking is confirmed against 100% payment (if
                by cheque: after realisation per farm policy).
              </span>
            </li>
          </ul>
        </div>

        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-center">
          {whatsappUrl ? (
            <a
              href={whatsappUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-lg bg-[#25D366] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#20ba59] transition"
            >
              <MessageCircle className="size-4" />
              Message farm on WhatsApp
            </a>
          ) : null}

          <Button
            type="button"
            variant="outline"
            onClick={handleShareLink}
            className="min-h-[44px] gap-2"
          >
            <Share2 className="size-4" />
            {copiedLink ? "Reference Copied!" : "Share / Copy Reference"}
          </Button>
        </div>

        {!customerProfile && (
          <div className="mt-8 border-t border-border pt-6 text-center">
            <h3 className="font-heading text-base font-semibold text-forest-900">
              Want to track your stay and earn rewards?
            </h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Create an account with <strong>{contactEmail || "your email"}</strong> to manage bookings and redeem points for video reviews.
            </p>
            <div className="mt-3">
              <Link
                href="/signup?callbackUrl=/account/bookings"
                className="inline-flex min-h-[44px] items-center text-sm font-semibold text-forest-700 hover:text-forest-900 underline"
              >
                Create an account
              </Link>
            </div>
          </div>
        )}

        <div className="mt-8 text-center">
          <Link
            href="/"
            className="inline-flex min-h-[44px] items-center text-sm font-medium text-muted-foreground hover:text-foreground"
          >
            ← Return to Homepage
          </Link>
        </div>
      </div>
    );
  }

  // STEPPER COMPONENT
  const stepTitles = [
    "Dates & Guests",
    "Stay & Food",
    "Activities & Extras",
    "Contact Details",
    "Review & Confirm",
  ];

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      {/* 5-Step Stepper Header */}
      <nav aria-label="Booking flow progress" className="w-full">
        <ol className="grid grid-cols-5 gap-1.5 sm:gap-3 text-center">
          {stepTitles.map((title, index) => {
            const stepNum = index + 1;
            const isCurrent = currentStep === stepNum;
            const isCompleted = currentStep > stepNum;

            return (
              <li
                key={title}
                aria-current={isCurrent ? "step" : undefined}
                className="flex flex-col items-center"
              >
                <div
                  className={`flex size-8 sm:size-10 items-center justify-center rounded-full text-xs sm:text-sm font-bold transition ${
                    isCurrent
                      ? "bg-forest-700 text-white shadow-sm ring-2 ring-forest-700/30 ring-offset-2"
                      : isCompleted
                      ? "bg-leaf-500 text-white"
                      : "bg-forest-900/10 text-muted-foreground"
                  }`}
                >
                  {isCompleted ? <Check className="size-4" /> : stepNum}
                </div>
                <span
                  className={`mt-1.5 hidden text-xs font-medium sm:block truncate max-w-full ${
                    isCurrent
                      ? "text-forest-900 font-bold"
                      : isCompleted
                      ? "text-leaf-700"
                      : "text-muted-foreground"
                  }`}
                >
                  {title}
                </span>
              </li>
            );
          })}
        </ol>
      </nav>

      {/* Error Summary Box */}
      {Object.keys(fieldErrors).length > 0 && (
        <div
          role="alert"
          aria-labelledby="error-summary-heading"
          className="rounded-xl border border-destructive/30 bg-destructive/10 p-4"
        >
          <h2
            id="error-summary-heading"
            className="text-sm font-bold text-destructive flex items-center gap-2"
          >
            <AlertCircle className="size-4" />
            Please address the following items:
          </h2>
          <ul className="mt-2 list-disc pl-5 text-sm text-destructive space-y-1">
            {Object.entries(fieldErrors).map(([key, msgs]) => (
              <li key={key}>
                <a href={`#field-${key}`} className="underline hover:text-destructive/80">
                  {msgs[0]}
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Server Error Alert */}
      {serverError && (
        <div role="alert" className="rounded-xl bg-destructive/10 p-4 text-sm font-semibold text-destructive">
          {serverError}
        </div>
      )}

      {/* Form Container */}
      <div className="rounded-2xl border border-forest-900/15 bg-white p-5 sm:p-8 shadow-sm">
        {/* Hidden Honeypot Input */}
        <label htmlFor={honeypotId} className="absolute -left-[10000px] h-px w-px overflow-hidden" aria-hidden="true">
          Leave this field empty
          <input
            id={honeypotId}
            type="text"
            tabIndex={-1}
            autoComplete="off"
            value={honeypot}
            onChange={(e) => setHoneypot(e.target.value)}
          />
        </label>

        {/* STEP 1: Dates & Guests */}
        {currentStep === 1 && (
          <section aria-labelledby="step-1-heading" className="space-y-6">
            <div>
              <p className="text-xs font-semibold tracking-wider text-forest-700 uppercase">Step 1 of 5</p>
              <h2
                id="step-1-heading"
                ref={headingRef}
                tabIndex={-1}
                className="font-heading text-2xl font-bold text-forest-900 sm:text-3xl mt-1 focus:outline-none"
              >
                Select your dates and guests
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Rates depend on headcount and age. Children under 4 stay free of cost.
              </p>
            </div>

            {/* Date Picker */}
            <div id="field-checkIn">
              <BookingDatePicker
                mode={selectedStay?.isDayVisit ? "single" : "range"}
                checkInIso={checkInIso}
                checkOutIso={checkOutIso}
                minDate={minDate}
                accommodationSlug={selectedStay?.accommodationSlug}
                onDatesChange={(inIso, outIso) => {
                  setCheckInIso(inIso);
                  setCheckOutIso(outIso);
                }}
              />
              {fieldErrors.checkIn && (
                <p className="mt-1 text-xs text-destructive">{fieldErrors.checkIn[0]}</p>
              )}
              {fieldErrors.checkOut && (
                <p className="mt-1 text-xs text-destructive">{fieldErrors.checkOut[0]}</p>
              )}
            </div>

            {/* Guest Counters */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 pt-4 border-t border-border">
              {/* Adults */}
              <div id="field-adults" className="rounded-xl border border-forest-900/15 p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <label htmlFor="adults-counter" className="block text-sm font-bold text-forest-900">
                      Adults
                    </label>
                    <span className="text-xs text-muted-foreground">Age 11+</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      aria-label="Decrease adults"
                      disabled={adults <= 1}
                      onClick={() => setAdults((prev) => Math.max(1, prev - 1))}
                      className="size-11 rounded-lg border border-border bg-background text-base font-bold disabled:opacity-40"
                    >
                      -
                    </button>
                    <input
                      id="adults-counter"
                      type="number"
                      min={1}
                      max={100}
                      value={adults}
                      onChange={(e) => setAdults(Math.max(1, Number.parseInt(e.target.value, 10) || 1))}
                      className="w-12 text-center font-bold text-forest-900 text-base"
                    />
                    <button
                      type="button"
                      aria-label="Increase adults"
                      onClick={() => setAdults((prev) => prev + 1)}
                      className="size-11 rounded-lg border border-border bg-background text-base font-bold"
                    >
                      +
                    </button>
                  </div>
                </div>
              </div>

              {/* Children (4-10) */}
              <div className="rounded-xl border border-forest-900/15 p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <label htmlFor="children-counter" className="block text-sm font-bold text-forest-900">
                      Children
                    </label>
                    <span className="text-xs text-muted-foreground">Age 4–10 (60% rate)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      aria-label="Decrease children"
                      disabled={children4to10 <= 0}
                      onClick={() => setChildren4to10((prev) => Math.max(0, prev - 1))}
                      className="size-11 rounded-lg border border-border bg-background text-base font-bold disabled:opacity-40"
                    >
                      -
                    </button>
                    <input
                      id="children-counter"
                      type="number"
                      min={0}
                      max={50}
                      value={children4to10}
                      onChange={(e) => setChildren4to10(Math.max(0, Number.parseInt(e.target.value, 10) || 0))}
                      className="w-12 text-center font-bold text-forest-900 text-base"
                    />
                    <button
                      type="button"
                      aria-label="Increase children"
                      onClick={() => setChildren4to10((prev) => prev + 1)}
                      className="size-11 rounded-lg border border-border bg-background text-base font-bold"
                    >
                      +
                    </button>
                  </div>
                </div>
              </div>

              {/* Infants (under 4) */}
              <div className="rounded-xl border border-forest-900/15 p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <label htmlFor="infants-counter" className="block text-sm font-bold text-forest-900">
                      Infants
                    </label>
                    <span className="text-xs text-leaf-700 font-semibold">Under 4 (Free)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      aria-label="Decrease infants"
                      disabled={infantsUnder4 <= 0}
                      onClick={() => setInfantsUnder4((prev) => Math.max(0, prev - 1))}
                      className="size-11 rounded-lg border border-border bg-background text-base font-bold disabled:opacity-40"
                    >
                      -
                    </button>
                    <input
                      id="infants-counter"
                      type="number"
                      min={0}
                      max={20}
                      value={infantsUnder4}
                      onChange={(e) => setInfantsUnder4(Math.max(0, Number.parseInt(e.target.value, 10) || 0))}
                      className="w-12 text-center font-bold text-forest-900 text-base"
                    />
                    <button
                      type="button"
                      aria-label="Increase infants"
                      onClick={() => setInfantsUnder4((prev) => prev + 1)}
                      className="size-11 rounded-lg border border-border bg-background text-base font-bold"
                    >
                      +
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </section>
        )}

        {/* STEP 2: Stay Type & Food Option */}
        {currentStep === 2 && (
          <section aria-labelledby="step-2-heading" className="space-y-6">
            <div>
              <p className="text-xs font-semibold tracking-wider text-forest-700 uppercase">Step 2 of 5</p>
              <h2
                id="step-2-heading"
                ref={headingRef}
                tabIndex={-1}
                className="font-heading text-2xl font-bold text-forest-900 sm:text-3xl mt-1 focus:outline-none"
              >
                Choose stay accommodation &amp; food
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                All accommodation types are rooted in authentic rural living.
              </p>
            </div>

            {/* Stay Options Cards */}
            <div id="field-stayType" className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {stayTypes.map((stay) => {
                const isSelected = selectedStayKey === stay.key;
                return (
                  <div
                    key={stay.key}
                    onClick={() => setSelectedStayKey(stay.key)}
                    className={`relative cursor-pointer rounded-xl border p-4 transition ${
                      isSelected
                        ? "border-forest-700 bg-forest-900/5 ring-2 ring-forest-700"
                        : "border-border hover:border-forest-700/40 bg-card"
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <h3 className="font-heading text-lg font-bold text-forest-900">{stay.name}</h3>
                        <p className="mt-1 text-xs text-muted-foreground">{stay.description}</p>
                      </div>
                      <input
                        type="radio"
                        name="stayType"
                        checked={isSelected}
                        onChange={() => setSelectedStayKey(stay.key)}
                        className="size-5 accent-forest-700 mt-1"
                        aria-label={stay.name}
                      />
                    </div>
                    {stay.minGuests > 1 && (
                      <p className="mt-3 text-xs font-semibold text-laterite-600">
                        * Note: Minimum group size of {stay.minGuests} guests
                      </p>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Warning if group minimum not met */}
            {(isGuestHouseBelowGroup || isCampOrganiserOutOfRange) && (
              <div
                role="note"
                className="rounded-xl border border-turmeric-500/40 bg-turmeric-500/10 p-4 text-sm text-foreground flex items-start gap-3"
              >
                <Info className="size-5 shrink-0 text-turmeric-700 mt-0.5" />
                <div>
                  <strong>Custom Manual Quote Note:</strong>
                  {isGuestHouseBelowGroup && (
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      The Guest House package rate card applies to groups of at least 10 persons. You can still submit your request, and our team will provide a tailored quote.
                    </p>
                  )}
                  {isCampOrganiserOutOfRange && (
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      Camp Organiser (Lawn) packages are configured for 30–50 persons. Our team will manually review and quote your group.
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* Food Preference Option */}
            <div className="pt-4 border-t border-border space-y-3">
              <label className="block text-sm font-bold text-forest-900">
                Food preference (Home-cooked Maharashtrian farm meals)
              </label>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <label
                  className={`flex cursor-pointer items-center justify-between rounded-xl border p-4 transition ${
                    foodPreference === "VEG"
                      ? "border-forest-700 bg-forest-900/5 ring-1 ring-forest-700"
                      : "border-border"
                  }`}
                >
                  <div>
                    <span className="font-bold text-forest-900">Pure Vegetarian</span>
                    <p className="text-xs text-muted-foreground">
                      Dal, rice, bhakri/chapati, 2 fresh vegetables, sweet, pickle, papad
                    </p>
                  </div>
                  <input
                    type="radio"
                    name="foodPreference"
                    value="VEG"
                    checked={foodPreference === "VEG"}
                    onChange={() => setFoodPreference("VEG")}
                    className="size-5 accent-forest-700"
                  />
                </label>

                <label
                  className={`flex cursor-pointer items-center justify-between rounded-xl border p-4 transition ${
                    foodPreference === "NON_VEG"
                      ? "border-forest-700 bg-forest-900/5 ring-1 ring-forest-700"
                      : "border-border"
                  }`}
                >
                  <div>
                    <span className="font-bold text-forest-900">Non-Vegetarian</span>
                    <p className="text-xs text-muted-foreground">
                      Chicken curry, chicken masala, bhakri/chapati, rice, dal, sweet, salad
                    </p>
                  </div>
                  <input
                    type="radio"
                    name="foodPreference"
                    value="NON_VEG"
                    checked={foodPreference === "NON_VEG"}
                    onChange={() => setFoodPreference("NON_VEG")}
                    className="size-5 accent-forest-700"
                  />
                </label>
              </div>
            </div>
          </section>
        )}

        {/* STEP 3: Activities & Extras */}
        {currentStep === 3 && (
          <section aria-labelledby="step-3-heading" className="space-y-6">
            <div>
              <p className="text-xs font-semibold tracking-wider text-forest-700 uppercase">Step 3 of 5</p>
              <h2
                id="step-3-heading"
                ref={headingRef}
                tabIndex={-1}
                className="font-heading text-2xl font-bold text-forest-900 sm:text-3xl mt-1 focus:outline-none"
              >
                Optional farm activities &amp; extras
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Activities are arranged subject to weather conditions and farm availability.
              </p>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {activities.map((act) => {
                const isChecked = selectedActivitySlugs.includes(act.slug);
                return (
                  <label
                    key={act.id}
                    className={`flex cursor-pointer items-start justify-between rounded-xl border p-4 transition ${
                      isChecked
                        ? "border-forest-700 bg-forest-900/5 ring-1 ring-forest-700"
                        : "border-border hover:border-forest-700/30"
                    }`}
                  >
                    <div className="pr-3">
                      <span className="text-sm font-semibold text-forest-900">{act.name}</span>
                      {act.isExtraCost && (
                        <p className="mt-0.5 text-xs text-laterite-600 font-medium">
                          Extra cost / Subject to prior notice
                        </p>
                      )}
                      {act.conditionsNote && (
                        <p className="text-xs text-muted-foreground">{act.conditionsNote}</p>
                      )}
                    </div>
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedActivitySlugs((prev) => [...prev, act.slug]);
                        } else {
                          setSelectedActivitySlugs((prev) => prev.filter((s) => s !== act.slug));
                        }
                      }}
                      className="size-5 accent-forest-700 mt-0.5 shrink-0"
                    />
                  </label>
                );
              })}
            </div>

            {/* Additional notes for extras */}
            <div className="pt-2">
              <label htmlFor="extras-notes-input" className="block text-sm font-medium text-forest-900">
                Special dietary or activity requests (e.g. barbecue, mutton/fish per kg request)
              </label>
              <textarea
                id="extras-notes-input"
                rows={2}
                value={extrasNotes}
                onChange={(e) => setExtrasNotes(e.target.value)}
                placeholder="Mention any specific activities or catering requests..."
                className="mt-1.5 w-full rounded-lg border border-border bg-background p-3 text-sm focus:border-forest-700 focus:outline-none focus:ring-1 focus:ring-forest-700"
              />
            </div>
          </section>
        )}

        {/* STEP 4: Contact Details & Special Requests */}
        {currentStep === 4 && (
          <section aria-labelledby="step-4-heading" className="space-y-6">
            <div>
              <p className="text-xs font-semibold tracking-wider text-forest-700 uppercase">Step 4 of 5</p>
              <h2
                id="step-4-heading"
                ref={headingRef}
                tabIndex={-1}
                className="font-heading text-2xl font-bold text-forest-900 sm:text-3xl mt-1 focus:outline-none"
              >
                Guest contact information
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                We need these details to confirm your booking and send reservation instructions.
              </p>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div id="field-contactName">
                <label htmlFor="contact-name" className="block text-sm font-semibold text-forest-900">
                  Full Name <span className="text-destructive">*</span>
                </label>
                <Input
                  id="contact-name"
                  type="text"
                  autoComplete="name"
                  value={contactName}
                  onChange={(e) => setContactName(e.target.value)}
                  placeholder="e.g. Anand Shinde"
                  className="mt-1 min-h-[44px]"
                  required
                />
                {fieldErrors.contactName && (
                  <p className="mt-1 text-xs text-destructive">{fieldErrors.contactName[0]}</p>
                )}
              </div>

              <div id="field-contactPhone">
                <label htmlFor="contact-phone" className="block text-sm font-semibold text-forest-900">
                  Phone Number <span className="text-destructive">*</span>
                </label>
                <Input
                  id="contact-phone"
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel"
                  value={contactPhone}
                  onChange={(e) => setContactPhone(e.target.value)}
                  placeholder="+91 98765 43210"
                  className="mt-1 min-h-[44px]"
                  required
                />
                {fieldErrors.contactPhone && (
                  <p className="mt-1 text-xs text-destructive">{fieldErrors.contactPhone[0]}</p>
                )}
              </div>
            </div>

            <div id="field-contactEmail">
              <label htmlFor="contact-email" className="block text-sm font-semibold text-forest-900">
                Email Address (Optional)
              </label>
              <Input
                id="contact-email"
                type="email"
                autoComplete="email"
                value={contactEmail}
                onChange={(e) => setContactEmail(e.target.value)}
                placeholder="anand@example.com"
                className="mt-1 min-h-[44px]"
              />
              <p className="mt-1 text-xs text-muted-foreground">
                Used to deliver your booking confirmation and stay details.
              </p>
              {fieldErrors.contactEmail && (
                <p className="mt-1 text-xs text-destructive">{fieldErrors.contactEmail[0]}</p>
              )}
            </div>

            {/* Coupon Code (Only rendered when setting feature.coupons is true) */}
            {settings.featureCoupons && (
              <div>
                <label htmlFor="coupon-code-input" className="block text-sm font-semibold text-forest-900">
                  Reward Coupon Code
                </label>
                <div className="mt-1 flex gap-2">
                  <Input
                    id="coupon-code-input"
                    type="text"
                    value={couponCode}
                    onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                    placeholder="e.g. FARM100"
                    className="min-h-[44px] uppercase"
                  />
                </div>
              </div>
            )}

            <div>
              <label htmlFor="special-requests-input" className="block text-sm font-semibold text-forest-900">
                Special requests / notes for the farm team
              </label>
              <textarea
                id="special-requests-input"
                rows={3}
                value={specialRequests}
                onChange={(e) => setSpecialRequests(e.target.value)}
                placeholder="Arrival timing, elderly guests assistance, children food preferences, etc."
                className="mt-1.5 w-full rounded-lg border border-border bg-background p-3 text-sm focus:border-forest-700 focus:outline-none focus:ring-1 focus:ring-forest-700"
              />
            </div>
          </section>
        )}

        {/* STEP 5: Review & Mandatory Policy Acceptance */}
        {currentStep === 5 && (
          <section aria-labelledby="step-5-heading" className="space-y-6">
            <div>
              <p className="text-xs font-semibold tracking-wider text-forest-700 uppercase">Step 5 of 5</p>
              <h2
                id="step-5-heading"
                ref={headingRef}
                tabIndex={-1}
                className="font-heading text-2xl font-bold text-forest-900 sm:text-3xl mt-1 focus:outline-none"
              >
                Review booking &amp; confirm request
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Please review your live estimate and stay rules before submitting.
              </p>
            </div>

            {/* Live Estimate Card */}
            <div
              aria-live="polite"
              className="rounded-xl border border-forest-700/20 bg-forest-900/5 p-5 space-y-4"
            >
              <div className="flex items-center justify-between border-b border-border pb-3">
                <span className="font-heading text-lg font-bold text-forest-900">
                  Estimated Summary
                </span>
                <span className="rounded-full bg-turmeric-500/20 px-3 py-1 text-xs font-bold text-turmeric-700">
                  Estimate — final amount confirmed by our team
                </span>
              </div>

              {quoteLoading ? (
                <div className="py-6 text-center text-sm text-muted-foreground">
                  Calculating live estimate...
                </div>
              ) : quoteError ? (
                <div className="py-3 text-sm text-destructive">{quoteError}</div>
              ) : activeEstimate ? (
                <div className="space-y-3">
                  <div className="space-y-1.5 text-sm">
                    {activeEstimate.lines.map((line) => (
                      <div key={line.description} className="flex justify-between text-muted-foreground">
                        <span>
                          {line.description} (×{line.quantity})
                        </span>
                        <span>{line.formattedTotal}</span>
                      </div>
                    ))}
                  </div>

                  <div className="border-t border-border pt-3 flex items-baseline justify-between">
                    <div>
                      <span className="font-heading text-xl font-bold text-forest-900">
                        Total Estimate
                      </span>
                      <p className="text-xs text-muted-foreground">
                        {activeEstimate.nights} night(s) · {adults} adult(s)
                        {children4to10 > 0 ? ` · ${children4to10} kid(s)` : ""}
                      </p>
                    </div>
                    <span className="font-heading text-2xl font-bold text-forest-900">
                      {activeEstimate.formattedTotal}
                    </span>
                  </div>

                  {activeEstimate.requiresManualQuote && (
                    <div className="rounded-lg bg-turmeric-500/15 p-3 text-xs text-foreground">
                      <strong>Manual Quote Required:</strong>{" "}
                      {activeEstimate.manualQuoteReason ||
                        "Our reservations team will calculate custom group rates."}
                    </div>
                  )}
                </div>
              ) : null}
            </div>

            {/* Booking Details Summary */}
            <div className="rounded-xl border border-border p-4 text-sm space-y-2">
              <div className="flex justify-between py-1 border-b border-border">
                <span className="text-muted-foreground">Stay Option</span>
                <span className="font-semibold text-forest-900">{selectedStay?.name}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-border">
                <span className="text-muted-foreground">Dates</span>
                <span className="font-semibold text-forest-900">
                  {checkInIso ? formatDateDDMMYYYY(new Date(checkInIso + "T00:00:00")) : "—"}{" "}
                  {!selectedStay?.isDayVisit && checkOutIso
                    ? `to ${formatDateDDMMYYYY(new Date(checkOutIso + "T00:00:00"))}`
                    : "(Day visit)"}
                </span>
              </div>
              <div className="flex justify-between py-1 border-b border-border">
                <span className="text-muted-foreground">Food</span>
                <span className="font-semibold text-forest-900">
                  {foodPreference === "VEG" ? "Pure Vegetarian" : "Non-Vegetarian"}
                </span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-muted-foreground">Guest Contact</span>
                <span className="font-semibold text-forest-900">
                  {contactName} ({contactPhone})
                </span>
              </div>
            </div>

            {/* Stay Rules & Policies Summary */}
            <div className="rounded-xl border border-border bg-card p-4 space-y-3">
              <h3 className="font-heading text-base font-bold text-forest-900">
                {policy.title}
              </h3>
              <div
                className="max-h-48 overflow-y-auto rounded-lg border border-border/60 bg-muted/30 p-3 text-xs leading-relaxed text-muted-foreground space-y-2 prose prose-xs"
                dangerouslySetInnerHTML={{ __html: policy.html }}
              />

              {/* Mandatory Policy Acceptance Checkbox */}
              <div id="field-policy" className="pt-2">
                <label className="flex items-start gap-3 cursor-pointer text-sm leading-5">
                  <input
                    type="checkbox"
                    checked={policyAccepted}
                    onChange={(e) => setPolicyAccepted(e.target.checked)}
                    className="size-5 accent-forest-700 mt-0.5 shrink-0"
                    required
                  />
                  <span>
                    I have read and agree to the <strong>Stay Rules and Cancellation Policy</strong>{" "}
                    (ID mandatory at check-in; 100% payment required for confirmation; outside food &amp; pets not permitted).
                  </span>
                </label>
                {fieldErrors.policy && (
                  <p className="mt-1 text-xs text-destructive">{fieldErrors.policy[0]}</p>
                )}
              </div>
            </div>

            {/* Turnstile Security Check */}
            <div className="pt-2">
              <TurnstileField onToken={(token) => setTurnstileToken(token ?? "")} />
              {fieldErrors.turnstileToken && (
                <p className="mt-1 text-xs text-destructive">{fieldErrors.turnstileToken[0]}</p>
              )}
            </div>
          </section>
        )}

        {/* Stepper Navigation Buttons */}
        <div className="mt-8 flex items-center justify-between border-t border-border pt-5">
          {currentStep > 1 ? (
            <Button
              type="button"
              variant="outline"
              onClick={handlePrev}
              disabled={submitting}
              className="min-h-[44px] px-5"
            >
              Previous
            </Button>
          ) : (
            <div />
          )}

          {currentStep < 5 ? (
            <Button
              type="button"
              onClick={handleNext}
              className="min-h-[44px] gap-2 px-6 bg-forest-700 hover:bg-forest-900 text-white font-semibold"
            >
              Continue
              <ChevronRight className="size-4" />
            </Button>
          ) : (
            <Button
              type="button"
              onClick={handleSubmitBooking}
              disabled={submitting || !policyAccepted}
              className="min-h-[44px] px-8 bg-forest-700 hover:bg-forest-900 text-white font-bold tracking-wide"
            >
              {submitting ? "Submitting Request..." : "Confirm & Send Booking Request"}
            </Button>
          )}
        </div>
      </div>

      {/* Mobile Sticky Estimate Bar (Collapsible, doesn't obscure inputs) */}
      {activeEstimate && (
        <div className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur border-t border-border p-3 shadow-lg lg:hidden">
          <div className="mx-auto flex max-w-md items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground font-medium">Estimated Total</p>
              <p className="font-heading text-lg font-bold text-forest-900">
                {activeEstimate.formattedTotal}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setMobileSummaryExpanded((prev) => !prev)}
              className="text-xs font-semibold text-forest-700 underline focus:outline-none"
            >
              {mobileSummaryExpanded ? "Hide Details" : "View Breakdown"}
            </button>
          </div>

          {mobileSummaryExpanded && (
            <div className="mx-auto max-w-md mt-2 pt-2 border-t border-border text-xs text-muted-foreground space-y-1">
              <p>Step {currentStep} of 5: {stepTitles[currentStep - 1]}</p>
              <p>{activeEstimate.disclaimer}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
