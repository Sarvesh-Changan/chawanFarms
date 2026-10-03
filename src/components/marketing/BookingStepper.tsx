"use client";

import { ArrowLeft, ArrowRight, Check } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { z } from "zod";

const bookingDetailsSchema = z.object({ name: z.string().trim().min(2, "Enter your name."), phone: z.string().trim().regex(/^\+?\d[\d\s-]{8,14}$/, "Enter a valid phone number."), email: z.string().trim().email("Enter a valid email.").or(z.literal("")) }).strict();
type BookingDetails = z.infer<typeof bookingDetailsSchema>;

const steps = ["Dates", "Guests", "Stay & food", "Your details", "Review"] as const;

export function BookingStepper() {
  const [step, setStep] = useState(0);
  const [details, setDetails] = useState<BookingDetails>({ name: "", phone: "", email: "" });
  const [error, setError] = useState("");

  const next = () => {
    if (step === 3) {
      const parsed = bookingDetailsSchema.safeParse(details);
      if (!parsed.success) { setError(parsed.error.issues[0]?.message ?? "Check your details."); return; }
    }
    setError("");
    setStep((current) => Math.min(current + 1, steps.length - 1));
  };

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_0.36fr]">
      <div className="bg-cream-50 border-forest-900/10 rounded-2xl border p-4 shadow-sm sm:p-8">
        <ol className="grid grid-cols-5 gap-1" aria-label="Booking progress">{steps.map((label, index) => <li className="flex flex-col items-center gap-2 text-center" key={label}><span className={`grid size-9 place-items-center rounded-full text-sm font-bold ${index < step ? "bg-leaf-500 text-cream-50" : index === step ? "bg-forest-700 text-cream-50" : "bg-clay-100 text-mist-500"}`}>{index < step ? <Check aria-hidden="true" className="size-4" /> : index + 1}</span><span className={`hidden text-xs sm:block ${index === step ? "text-forest-900 font-semibold" : "text-mist-500"}`}>{label}</span></li>)}</ol>
        <div className="mt-10 min-h-72">
          {step === 0 ? <div><p className="text-laterite-600 text-xs font-semibold tracking-[0.18em] uppercase">Step 1</p><h2 className="font-heading text-forest-900 mt-2 text-3xl">When would you like to come?</h2><div className="mt-6 grid gap-4 sm:grid-cols-2"><label className="grid gap-2 text-sm font-semibold">Arrival<input type="date" className="border-forest-900/20 bg-cream-50 min-h-12 rounded-lg border px-3 focus-visible:outline-2 focus-visible:outline-turmeric-500" /></label><label className="grid gap-2 text-sm font-semibold">Departure<input type="date" className="border-forest-900/20 bg-cream-50 min-h-12 rounded-lg border px-3 focus-visible:outline-2 focus-visible:outline-turmeric-500" /></label></div></div> : null}
          {step === 1 ? <div><p className="text-laterite-600 text-xs font-semibold tracking-[0.18em] uppercase">Step 2</p><h2 className="font-heading text-forest-900 mt-2 text-3xl">Who is coming?</h2><div className="mt-6 grid gap-4 sm:grid-cols-3">{["Adults", "Children 4–10", "Under 4"].map((label) => <label className="grid gap-2 text-sm font-semibold" key={label}>{label}<input type="number" min="0" inputMode="numeric" defaultValue="0" className="border-forest-900/20 bg-cream-50 min-h-12 rounded-lg border px-3 focus-visible:outline-2 focus-visible:outline-turmeric-500" /></label>)}</div><p className="text-mist-500 mt-4 text-xs">Children 4–10 are charged at 60%; under 4 years are free, as stated in Appendix A.</p></div> : null}
          {step === 2 ? <div><p className="text-laterite-600 text-xs font-semibold tracking-[0.18em] uppercase">Step 3</p><h2 className="font-heading text-forest-900 mt-2 text-3xl">Shape your stay</h2><div className="mt-6 grid gap-4 sm:grid-cols-2"><label className="grid gap-2 text-sm font-semibold">Stay type<select className="border-forest-900/20 bg-cream-50 min-h-12 rounded-lg border px-3 focus-visible:outline-2 focus-visible:outline-turmeric-500"><option>Camping tents / Dormitory</option><option>Guest House</option><option>Camp Organiser</option><option>One-day picnic</option></select></label><label className="grid gap-2 text-sm font-semibold">Food preference<select className="border-forest-900/20 bg-cream-50 min-h-12 rounded-lg border px-3 focus-visible:outline-2 focus-visible:outline-turmeric-500"><option>Veg</option><option>Non-veg</option></select></label></div><p className="text-mist-500 mt-4 text-xs">Activities are arranged according to prevailing conditions and availability.</p></div> : null}
          {step === 3 ? <div><p className="text-laterite-600 text-xs font-semibold tracking-[0.18em] uppercase">Step 4</p><h2 className="font-heading text-forest-900 mt-2 text-3xl">How can the team reach you?</h2><div className="mt-6 grid gap-4"><label className="grid gap-2 text-sm font-semibold">Full name<input value={details.name} onChange={(event) => setDetails((current) => ({ ...current, name: event.target.value }))} autoComplete="name" className="border-forest-900/20 bg-cream-50 min-h-12 rounded-lg border px-3 focus-visible:outline-2 focus-visible:outline-turmeric-500" /></label><label className="grid gap-2 text-sm font-semibold">Phone<input value={details.phone} onChange={(event) => setDetails((current) => ({ ...current, phone: event.target.value }))} autoComplete="tel" inputMode="tel" className="border-forest-900/20 bg-cream-50 min-h-12 rounded-lg border px-3 focus-visible:outline-2 focus-visible:outline-turmeric-500" /></label><label className="grid gap-2 text-sm font-semibold">Email <span className="text-mist-500 font-normal">(optional)</span><input value={details.email} onChange={(event) => setDetails((current) => ({ ...current, email: event.target.value }))} autoComplete="email" type="email" className="border-forest-900/20 bg-cream-50 min-h-12 rounded-lg border px-3 focus-visible:outline-2 focus-visible:outline-turmeric-500" /></label></div>{error ? <p role="alert" className="text-laterite-600 mt-3 text-sm">{error}</p> : null}</div> : null}
          {step === 4 ? <div><p className="text-laterite-600 text-xs font-semibold tracking-[0.18em] uppercase">Step 5</p><h2 className="font-heading text-forest-900 mt-2 text-3xl">Review your enquiry</h2><div className="bg-clay-100 mt-6 rounded-xl p-4 text-sm leading-6"><p><strong>Dates:</strong> Your selected dates will appear here.</p><p><strong>Guests:</strong> Your guest counts will appear here.</p><p><strong>Price:</strong> Final price confirmed by the team.</p></div><label className="mt-5 flex gap-3 text-sm leading-6"><input type="checkbox" className="mt-1 size-4 accent-forest-700" />I understand that this is an enquiry and that the team will confirm availability, price and policies.</label></div> : null}
        </div>
        <div className="border-forest-900/10 mt-8 flex justify-between gap-3 border-t pt-5"><button type="button" disabled={step === 0} onClick={() => { setError(""); setStep((current) => Math.max(current - 1, 0)); }} className="text-forest-700 inline-flex min-h-11 items-center gap-2 rounded-lg px-3 font-semibold disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-turmeric-500"><ArrowLeft aria-hidden="true" className="size-4" />Back</button>{step < steps.length - 1 ? <button type="button" onClick={next} className="bg-forest-700 text-cream-50 inline-flex min-h-12 items-center gap-2 rounded-lg px-5 text-sm font-semibold hover:bg-forest-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-turmeric-500">Continue <ArrowRight aria-hidden="true" className="size-4" /></button> : <Link href="/" className="bg-turmeric-500 text-ink-900 inline-flex min-h-12 items-center rounded-lg px-5 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-turmeric-500">Save prototype enquiry</Link>}</div>
      </div>
      <aside className="bg-forest-900 text-cream-50 h-fit rounded-2xl p-5 sm:p-6"><p className="text-turmeric-500 text-xs font-semibold tracking-[0.18em] uppercase">Estimate panel</p><h2 className="font-heading mt-3 text-2xl">Final price confirmed by team</h2><p className="text-cream-50/70 mt-3 text-sm leading-6">This shell never trusts a client-side price. The live booking flow will calculate the estimate on the server.</p><div className="border-cream-50/15 mt-6 border-t pt-4 text-sm"><p>Availability: <span className="text-paddy-300">To be confirmed</span></p><p className="mt-2">Policies: <span className="text-paddy-300">Review before submit</span></p></div></aside>
    </div>
  );
}
