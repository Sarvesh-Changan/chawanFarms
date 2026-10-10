import { Clock, ExternalLink, MapPin, MessageSquare, Phone } from "lucide-react";
import type { Metadata } from "next";

import {
  CampOrganiserQuoteForm,
  ContactForm,
  SchoolGroupForm,
} from "@/components/forms/LeadCaptureForms";
import { Footer } from "@/components/marketing/Footer";
import { Header } from "@/components/marketing/Header";
import { StickyCtaBar } from "@/components/marketing/StickyCtaBar";
import { JsonLd } from "@/components/seo/JsonLd";
import { getPublicSettings } from "@/server/services/public-content";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Contact Us & Farm Location · Chawan Farms",
  description:
    "Get in touch with the Chawan Farms team for stay enquiries, camp organizer bookings, and school trips in Baitwadi, Kolad.",
};

export default async function ContactPage() {
  const settings = await getPublicSettings();

  const phones = settings.phones.length
    ? settings.phones
    : ["9821502956", "9821089375", "9359895322"];
  const address =
    settings.address ||
    "Baitwadi, Kolad, Tal. Roha, Dist. Raigad, Maharashtra, India";
  const whatsappNumber = settings.whatsappNumber || "9821502956";
  const whatsappMessage =
    settings.whatsappMessage || "Hello Chawan Farms, I would like to enquire about a visit.";

  const googleMapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
    `Chawan Farms, ${address}`,
  )}`;

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "ContactPage",
    name: "Contact Chawan Farms",
    description: "Contact information, phone numbers, address, and map for Chawan Farms.",
    mainEntity: {
      "@type": "TouristAttraction",
      name: "Chawan Farms",
      address: {
        "@type": "PostalAddress",
        streetAddress: "Baitwadi",
        addressLocality: "Kolad, Roha",
        addressRegion: "Raigad, Maharashtra",
        addressCountry: "IN",
      },
      telephone: phones[0],
    },
  };

  return (
    <>
      <JsonLd data={jsonLd} />
      <Header />
      <main className="min-h-screen bg-cream-50/60 pb-20 pt-8 sm:pt-12">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          {/* Header */}
          <div className="mb-12 text-center sm:mb-16">
            <span className="text-xs font-semibold uppercase tracking-[0.2em] text-laterite-600">
              Get in Touch
            </span>
            <h1 className="mt-3 font-heading text-4xl text-forest-900 sm:text-5xl md:text-6xl">
              Plan Your Visit With Us
            </h1>
            <p className="mx-auto mt-4 max-w-2xl text-base text-muted-foreground sm:text-lg">
              Reach out for weekend family stays, school educational visits, or
              group camp reservations. Our farm team personally handles all
              inquiries.
            </p>
          </div>

          <div className="grid gap-12 lg:grid-cols-12">
            {/* Contact Info & Map Column (Settings-driven) */}
            <div className="space-y-8 lg:col-span-5">
              {/* Contact Details Card */}
              <div className="rounded-2xl border border-border/80 bg-card p-6 shadow-sm sm:p-8">
                <h2 className="font-heading text-2xl text-forest-900">
                  Farm Contacts
                </h2>

                <div className="mt-6 space-y-6">
                  {/* Phone Numbers from Settings */}
                  <div className="flex items-start gap-4">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-forest-900/10 text-forest-900">
                      <Phone className="h-5 w-5" />
                    </div>
                    <div>
                      <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        Phone Numbers
                      </h3>
                      <div className="mt-1 flex flex-col gap-1 text-sm font-medium text-foreground">
                        {phones.map((phone) => (
                          <a
                            key={phone}
                            href={`tel:${phone}`}
                            className="transition hover:text-forest-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest-700"
                          >
                            +91 {phone}
                          </a>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* WhatsApp */}
                  {whatsappNumber && (
                    <div className="flex items-start gap-4">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-leaf-500/10 text-leaf-500">
                        <MessageSquare className="h-5 w-5" />
                      </div>
                      <div>
                        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                          WhatsApp Chat
                        </h3>
                        <a
                          href={`https://wa.me/${whatsappNumber.replace(
                            /\D/g,
                            "",
                          )}?text=${encodeURIComponent(whatsappMessage)}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="mt-1 inline-flex items-center gap-1.5 text-sm font-medium text-foreground transition hover:text-leaf-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest-700"
                        >
                          Chat on WhatsApp <ExternalLink className="h-3.5 w-3.5" />
                        </a>
                      </div>
                    </div>
                  )}

                  {/* Address from Settings */}
                  <div className="flex items-start gap-4">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-forest-900/10 text-forest-900">
                      <MapPin className="h-5 w-5" />
                    </div>
                    <div>
                      <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        Farm Address
                      </h3>
                      <p className="mt-1 text-sm leading-relaxed text-foreground">
                        {address}
                      </p>
                      <a
                        href={googleMapsUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-2 inline-flex items-center gap-1.5 text-xs font-semibold text-laterite-600 transition hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest-700"
                      >
                        Open in Google Maps <ExternalLink className="h-3 w-3" />
                      </a>
                    </div>
                  </div>

                  {/* Timings from PDF */}
                  <div className="flex items-start gap-4">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-forest-900/10 text-forest-900">
                      <Clock className="h-5 w-5" />
                    </div>
                    <div>
                      <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        Check-in & Schedule
                      </h3>
                      <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                        Standard stay: 24 hours (10:00 AM check-in to 10:00 AM next day).
                        Camp Organisers: 5:00 PM to 11:00 AM. Exact timing is confirmed upon booking.
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Map Embed Card */}
              <div className="overflow-hidden rounded-2xl border border-border/80 bg-card p-6 shadow-sm">
                <div className="flex items-center justify-between">
                  <h3 className="font-heading text-lg text-forest-900">
                    Location &amp; Directions
                  </h3>
                  <a
                    href={googleMapsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs font-semibold text-forest-700 hover:underline"
                  >
                    View Map <ExternalLink className="h-3 w-3" />
                  </a>
                </div>

                {/* Stylized Map View */}
                <div className="mt-4 flex h-48 w-full flex-col items-center justify-center rounded-xl border border-border/80 bg-gradient-to-br from-forest-900/5 via-clay-100/40 to-laterite-600/10 p-6 text-center">
                  <MapPin className="h-8 w-8 text-laterite-600" />
                  <p className="mt-2 font-heading text-base text-forest-900">
                    Baitwadi, Kolad
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Taluka Roha, Dist. Raigad, Maharashtra
                  </p>
                  <a
                    href={googleMapsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-3 rounded-full bg-forest-900 px-4 py-1.5 text-xs font-semibold text-cream-50 transition hover:bg-forest-700"
                  >
                    Get Driving Directions
                  </a>
                </div>
              </div>
            </div>

            {/* Forms Column */}
            <div className="space-y-8 lg:col-span-7">
              {/* General Enquiry Form */}
              <div className="rounded-2xl border border-border/80 bg-card p-6 shadow-sm sm:p-8">
                <div className="mb-6">
                  <span className="text-xs font-semibold uppercase tracking-wider text-laterite-600">
                    General Inquiries
                  </span>
                  <h2 className="mt-1 font-heading text-2xl text-forest-900 sm:text-3xl">
                    Send Us a Message
                  </h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Tell us your preferred dates, group size, and questions. We will
                    respond promptly.
                  </p>
                </div>
                <ContactForm />
              </div>

              {/* Specialized Form Accordions/Sections */}
              <div className="space-y-6">
                <details className="group rounded-2xl border border-border/80 bg-card p-6 shadow-sm">
                  <summary className="flex cursor-pointer items-center justify-between font-heading text-xl text-forest-900 hover:text-forest-700">
                    <span>Organising a Camping Group? (Camp Organiser Quote)</span>
                    <span className="text-xs font-semibold text-laterite-600 group-open:rotate-180">
                      ▼
                    </span>
                  </summary>
                  <div className="mt-6 border-t border-border/60 pt-6">
                    <p className="mb-4 text-xs text-muted-foreground">
                      For organisers bringing 30–50 persons with own tents on our lawn
                      area with dining &amp; washroom facilities.
                    </p>
                    <CampOrganiserQuoteForm />
                  </div>
                </details>

                <details className="group rounded-2xl border border-border/80 bg-card p-6 shadow-sm">
                  <summary className="flex cursor-pointer items-center justify-between font-heading text-xl text-forest-900 hover:text-forest-700">
                    <span>School or Educational Agricultural Trip?</span>
                    <span className="text-xs font-semibold text-laterite-600 group-open:rotate-180">
                      ▼
                    </span>
                  </summary>
                  <div className="mt-6 border-t border-border/60 pt-6">
                    <p className="mb-4 text-xs text-muted-foreground">
                      Agri-science education and rural life awareness visits for urban
                      school children and youth groups.
                    </p>
                    <SchoolGroupForm />
                  </div>
                </details>
              </div>
            </div>
          </div>
        </div>
      </main>
      <StickyCtaBar />
      <Footer />
    </>
  );
}
