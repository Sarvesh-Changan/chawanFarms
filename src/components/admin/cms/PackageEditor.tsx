"use client";

/* eslint security/detect-object-injection: off -- Locale access is restricted to the fixed SUPPORTED_LOCALES tuple and field path union. */

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { useForm, useWatch } from "react-hook-form";
import type { UseFormRegister } from "react-hook-form";
import type { z } from "zod";

import { MediaReferenceField } from "@/components/admin/cms/MediaReferenceField";
import { PublishBar } from "@/components/admin/cms/PublishBar";
import { ConfirmDialog } from "@/components/admin/ConfirmDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { SUPPORTED_LOCALES, type SupportedLocale } from "@/config/locales";
import { formatINR } from "@/lib/money";
import { packageFormSchema, packageRateFormSchema } from "@/lib/schemas/cms/package";
import { createPackageRateAction, savePackageAction, softDeleteCmsEntityAction } from "@/server/actions/cms";

type PackageFormInput = z.input<typeof packageFormSchema>;
type PackageRateInput = z.input<typeof packageRateFormSchema>;
type LocalizedRecord = { en: string; mr: string; hi: string };
type LocalizedErrors = Partial<Record<SupportedLocale, { message?: string }>>;
type PackageRateRow = {
  id: string;
  foodPreference: "VEG" | "NON_VEG" | null;
  audience: "ADULT" | "CHILD_4_10" | "INFANT_UNDER_4";
  unit: string;
  amountPaise: number;
  percentOfAdult: number | null;
  validFrom: Date | null;
  validTo: Date | null;
  seasonLabel: string | null;
  isActive: boolean;
};
type MediaOption = { id: string; publicId: string; kind: "IMAGE"; altText: unknown; format: string | null };

function localizedForm(value: unknown): LocalizedRecord {
  if (!value || typeof value !== "object" || Array.isArray(value)) return { en: "", mr: "", hi: "" };
  const record = value as Record<string, unknown>;
  return {
    en: typeof record.en === "string" ? record.en : "",
    mr: typeof record.mr === "string" ? record.mr : "",
    hi: typeof record.hi === "string" ? record.hi : "",
  };
}

function dateInput(value: Date | null): string {
  return value ? new Date(value).toISOString().slice(0, 10) : "";
}

function ServerErrors({ errors }: { errors?: Record<string, string[]> }) {
  if (!errors) return null;
  const messages = Object.entries(errors).flatMap(([field, values]) => values.map((message) => `${field}: ${message}`));
  return messages.length ? <ul className="grid gap-1 text-xs text-destructive">{messages.map((message, index) => <li key={`${index}-${message}`}>{message}</li>)}</ul> : null;
}

function PackageRateEditor({ packageId, rates }: { packageId: string; rates: PackageRateRow[] }) {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [serverErrors, setServerErrors] = useState<Record<string, string[]> | undefined>();
  const [pending, startTransition] = useTransition();
  const form = useForm<PackageRateInput, unknown, z.output<typeof packageRateFormSchema>>({
    resolver: zodResolver(packageRateFormSchema),
    defaultValues: {
      packageId,
      foodPreference: "",
      audience: "",
      unit: "",
      amountRupees: "",
      percentOfAdult: "",
      validFrom: "",
      validTo: "",
      seasonLabel: "",
    },
  });

  function submit(input: z.output<typeof packageRateFormSchema>) {
    setServerErrors(undefined);
    startTransition(async () => {
      const result = await createPackageRateAction(input);
      if (!result.ok) {
        setMessage(result.error.message);
        setServerErrors(result.error.fieldErrors);
        return;
      }
      form.reset({ packageId, foodPreference: "", audience: "", unit: "", amountRupees: "", percentOfAdult: "", validFrom: "", validTo: "", seasonLabel: "" });
      setMessage("A new rate version was added; the previously active rate for this audience and food choice was deactivated.");
      router.refresh();
    });
  }

  return <section className="grid gap-5 rounded-2xl border border-border/70 bg-card p-5 sm:p-6">
    <div><h2 className="font-heading text-2xl text-forest-900">Versioned rates</h2><p className="mt-1 text-sm text-muted-foreground">Enter prices in rupees. The database stores integer paise. Validity dates are optional and are never inferred.</p></div>
    {rates.length ? <div className="overflow-x-auto rounded-lg border"><table className="w-full min-w-[44rem] text-left text-xs"><thead className="bg-muted"><tr><th className="p-3">Audience</th><th className="p-3">Food</th><th className="p-3">Rate</th><th className="p-3">Validity</th><th className="p-3">Season</th><th className="p-3">State</th></tr></thead><tbody className="divide-y">{rates.map((rate) => <tr key={rate.id}><td className="p-3">{rate.audience.toLowerCase().replaceAll("_", " ")}</td><td className="p-3">{rate.foodPreference?.toLowerCase().replaceAll("_", " ") ?? "No food preference"}</td><td className="p-3">{formatINR(rate.amountPaise)} · {rate.unit.toLowerCase().replaceAll("_", " ")}</td><td className="p-3">{dateInput(rate.validFrom) || "—"} → {dateInput(rate.validTo) || "—"}</td><td className="p-3">{rate.seasonLabel || "—"}</td><td className="p-3">{rate.isActive ? "Active" : "Inactive"}</td></tr>)}</tbody></table></div> : <p className="rounded-lg border border-dashed p-5 text-sm text-muted-foreground">No rate rows have been recorded for this package.</p>}
    <form onSubmit={form.handleSubmit(submit)} className="grid gap-4 border-t pt-5 sm:grid-cols-2 lg:grid-cols-4">
      <label className="grid gap-1 text-xs font-medium">Audience<select {...form.register("audience")} className="min-h-11 rounded-lg border border-input bg-background px-3 text-sm"><option value="">Choose audience</option><option value="ADULT">Adult</option><option value="CHILD_4_10">Child 4–10</option><option value="INFANT_UNDER_4">Under 4</option></select><span className="text-destructive">{form.formState.errors.audience?.message}</span></label>
      <label className="grid gap-1 text-xs font-medium">Food preference<select {...form.register("foodPreference")} className="min-h-11 rounded-lg border border-input bg-background px-3 text-sm"><option value="">No food preference</option><option value="VEG">Veg</option><option value="NON_VEG">Non-veg</option></select><span className="text-destructive">{form.formState.errors.foodPreference?.message}</span></label>
      <label className="grid gap-1 text-xs font-medium">Pricing unit<select {...form.register("unit")} className="min-h-11 rounded-lg border border-input bg-background px-3 text-sm"><option value="">Choose unit</option><option value="PER_PERSON_PER_NIGHT">Per person per night</option><option value="PER_PERSON_PER_DAY">Per person per day</option><option value="PER_UNIT">Per unit</option><option value="FLAT">Flat</option></select><span className="text-destructive">{form.formState.errors.unit?.message}</span></label>
      <label className="grid gap-1 text-xs font-medium">Amount (₹)<Input inputMode="decimal" placeholder="e.g. 1400.00" {...form.register("amountRupees")} aria-invalid={Boolean(form.formState.errors.amountRupees)} /><span className="text-destructive">{form.formState.errors.amountRupees?.message}</span></label>
      <label className="grid gap-1 text-xs font-medium">Percent of adult (optional)<Input inputMode="numeric" {...form.register("percentOfAdult")} /><span className="text-destructive">{form.formState.errors.percentOfAdult?.message}</span></label>
      <label className="grid gap-1 text-xs font-medium">Valid from<Input type="date" {...form.register("validFrom")} /><span className="text-destructive">{form.formState.errors.validFrom?.message}</span></label>
      <label className="grid gap-1 text-xs font-medium">Valid to<Input type="date" {...form.register("validTo")} /><span className="text-destructive">{form.formState.errors.validTo?.message}</span></label>
      <label className="grid gap-1 text-xs font-medium">Season label (optional)<Input {...form.register("seasonLabel")} /><span className="text-destructive">{form.formState.errors.seasonLabel?.message}</span></label>
      <div className="grid gap-2 sm:col-span-2 lg:col-span-4"><ServerErrors errors={serverErrors} />{message ? <p role="status" className="text-xs text-muted-foreground">{message}</p> : null}<Button type="submit" disabled={pending}>{pending ? "Adding rate…" : "Add rate version"}</Button></div>
    </form>
  </section>;
}

export function PackageEditor({ initial, rates, accommodationOptions, activityOptions, mediaOptions, cloudName, canWrite, canPublish, canDelete }: {
  initial: PackageFormInput & { status?: "DRAFT" | "SCHEDULED" | "PUBLISHED" | "ARCHIVED"; publishAt?: Date | null };
  rates: PackageRateRow[];
  accommodationOptions: Array<{ id: string; slug: string; name: unknown }>;
  activityOptions: Array<{ id: string; slug: string; name: unknown }>;
  mediaOptions: MediaOption[];
  cloudName?: string;
  canWrite: boolean;
  canPublish: boolean;
  canDelete: boolean;
}) {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [serverErrors, setServerErrors] = useState<Record<string, string[]> | undefined>();
  const [pending, startTransition] = useTransition();
  const form = useForm<PackageFormInput, unknown, z.output<typeof packageFormSchema>>({ resolver: zodResolver(packageFormSchema), defaultValues: initial });
  const packageId = initial.id;
  const selectedMediaId = useWatch({ control: form.control, name: "heroMediaId" }) ?? "";

  function submit(input: z.output<typeof packageFormSchema>) {
    setServerErrors(undefined);
    startTransition(async () => {
      const result = await savePackageAction(input);
      if (!result.ok) {
        setMessage(result.error.message);
        setServerErrors(result.error.fieldErrors);
        return;
      }
      setMessage("Package saved.");
      router.push(`/admin/cms/packages/${result.data.id}`);
      router.refresh();
    });
  }

  async function softDelete() {
    if (!packageId) return;
    const result = await softDeleteCmsEntityAction({ entityType: "package", id: packageId });
    setMessage(result.ok ? "Package moved to trash." : result.error.message);
    if (result.ok) router.push("/admin/cms/packages");
  }

  return <div className="grid gap-6">
    <PublishBar entityType="package" id={packageId} status={initial.status ?? "DRAFT"} publishAt={initial.publishAt ?? null} canPublish={canPublish} />
    <form onSubmit={form.handleSubmit(submit)} className="grid gap-6 rounded-2xl border border-border/70 bg-card p-5 sm:p-7">
      <div><h1 className="font-heading text-3xl text-forest-900">{packageId ? "Edit package" : "Create package"}</h1><p className="mt-1 text-sm text-muted-foreground">Localised fields require English. Do not add unapproved client content.</p></div>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="grid gap-1 text-xs font-medium">Slug<Input {...form.register("slug")} aria-invalid={Boolean(form.formState.errors.slug)} /><span className="text-destructive">{form.formState.errors.slug?.message}</span></label>
        <label className="grid gap-1 text-xs font-medium">Client package code (optional)<Input {...form.register("code")} /><span className="text-destructive">{form.formState.errors.code?.message}</span></label>
      </div>
      <LocalizedInputs title="Name" path="name" register={form.register} locales={SUPPORTED_LOCALES} errors={form.formState.errors.name as LocalizedErrors} required />
      <LocalizedInputs title="Summary" path="summary" register={form.register} locales={SUPPORTED_LOCALES} errors={form.formState.errors.summary as LocalizedErrors} />
      <LocalizedInputs title="Description" path="description" register={form.register} locales={SUPPORTED_LOCALES} errors={form.formState.errors.description as LocalizedErrors} multiline />
      <LocalizedInputs title="Inclusions" path="inclusions" register={form.register} locales={SUPPORTED_LOCALES} errors={form.formState.errors.inclusions as LocalizedErrors} multiline />
      <LocalizedInputs title="Conditions" path="conditions" register={form.register} locales={SUPPORTED_LOCALES} errors={form.formState.errors.conditions as LocalizedErrors} multiline />
      <LocalizedInputs title="Timing note" path="timingNote" register={form.register} locales={SUPPORTED_LOCALES} errors={form.formState.errors.timingNote as LocalizedErrors} />
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="grid gap-1 text-xs font-medium">Minimum guests (optional)<Input inputMode="numeric" {...form.register("minGuests")} /><span className="text-destructive">{form.formState.errors.minGuests?.message}</span></label>
        <label className="grid gap-1 text-xs font-medium">Maximum guests (optional)<Input inputMode="numeric" {...form.register("maxGuests")} /><span className="text-destructive">{form.formState.errors.maxGuests?.message}</span></label>
      </div>
      <div className="flex flex-wrap gap-6 text-sm"><label className="flex min-h-11 items-center gap-2"><input type="checkbox" {...form.register("isDayVisit")} />Day visit</label><label className="flex min-h-11 items-center gap-2"><input type="checkbox" {...form.register("isGroupOnly")} />Group only</label></div>
      <fieldset className="grid gap-2"><legend className="text-sm font-semibold">Linked accommodation</legend><select multiple size={Math.min(6, Math.max(3, accommodationOptions.length))} {...form.register("accommodationIds")} className="min-h-28 rounded-lg border border-input bg-background p-2 text-sm">{accommodationOptions.map((option) => <option key={option.id} value={option.id}>{localizedForm(option.name).en || option.slug}</option>)}</select><p className="text-xs text-muted-foreground">Use Ctrl/Command to select more than one item. Only existing accommodation records appear here.</p></fieldset>
      <fieldset className="grid gap-2"><legend className="text-sm font-semibold">Linked activities</legend><select multiple size={Math.min(6, Math.max(3, activityOptions.length))} {...form.register("activityIds")} className="min-h-28 rounded-lg border border-input bg-background p-2 text-sm">{activityOptions.map((option) => <option key={option.id} value={option.id}>{localizedForm(option.name).en || option.slug}</option>)}</select><p className="text-xs text-muted-foreground">Only existing activity records appear here.</p></fieldset>
      <MediaReferenceField label="Hero image" value={selectedMediaId} items={mediaOptions} cloudName={cloudName} disabled={!canWrite} onChange={(value) => form.setValue("heroMediaId", value, { shouldDirty: true })} />
      {message ? <p role="status" className="text-sm text-muted-foreground">{message}</p> : null}<ServerErrors errors={serverErrors} />
      <div className="flex flex-wrap gap-2"><Button type="submit" disabled={!canWrite || pending}>{pending ? "Saving…" : "Save package"}</Button>{packageId && canDelete ? <ConfirmDialog trigger={<Button type="button" variant="destructive">Move to trash</Button>} title="Move this package to trash?" description="The package can be restored from the trash. Related bookings and rate history are retained." confirmLabel="Move to trash" destructive onConfirm={softDelete} /> : null}</div>
      {!canWrite ? <p className="text-xs text-muted-foreground">You do not have permission to edit CMS content.</p> : null}
    </form>
    {packageId ? <PackageRateEditor packageId={packageId} rates={rates} /> : <p className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">Save the package before adding rate versions.</p>}
  </div>;
}

function LocalizedInputs(props: {
  title: string;
  path: "name" | "summary" | "description" | "inclusions" | "conditions" | "timingNote";
  register: UseFormRegister<PackageFormInput>;
  locales: readonly SupportedLocale[];
  errors: Record<string, { message?: string }> | undefined;
  multiline?: boolean;
  required?: boolean;
}) {
  const { title, path, register, locales, errors, multiline = false, required = false } = props;
  return <fieldset className="grid gap-3 rounded-xl border border-border/70 p-4"><legend className="px-1 text-sm font-semibold">{title}</legend>{locales.map((locale) => {
    const name = `${path}.${locale}` as const;
    const fieldError = errors?.[locale]?.message;
    return <label key={locale} className="grid gap-1 text-xs font-medium uppercase">{locale}{required && locale === "en" ? " · required" : ""}{multiline ? <Textarea {...register(name)} required={required && locale === "en"} aria-invalid={Boolean(fieldError)} /> : <Input {...register(name)} required={required && locale === "en"} aria-invalid={Boolean(fieldError)} />}<span className="text-destructive">{fieldError}</span></label>;
  })}</fieldset>;
}

