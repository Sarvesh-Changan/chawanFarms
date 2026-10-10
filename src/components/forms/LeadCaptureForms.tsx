"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import type { FormEvent } from "react";
import { useForm } from "react-hook-form";

import { TurnstileField } from "@/components/auth/TurnstileField";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { LEAD_FORM_LIMITS } from "@/config/leads";
import { captureAttributionClient } from "@/lib/attribution";
import { leadFormSchema, type LeadFormInput, type LeadFormValues } from "@/lib/schemas/leads";
import { submitLeadAction } from "@/server/actions/leads";

type FormType = LeadFormInput["formType"];
type LeadFormProps = { heading?: string; description?: string; packageId?: string; activityId?: string; groupSize?: number };

function LeadCaptureForm({ formType, heading, description, packageId, activityId, groupSize }: LeadFormProps & { formType: FormType }) {
  const startedAtRef = useRef(0);
  const submissionPrefix = useId();
  const [submissionCount, setSubmissionCount] = useState(0);
  const [turnstileToken, setTurnstileToken] = useState<string>();
  const attributionRef = useRef<LeadFormValues["attribution"]>(undefined);
  const [serverError, setServerError] = useState("");
  const [successReference, setSuccessReference] = useState("");
  const defaults = useMemo(() => ({
    formType,
    submissionId: `${submissionPrefix}-${submissionCount}`,
    name: "",
    phone: "",
    email: "",
    message: "",
    groupSize,
    packageId,
    activityId,
    consentToContact: false,
    turnstileToken: "",
    honeypot: "",
    startedAt: 1,
    pagePath: "/",
  }), [activityId, formType, groupSize, packageId, submissionCount, submissionPrefix]);
  const form = useForm<LeadFormValues, unknown, LeadFormInput>({ resolver: zodResolver(leadFormSchema), defaultValues: defaults });
  const pending = form.formState.isSubmitting;
  const updateTurnstile = useCallback((token: string | undefined) => {
    setTurnstileToken(token);
    form.setValue("turnstileToken", token ?? "", { shouldValidate: true });
  }, [form]);

  useEffect(() => {
    const path = window.location.pathname;
    form.setValue("pagePath", path);
    attributionRef.current = captureAttributionClient(path, window.location.search, document.referrer);
  }, [form]);

  function beginTimer() {
    if (!startedAtRef.current || successReference) {
      startedAtRef.current = Date.now();
      if (successReference) setSuccessReference("");
    }
  }

  function handleFormSubmit(event: FormEvent<HTMLFormElement>) {
    const startedAt = startedAtRef.current;
    const submissionId = `${submissionPrefix}-${submissionCount}`;
    void form.handleSubmit((values) => submit(values, startedAt, submissionId))(event);
  }

  async function submit(values: LeadFormInput, startedAt: number, submissionId: string) {
    if (!startedAt) { setServerError("Please wait a moment before sending your enquiry."); return; }
    setServerError("");
    setSuccessReference("");
    const result = await submitLeadAction({
      ...values,
      formType,
      packageId,
      activityId,
      groupSize: formType === "CAMP_ORGANISER" || formType === "SCHOOL_GROUP" ? values.groupSize : undefined,
      startedAt,
      submissionId,
      turnstileToken,
      attribution: attributionRef.current,
    });
    if (result.ok) {
      setSuccessReference(result.data.reference);
      setSubmissionCount((count) => count + 1);
      return;
    }
    setServerError(result.error.message);
    if (result.error.fieldErrors) {
      for (const [field, errors] of Object.entries(result.error.fieldErrors)) {
        const message = errors[0];
        if (!message) continue;
        switch (field) {
          case "name": form.setError("name", { message }); break;
          case "phone": form.setError("phone", { message }); break;
          case "email": form.setError("email", { message }); break;
          case "message": form.setError("message", { message }); break;
          case "groupSize": form.setError("groupSize", { message }); break;
          case "preferredStart": form.setError("preferredStart", { message }); break;
          case "preferredEnd": form.setError("preferredEnd", { message }); break;
          case "consentToContact": form.setError("consentToContact", { message }); break;
          case "turnstileToken": form.setError("turnstileToken", { message }); break;
        }
      }
    }
  }

  const inputClass = "border-forest-900/20 bg-background min-h-11 rounded-lg";
  function fieldError(field: string) {
    switch (field) {
      case "name": return form.formState.errors.name?.message;
      case "phone": return form.formState.errors.phone?.message;
      case "email": return form.formState.errors.email?.message;
      case "message": return form.formState.errors.message?.message;
      case "groupSize": return form.formState.errors.groupSize?.message;
      case "preferredStart": return form.formState.errors.preferredStart?.message;
      case "preferredEnd": return form.formState.errors.preferredEnd?.message;
      case "consentToContact": return form.formState.errors.consentToContact?.message;
      case "turnstileToken": return form.formState.errors.turnstileToken?.message;
      default: return undefined;
    }
  }
  return <section className="rounded-2xl border border-border/70 bg-card p-5 shadow-sm sm:p-7">
    <div className="mb-5"><h2 className="font-heading text-2xl text-forest-900">{heading ?? titleFor(formType)}</h2>{description ? <p className="mt-2 text-sm leading-6 text-muted-foreground">{description}</p> : null}</div>
    <form className="grid gap-4" noValidate onFocusCapture={beginTimer} onSubmit={handleFormSubmit}>
      <label className="absolute -left-[10000px] h-px w-px overflow-hidden" aria-hidden="true">Leave this field empty<input tabIndex={-1} autoComplete="off" {...form.register("honeypot")}/></label>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Name" error={fieldError("name")}><Input className={inputClass} autoComplete="name" {...form.register("name")}/></Field>
        <Field label="Phone" error={fieldError("phone")}><Input className={inputClass} autoComplete="tel" inputMode="tel" placeholder="+91 98765 43210" {...form.register("phone")}/></Field>
      </div>
      <Field label="Email (optional)" error={fieldError("email")}><Input className={inputClass} type="email" autoComplete="email" {...form.register("email")}/></Field>
      {formType === "CAMP_ORGANISER" || formType === "SCHOOL_GROUP" ? <Field label={formType === "SCHOOL_GROUP" ? "Students and accompanying adults" : "Group size (30–50)"} error={fieldError("groupSize")}><Input className={inputClass} type="number" min={formType === "CAMP_ORGANISER" ? 30 : 1} max={formType === "CAMP_ORGANISER" ? 50 : 10_000} {...form.register("groupSize", { valueAsNumber: true })}/></Field> : null}
      <div className="grid gap-4 sm:grid-cols-2"><Field label="Preferred start date (optional)" error={fieldError("preferredStart")}><Input className={inputClass} type="date" {...form.register("preferredStart")}/></Field><Field label="Preferred end date (optional)" error={fieldError("preferredEnd")}><Input className={inputClass} type="date" {...form.register("preferredEnd")}/></Field></div>
      <Field label="How can we help?" error={fieldError("message")}><textarea className="min-h-28 rounded-lg border border-forest-900/20 bg-background p-3 text-sm" maxLength={4_000} {...form.register("message")}/></Field>
      <label className="flex gap-3 text-sm leading-6"><input type="checkbox" className="mt-1 size-4 accent-forest-700" {...form.register("consentToContact")}/>I agree to be contacted about this enquiry. This is separate from analytics and marketing tracking consent.</label>
      {fieldError("consentToContact") ? <p className="text-sm text-destructive">{fieldError("consentToContact")}</p> : null}
      <TurnstileField onToken={updateTurnstile}/>
      {serverError ? <p role="alert" className="text-sm text-destructive">{serverError}</p> : null}
      {successReference ? <p role="status" className="rounded-lg bg-leaf-500/10 p-3 text-sm text-forest-900">Thank you. Your enquiry reference is <strong>{successReference}</strong>.</p> : null}
      <Button type="submit" disabled={pending}>{pending ? "Sending…" : "Send enquiry"}</Button>
      <p className="text-xs text-muted-foreground">A short minimum-fill-time check helps reduce automated submissions.</p>
    </form>
    <span className="sr-only" aria-live="polite">Rate limit: {LEAD_FORM_LIMITS.perIp.max} submissions per hour per IP.</span>
  </section>;
}

function titleFor(type: FormType): string {
  switch (type) {
    case "QUICK": return "Quick enquiry";
    case "CONTACT": return "Contact Chawan Farms";
    case "PACKAGE": return "Enquire about this package";
    case "ACTIVITY": return "Enquire about this activity";
    case "CAMP_ORGANISER": return "Camp organiser quote";
    case "SCHOOL_GROUP": return "School group enquiry";
  }
}

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return <label className="grid gap-2 text-sm"><span className="font-medium">{label}</span>{children}{error ? <span className="text-destructive">{error}</span> : null}</label>;
}

export function QuickEnquiryForm(props: LeadFormProps) { return <LeadCaptureForm {...props} formType="QUICK"/>; }
export function ContactForm(props: LeadFormProps) { return <LeadCaptureForm {...props} formType="CONTACT"/>; }
export function PackageEnquiryForm(props: LeadFormProps & { packageId: string }) { return <LeadCaptureForm {...props} formType="PACKAGE"/>; }
export function ActivityEnquiryForm(props: LeadFormProps & { activityId: string }) { return <LeadCaptureForm {...props} formType="ACTIVITY"/>; }
export function CampOrganiserQuoteForm(props: LeadFormProps) { return <LeadCaptureForm {...props} formType="CAMP_ORGANISER"/>; }
export function SchoolGroupForm(props: LeadFormProps) { return <LeadCaptureForm {...props} formType="SCHOOL_GROUP"/>; }
