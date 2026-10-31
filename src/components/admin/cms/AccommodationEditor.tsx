"use client";

/* eslint security/detect-object-injection: off -- Locale access is restricted to the fixed SUPPORTED_LOCALES tuple and field path union. */

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { useForm, useWatch } from "react-hook-form";
import type { z } from "zod";

import { MediaGalleryField } from "@/components/admin/cms/MediaGalleryField";
import { MediaReferenceField } from "@/components/admin/cms/MediaReferenceField";
import { PublishBar } from "@/components/admin/cms/PublishBar";
import { ConfirmDialog } from "@/components/admin/ConfirmDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { SupportedLocale } from "@/config/locales";
import { accommodationFormSchema } from "@/lib/schemas/cms/accommodation";
import { saveAccommodationAction, softDeleteCmsEntityAction } from "@/server/actions/cms";

type AccommodationFormInput = z.input<typeof accommodationFormSchema>;
type MediaOption = { id: string; publicId: string; kind: "IMAGE"; altText: unknown; format: string | null };
const ADMIN_LOCALES = ["en"] as const satisfies readonly SupportedLocale[];

function ServerErrors({ errors }: { errors?: Record<string, string[]> }) {
  if (!errors) return null;
  const messages = Object.entries(errors).flatMap(([field, values]) => values.map((message) => `${field}: ${message}`));
  return messages.length ? <ul className="grid gap-1 text-xs text-destructive">{messages.map((message, index) => <li key={`${index}-${message}`}>{message}</li>)}</ul> : null;
}

export function AccommodationEditor({ initial, mediaOptions, cloudName, canWrite, canPublish, canDelete, adminPath = "/admin/accommodation" }: {
  initial: AccommodationFormInput & { status?: "DRAFT" | "SCHEDULED" | "PUBLISHED" | "ARCHIVED"; publishAt?: Date | string | null };
  mediaOptions: MediaOption[];
  cloudName?: string;
  canWrite: boolean;
  canPublish: boolean;
  canDelete: boolean;
  adminPath?: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState("");
  const [serverErrors, setServerErrors] = useState<Record<string, string[]> | undefined>();
  const { status, publishAt, ...formDefaults } = initial;
  const form = useForm<AccommodationFormInput, unknown, z.output<typeof accommodationFormSchema>>({ resolver: zodResolver(accommodationFormSchema), defaultValues: formDefaults });
  const id = initial.id;
  const selectedMediaId = useWatch({ control: form.control, name: "heroMediaId" }) ?? "";
  const galleryMediaIds = useWatch({ control: form.control, name: "imageMediaIds" }) ?? [];

  function submit(data: z.output<typeof accommodationFormSchema>) {
    setServerErrors(undefined);
    startTransition(async () => {
      const payload = id ? { ...data, id } : data;
      const result = await saveAccommodationAction(payload);
      if (!result.ok) {
        setMessage(result.error.message);
        if (result.error.fieldErrors) setServerErrors(result.error.fieldErrors);
        return;
      }
      setMessage("Accommodation saved.");
      router.push(`${adminPath}/${result.data.id}`);
      router.refresh();
    });
  }

  async function softDelete() {
    if (!id) return;
    const result = await softDeleteCmsEntityAction({ entityType: "accommodation", id });
    setMessage(result.ok ? "Accommodation moved to trash." : result.error.message);
    if (result.ok) router.push(adminPath);
  }

  return <div className="grid gap-6">
    <PublishBar entityType="accommodation" id={id} status={status ?? "DRAFT"} publishAt={publishAt ? new Date(publishAt) : null} canPublish={canPublish} />
    <form
      onSubmit={form.handleSubmit(submit, (errors) => {
        const errorList = Object.keys(errors);
        if (errorList.length > 0) {
          setMessage("Please review the form for errors before saving.");
        }
      })}
      className="grid gap-6 rounded-2xl border border-border/70 bg-card p-5 sm:p-7"
    >
      <input type="hidden" {...form.register("id")} />
      <div><h1 className="font-heading text-3xl text-forest-900">{id ? "Edit accommodation" : "Create accommodation"}</h1><p className="mt-1 text-sm text-muted-foreground">Use only client-confirmed names, descriptions and amenities. Unknown capacity values may remain blank.</p></div>
      <div className="grid gap-4 sm:grid-cols-2"><label className="grid gap-1 text-xs font-medium">Slug<Input {...form.register("slug")} aria-invalid={Boolean(form.formState.errors.slug)} /><span className="text-destructive">{form.formState.errors.slug?.message}</span></label><label className="grid gap-1 text-xs font-medium">Accommodation type<select {...form.register("type")} className="min-h-11 rounded-lg border border-input bg-background px-3 text-sm"><option value="TENT">Tent</option><option value="DORMITORY">Dormitory</option><option value="GUEST_HOUSE">Guest house</option><option value="CAMP_LAWN">Camp lawn</option><option value="DAY_VISIT">Day visit</option><option value="COTTAGE">Cottage</option></select><span className="text-destructive">{form.formState.errors.type?.message}</span></label></div>
      <fieldset className="grid gap-3 rounded-xl border border-border/70 p-4"><legend className="px-1 text-sm font-semibold">Name · English required</legend>{ADMIN_LOCALES.map((locale) => <LocalizedInput key={locale} locale={locale} path="name" register={form.register} error={form.formState.errors.name?.[locale]?.message} required={locale === "en"} />)}</fieldset>
      <fieldset className="grid gap-3 rounded-xl border border-border/70 p-4"><legend className="px-1 text-sm font-semibold">Summary</legend>{ADMIN_LOCALES.map((locale) => <LocalizedInput key={locale} locale={locale} path="summary" register={form.register} error={form.formState.errors.summary?.[locale]?.message} />)}</fieldset>
      <fieldset className="grid gap-3 rounded-xl border border-border/70 p-4"><legend className="px-1 text-sm font-semibold">Description</legend>{ADMIN_LOCALES.map((locale) => <LocalizedInput key={locale} locale={locale} path="description" register={form.register} error={form.formState.errors.description?.[locale]?.message} multiline />)}</fieldset>
      <fieldset className="grid gap-3 rounded-xl border border-border/70 p-4"><legend className="px-1 text-sm font-semibold">Amenities</legend>{ADMIN_LOCALES.map((locale) => <LocalizedInput key={locale} locale={locale} path="amenities" register={form.register} error={form.formState.errors.amenities?.[locale]?.message} multiline />)}</fieldset>
      <div className="grid gap-4 sm:grid-cols-2"><label className="grid gap-1 text-xs font-medium">Total units/capacity (optional)<Input inputMode="numeric" {...form.register("unitsTotal")} /><span className="text-destructive">{form.formState.errors.unitsTotal?.message}</span></label><label className="grid gap-1 text-xs font-medium">Maximum guests (optional)<Input inputMode="numeric" {...form.register("maxGuests")} /><span className="text-destructive">{form.formState.errors.maxGuests?.message}</span></label></div>
      <MediaReferenceField label="Hero image" value={selectedMediaId} items={mediaOptions} cloudName={cloudName} disabled={!canWrite} onChange={(value) => form.setValue("heroMediaId", value, { shouldDirty: true })} />
      <MediaGalleryField value={galleryMediaIds} items={mediaOptions} cloudName={cloudName} disabled={!canWrite} onChange={(value) => form.setValue("imageMediaIds", value, { shouldDirty: true })} />
      <ServerErrors errors={serverErrors} />
      {message ? <p role="status" className="text-sm text-muted-foreground">{message}</p> : null}<div className="flex flex-wrap gap-2"><Button type="submit" disabled={!canWrite || pending}>{pending ? "Saving…" : "Save accommodation"}</Button>{id && canDelete ? <ConfirmDialog trigger={<Button type="button" variant="destructive">Move to trash</Button>} title="Move this accommodation to trash?" description="The accommodation can be restored. Existing bookings and inventory records are retained." confirmLabel="Move to trash" destructive onConfirm={softDelete} /> : null}</div>
      {!canWrite ? <p className="text-xs text-muted-foreground">You do not have permission to edit CMS content.</p> : null}
    </form>
  </div>;
}

function LocalizedInput({ locale, path, register, error, multiline = false, required = false }: {
  locale: SupportedLocale;
  path: "name" | "summary" | "description" | "amenities";
  register: ReturnType<typeof useForm<AccommodationFormInput>>["register"];
  error?: string;
  multiline?: boolean;
  required?: boolean;
}) {
  const name = `${path}.${locale}` as const;
  return <label className="grid gap-1 text-xs font-medium">English{required ? " · required" : ""}{multiline ? <Textarea {...register(name)} required={required} aria-invalid={Boolean(error)} /> : <Input {...register(name)} required={required} aria-invalid={Boolean(error)} />}<span className="text-destructive">{error}</span></label>;
}
