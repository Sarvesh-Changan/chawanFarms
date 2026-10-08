"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { useFieldArray, useForm } from "react-hook-form";
import type { z } from "zod";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { SUPPORTED_LOCALES } from "@/config/locales";
import { settingsFormSchema } from "@/lib/schemas/cms/settings";
import { saveCmsSettingsAction } from "@/server/actions/cms";
import type { CmsSettings } from "@/server/services/cms/settings";

type SettingsInput = z.input<typeof settingsFormSchema>;

export function SettingsEditor({ initial, canWrite }: { initial: CmsSettings; canWrite: boolean }) {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [pending, startTransition] = useTransition();
  const form = useForm<SettingsInput, unknown, z.output<typeof settingsFormSchema>>({ resolver: zodResolver(settingsFormSchema), defaultValues: initial });
  const socialLinks = useFieldArray({ control: form.control, name: "socialLinks" });

  function submit(data: z.output<typeof settingsFormSchema>) {
    startTransition(async () => {
      const result = await saveCmsSettingsAction(data);
      setMessage(result.ok ? "Settings saved." : result.error.message);
      if (result.ok) router.refresh();
      if (!result.ok && result.error.fieldErrors) {
        const fieldErrors = result.error.fieldErrors;
        if (fieldErrors.businessName?.[0]) form.setError("businessName", { type: "server", message: fieldErrors.businessName[0] });
        if (fieldErrors.businessPhones?.[0]) form.setError("businessPhones", { type: "server", message: fieldErrors.businessPhones[0] });
        if (fieldErrors.businessEmail?.[0]) form.setError("businessEmail", { type: "server", message: fieldErrors.businessEmail[0] });
        if (fieldErrors.address?.[0]) form.setError("address", { type: "server", message: fieldErrors.address[0] });
        if (fieldErrors.socialLinks?.[0]) form.setError("socialLinks", { type: "server", message: fieldErrors.socialLinks[0] });
        if (fieldErrors.whatsappNumber?.[0]) form.setError("whatsappNumber", { type: "server", message: fieldErrors.whatsappNumber[0] });
        if (fieldErrors.whatsappDefaultMessage?.[0]) form.setError("whatsappDefaultMessage", { type: "server", message: fieldErrors.whatsappDefaultMessage[0] });
        if (fieldErrors.minLeadTimeHours?.[0]) form.setError("minLeadTimeHours", { type: "server", message: fieldErrors.minLeadTimeHours[0] });
        if (fieldErrors.minimumGroupSize?.[0]) form.setError("minimumGroupSize", { type: "server", message: fieldErrors.minimumGroupSize[0] });
        if (fieldErrors.checkInTime?.[0]) form.setError("checkInTime", { type: "server", message: fieldErrors.checkInTime[0] });
        if (fieldErrors.checkOutTime?.[0]) form.setError("checkOutTime", { type: "server", message: fieldErrors.checkOutTime[0] });
        if (fieldErrors.bookingPolicyText?.[0]) form.setError("bookingPolicyText", { type: "server", message: fieldErrors.bookingPolicyText[0] });
        if (fieldErrors.notificationRecipients?.[0]) form.setError("notificationRecipients", { type: "server", message: fieldErrors.notificationRecipients[0] });
      }
    });
  }

  return <form onSubmit={form.handleSubmit(submit)} className="grid gap-6">
    <section className="grid gap-4 rounded-2xl border border-border/70 bg-card p-5 sm:p-7">
      <div><h2 className="font-heading text-2xl text-forest-900">Business information</h2><p className="mt-1 text-sm text-muted-foreground">Existing PDF-sourced values are shown where available. Keep unconfirmed email and WhatsApp values empty.</p></div>
      <LocalizedFieldset title="Business name" path="businessName" form={form} required />
      <LocalizedFieldset title="Address" path="address" form={form} required multiline />
      <label className="grid gap-1 text-xs font-medium">Phone numbers (one per line)<Textarea rows={4} {...form.register("businessPhones")} aria-invalid={Boolean(form.formState.errors.businessPhones)} /><span className="text-destructive">{form.formState.errors.businessPhones?.message}</span></label>
      <label className="grid gap-1 text-xs font-medium">Business email (optional)<Input type="email" {...form.register("businessEmail")} aria-invalid={Boolean(form.formState.errors.businessEmail)} /><span className="text-destructive">{form.formState.errors.businessEmail?.message}</span></label>
      <fieldset className="grid gap-3"><legend className="text-sm font-semibold">Social links</legend>{socialLinks.fields.map((field, index) => <div key={field.id} className="grid items-end gap-2 sm:grid-cols-[1fr_2fr_auto]"><label className="grid gap-1 text-xs font-medium">Label<Input {...form.register(`socialLinks.${index}.label`)} /></label><label className="grid gap-1 text-xs font-medium">HTTPS URL<Input type="url" {...form.register(`socialLinks.${index}.url`)} /></label><Button type="button" variant="outline" onClick={() => socialLinks.remove(index)}>Remove</Button></div>)}<Button type="button" variant="outline" className="w-fit" onClick={() => socialLinks.append({ label: "", url: "" })}>Add social link</Button><p className="text-xs text-muted-foreground">Only add profiles supplied or approved by the client.</p></fieldset>
    </section>
    <section className="grid gap-4 rounded-2xl border border-border/70 bg-card p-5 sm:p-7">
      <div><h2 className="font-heading text-2xl text-forest-900">WhatsApp</h2><p className="mt-1 text-sm text-muted-foreground">These fields are optional; the source PDF does not provide a WhatsApp number or default message.</p></div>
      <label className="grid gap-1 text-xs font-medium">WhatsApp number (optional)<Input {...form.register("whatsappNumber")} aria-invalid={Boolean(form.formState.errors.whatsappNumber)} /><span className="text-destructive">{form.formState.errors.whatsappNumber?.message}</span></label>
      <LocalizedFieldset title="Default message (optional)" path="whatsappDefaultMessage" form={form} multiline />
    </section>
    <section className="grid gap-4 rounded-2xl border border-border/70 bg-card p-5 sm:p-7">
      <div><h2 className="font-heading text-2xl text-forest-900">Booking settings</h2><p className="mt-1 text-sm text-muted-foreground">Blank means no value has been configured. This editor does not infer booking defaults or policy from unresolved client questions.</p></div>
      <div className="grid gap-4 sm:grid-cols-2"><label className="grid gap-1 text-xs font-medium">Minimum lead time (hours)<Input inputMode="numeric" {...form.register("minLeadTimeHours")} /><span className="text-destructive">{form.formState.errors.minLeadTimeHours?.message}</span></label><label className="grid gap-1 text-xs font-medium">Minimum group size<Input inputMode="numeric" {...form.register("minimumGroupSize")} /><span className="text-destructive">{form.formState.errors.minimumGroupSize?.message}</span></label><label className="grid gap-1 text-xs font-medium">Default check-in time<Input type="time" {...form.register("checkInTime")} /><span className="text-destructive">{form.formState.errors.checkInTime?.message}</span></label><label className="grid gap-1 text-xs font-medium">Default check-out time<Input type="time" {...form.register("checkOutTime")} /><span className="text-destructive">{form.formState.errors.checkOutTime?.message}</span></label></div>
      <LocalizedFieldset title="Booking policy text (optional)" path="bookingPolicyText" form={form} multiline />
    </section>
    <section className="grid gap-4 rounded-2xl border border-border/70 bg-card p-5 sm:p-7">
      <div><h2 className="font-heading text-2xl text-forest-900">Notification recipients</h2><p className="mt-1 text-sm text-muted-foreground">Enter one email per line. Recipients are optional until configured.</p></div>
      <label className="grid gap-1 text-xs font-medium">Email recipients<Textarea rows={4} {...form.register("notificationRecipients")} aria-invalid={Boolean(form.formState.errors.notificationRecipients)} /><span className="text-destructive">{form.formState.errors.notificationRecipients?.message}</span></label>
    </section>
    {message ? <p role="status" className="text-sm text-muted-foreground">{message}</p> : null}
    <div className="flex flex-wrap items-center gap-3"><Button type="submit" disabled={!canWrite || pending}>{pending ? "Saving settings…" : "Save settings"}</Button>{!canWrite ? <span className="text-xs text-muted-foreground">Settings write permission is required.</span> : null}</div>
  </form>;
}

function LocalizedFieldset({ title, path, form, required = false, multiline = false }: {
  title: string;
  path: "businessName" | "address" | "whatsappDefaultMessage" | "bookingPolicyText";
  form: ReturnType<typeof useForm<SettingsInput, unknown, z.output<typeof settingsFormSchema>>>;
  required?: boolean;
  multiline?: boolean;
}) {
  const nestedErrors = path === "businessName" ? form.formState.errors.businessName
    : path === "address" ? form.formState.errors.address
      : path === "whatsappDefaultMessage" ? form.formState.errors.whatsappDefaultMessage
        : form.formState.errors.bookingPolicyText;
  return <fieldset className="grid gap-3 rounded-xl border border-border/70 p-4"><legend className="px-1 text-sm font-semibold">{title}{required ? " · English required" : ""}</legend>{SUPPORTED_LOCALES.map((locale) => {
    const fieldPath = `${path}.${locale}` as const;
    const localizedError = locale === "en" ? nestedErrors?.en : locale === "mr" ? nestedErrors?.mr : nestedErrors?.hi;
    const error = localizedError && "message" in localizedError ? String(localizedError.message ?? "") : undefined;
    return <label key={locale} className="grid gap-1 text-xs font-medium uppercase">{locale}{required && locale === "en" ? " · required" : ""}{multiline ? <Textarea {...form.register(fieldPath)} required={required && locale === "en"} /> : <Input {...form.register(fieldPath)} required={required && locale === "en"} />}<span className="text-destructive">{error}</span></label>;
  })}</fieldset>;
}

