"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { useFieldArray, useForm, useWatch } from "react-hook-form";
import type { z } from "zod";

import { LocalImageUploader } from "@/components/media/LocalImageUploader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { SUPPORTED_LOCALES } from "@/config/locales";
import { passwordChangeSchema, settingsFormSchema, type SettingsFormValues } from "@/lib/schemas/cms/settings";
import { changeStaffPasswordAction, saveCmsSettingsAction } from "@/server/actions/cms";
import type { CmsSettings } from "@/server/services/cms/settings";

type SettingsInput = SettingsFormValues;
type PasswordInput = z.input<typeof passwordChangeSchema>;

export function SettingsEditor({ initial, canWrite, cloudName }: { initial: CmsSettings; canWrite: boolean; cloudName?: string }) {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [pending, startTransition] = useTransition();
  const form = useForm<SettingsInput, unknown, z.output<typeof settingsFormSchema>>({ resolver: zodResolver(settingsFormSchema as never) as never, defaultValues: initial });
  const phones = useFieldArray({ control: form.control, name: "phones" });
  const ownerMediaId = useWatch({ control: form.control, name: "ownerMediaId" }) ?? null;
  const heroMediaId = useWatch({ control: form.control, name: "heroMediaId" }) ?? null;
  const phoneValues = useWatch({ control: form.control, name: "phones" });
  const phoneErrors = Array.isArray(form.formState.errors.phones) ? form.formState.errors.phones : [];
  function submit(data: z.output<typeof settingsFormSchema>) {
    startTransition(async () => { const result = await saveCmsSettingsAction(data); setMessage(result.ok ? "Settings saved." : result.error.message); if (result.ok) router.refresh(); });
  }
  return <div className="grid gap-6">
    <form onSubmit={form.handleSubmit(submit)} className="grid gap-6">
      <SettingsSection title="Company details" description="Contact details are shown only when configured. Keep unknown values empty.">
        <div className="grid gap-4 sm:grid-cols-2"><LocalizedField title="Business name" path="businessName" form={form} required /><label className="grid gap-1 text-sm font-medium">Email (optional)<Input type="email" {...form.register("businessEmail")} />{error(form.formState.errors.businessEmail)}</label></div>
        <fieldset className="grid gap-3"><legend className="text-sm font-semibold">Phone numbers</legend>{phones.fields.map((field, index) => <div key={field.id} className="grid gap-2 sm:grid-cols-[1fr_auto_auto]"><label className="grid gap-1 text-sm font-medium">Number<Input {...form.register(`phones.${index}.number`)} /></label><label className="flex min-h-11 items-center gap-2 text-sm"><input type="radio" checked={Boolean(phoneValues?.at(index)?.isPrimary)} onChange={() => phones.fields.forEach((_, phoneIndex) => form.setValue(`phones.${phoneIndex}.isPrimary`, phoneIndex === index, { shouldDirty: true }))} /> Primary</label><Button type="button" variant="outline" onClick={() => phones.remove(index)}>Remove</Button>{error(phoneErrors.at(index)?.number)}</div>)}<Button type="button" variant="outline" className="w-fit" onClick={() => phones.append({ number: "", isPrimary: phones.fields.length === 0 })}>Add phone</Button>{error(form.formState.errors.phones)}</fieldset>
        <label className="grid gap-1 text-sm font-medium">WhatsApp number (optional)<Input {...form.register("whatsappNumber")} /><span className="text-xs font-normal text-muted-foreground">Leave empty to hide WhatsApp buttons across the site.</span>{error(form.formState.errors.whatsappNumber)}</label>
        <LocalizedField title="WhatsApp default message" path="whatsappDefaultMessage" form={form} multiline />
        <LocalizedField title="Address" path="address" form={form} multiline />
        <SaveButton pending={pending} disabled={!canWrite} label="Save company details" />
      </SettingsSection>

      <SettingsSection title="Owner portrait" description="This section is hidden by default. Never add owner details unless the client provides them.">
        <label className="flex min-h-11 items-center gap-3 text-sm font-medium"><input type="checkbox" {...form.register("ownerDisplay")} /> Display section on Home page</label>
        <LocalImageUploader label="Owner portrait" value={ownerMediaId ?? ""} media={initial.ownerMedia} cloudName={cloudName} onChange={(value) => form.setValue("ownerMediaId", value, { shouldDirty: true })} onRemove={() => form.setValue("ownerMediaId", null, { shouldDirty: true })} helperText="Recommended landscape image, at least 1200px wide." disabled={!canWrite} />
        <div className="grid gap-4 sm:grid-cols-2"><label className="grid gap-1 text-sm font-medium">Name (optional)<Input {...form.register("ownerName")} /></label><label className="grid gap-1 text-sm font-medium">Short caption (optional)<Textarea rows={3} {...form.register("ownerCaption")} /></label></div>
        {error(form.formState.errors.ownerMediaId)}<SaveButton pending={pending} disabled={!canWrite} label="Save owner portrait" />
      </SettingsSection>

      <SettingsSection title="Hero section content" description="Empty fields fall back to the approved defaults in site-content.ts.">
        <div className="grid gap-4 sm:grid-cols-2"><label className="grid gap-1 text-sm font-medium">Headline<Input {...form.register("heroHeadline")} /></label><label className="grid gap-1 text-sm font-medium">Subhead<Textarea rows={4} {...form.register("heroSubhead")} /></label><label className="grid gap-1 text-sm font-medium">Primary CTA text<Input {...form.register("heroPrimaryCta")} /></label><label className="grid gap-1 text-sm font-medium">Secondary CTA text<Input {...form.register("heroSecondaryCta")} /></label></div>
        <LocalImageUploader label="Home hero image" value={heroMediaId ?? ""} media={initial.heroMedia} cloudName={cloudName} onChange={(value) => form.setValue("heroMediaId", value, { shouldDirty: true })} onRemove={() => form.setValue("heroMediaId", null, { shouldDirty: true })} disabled={!canWrite} />
        <label className="grid gap-1 text-sm font-medium">Closing statement headline<Input {...form.register("closingHeadline")} /></label><SaveButton pending={pending} disabled={!canWrite} label="Save hero content" />
      </SettingsSection>

      <SettingsSection title="Social links" description="Only HTTPS links are accepted. Empty fields hide the corresponding link everywhere.">
        <div className="grid gap-4 sm:grid-cols-2"><label className="grid gap-1 text-sm font-medium">Instagram<Input type="url" placeholder="https://…" {...form.register("instagramUrl")} />{error(form.formState.errors.instagramUrl)}</label><label className="grid gap-1 text-sm font-medium">Facebook<Input type="url" placeholder="https://…" {...form.register("facebookUrl")} />{error(form.formState.errors.facebookUrl)}</label><label className="grid gap-1 text-sm font-medium">YouTube<Input type="url" placeholder="https://…" {...form.register("youtubeUrl")} />{error(form.formState.errors.youtubeUrl)}</label></div><SaveButton pending={pending} disabled={!canWrite} label="Save social links" />
      </SettingsSection>
    </form>

    <PasswordSection canWrite={canWrite} />
    <section className="grid gap-3 rounded-2xl border border-border/70 bg-card p-5 sm:p-7"><h2 className="font-heading text-2xl text-forest-900">Policies and security</h2><p className="text-sm text-muted-foreground">Review the public policies or manage staff access, sessions, and audit history.</p><div className="flex flex-wrap gap-3"><Button asChild variant="outline"><Link href="/admin/settings/policies">Open policies</Link></Button><Button asChild variant="outline"><Link href="/admin/security">Open security</Link></Button></div></section>
    {message ? <p role="status" className="text-sm text-muted-foreground">{message}</p> : null}
  </div>;
}

function PasswordSection({ canWrite }: { canWrite: boolean }) {
  const [message, setMessage] = useState(""); const [pending, startTransition] = useTransition();
  const [values, setValues] = useState<PasswordInput>({ currentPassword: "", newPassword: "", confirmPassword: "" });
  function update(key: keyof PasswordInput, value: string) { setValues((current) => ({ ...current, [key]: value })); }
  return <section className="grid gap-4 rounded-2xl border border-border/70 bg-card p-5 sm:p-7"><div><h2 className="font-heading text-2xl text-forest-900">Change password</h2><p className="mt-1 text-sm text-muted-foreground">Use at least 10 characters. Other sessions are revoked after a successful change; secrets are never audited or logged.</p></div><form className="grid gap-4 sm:grid-cols-2" onSubmit={(event) => { event.preventDefault(); startTransition(async () => { const result = await changeStaffPasswordAction(values); setMessage(result.ok ? "Password changed and other sessions revoked." : result.error.message); if (result.ok) setValues({ currentPassword: "", newPassword: "", confirmPassword: "" }); }); }}><label className="grid gap-1 text-sm font-medium">Current password<Input type="password" autoComplete="current-password" value={values.currentPassword} onChange={(event) => update("currentPassword", event.target.value)} required /></label><label className="grid gap-1 text-sm font-medium">New password<Input type="password" autoComplete="new-password" value={values.newPassword} onChange={(event) => update("newPassword", event.target.value)} minLength={10} required /></label><label className="grid gap-1 text-sm font-medium">Confirm new password<Input type="password" autoComplete="new-password" value={values.confirmPassword} onChange={(event) => update("confirmPassword", event.target.value)} minLength={10} required /></label><div className="flex items-end"><Button disabled={!canWrite || pending}>{pending ? "Changing password…" : "Change password"}</Button></div></form>{message ? <p role="status" className="text-sm text-muted-foreground">{message}</p> : null}</section>;
}

function SettingsSection({ title, description, children }: { title: string; description: string; children: React.ReactNode }) { return <section className="grid gap-5 rounded-2xl border border-border/70 bg-card p-5 sm:p-7"><div className="border-b border-border/70 pb-4"><h2 className="font-heading text-2xl text-forest-900">{title}</h2><p className="mt-1 text-sm text-muted-foreground">{description}</p></div>{children}</section>; }
function SaveButton({ pending, disabled, label }: { pending: boolean; disabled: boolean; label: string }) { return <Button type="submit" disabled={disabled || pending} className="w-fit">{pending ? "Saving…" : label}</Button>; }
function error(value: { message?: string } | { root?: { message?: string } } | undefined) { const message = value && "message" in value ? value.message : value && "root" in value ? value.root?.message : undefined; return message ? <span className="text-xs text-destructive">{message}</span> : null; }
function LocalizedField({ title, path, form, required = false, multiline = false }: { title: string; path: "businessName" | "address" | "whatsappDefaultMessage"; form: ReturnType<typeof useForm<SettingsInput, unknown, z.output<typeof settingsFormSchema>>>; required?: boolean; multiline?: boolean }) { return <fieldset className="grid gap-3"><legend className="text-sm font-semibold">{title}</legend>{SUPPORTED_LOCALES.map((locale) => { const name = `${path}.${locale}` as const; return <label key={locale} className="grid gap-1 text-xs font-medium uppercase">{locale}{required && locale === "en" ? " · required" : ""}{multiline ? <Textarea {...form.register(name)} required={required && locale === "en"} /> : <Input {...form.register(name)} required={required && locale === "en"} />}</label>; })}</fieldset>; }
