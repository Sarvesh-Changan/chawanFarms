import {
  Award,
  CheckCircle,
  Film,
  Gift,
  ShieldCheck,
  Sparkles,
  Ticket,
} from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { Footer } from "@/components/marketing/Footer";
import { Header } from "@/components/marketing/Header";
import { StickyCtaBar } from "@/components/marketing/StickyCtaBar";
import { JsonLd } from "@/components/seo/JsonLd";
import { getPublicActiveRewardRule } from "@/server/services/public-content";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Rewards Program: How It Works · Chawan Farms",
  description:
    "Share authentic farm videos, receive admin approval, earn reward points, and redeem coupons for your next stay at Chawan Farms.",
};

export default async function RewardsPage() {
  const activeRule = await getPublicActiveRewardRule();

  const hasActiveRule = Boolean(activeRule && activeRule.isActive);
  const pointsPerVideo = hasActiveRule ? activeRule?.pointsPerApprovedVideo : null;
  const minPointsToRedeem = hasActiveRule ? activeRule?.minPointsToRedeem : null;
  const couponValidityDays = hasActiveRule ? activeRule?.couponValidityDays : null;
  const activeTiers = hasActiveRule ? activeRule?.tiers ?? [] : [];

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "HowTo",
    name: "How the Chawan Farms Video Reward System Works",
    description:
      "Share video of your stay at Chawan Farms, get admin approval, earn reward points, and redeem discount coupons.",
    step: [
      {
        "@type": "HowToStep",
        name: "Share Video",
        text: "Submit a genuine video of your farm stay through your customer account.",
      },
      {
        "@type": "HowToStep",
        name: "Admin Review & Approval",
        text: "The farm management team verifies your video for authenticity and guest guidelines.",
      },
      {
        "@type": "HowToStep",
        name: "Earn Points",
        text: "Points are credited to your immutable customer points ledger upon approval.",
      },
      {
        "@type": "HowToStep",
        name: "Redeem Coupon",
        text: "Convert your reward points into a discount coupon code for your next booking.",
      },
    ],
  };

  return (
    <>
      <JsonLd data={jsonLd} />
      <Header />
      <main className="min-h-screen bg-cream-50/60 pb-20 pt-8 sm:pt-12">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          {/* Hero / Intro */}
          <div className="mb-14 text-center sm:mb-20">
            <span className="text-xs font-semibold uppercase tracking-[0.2em] text-laterite-600">
              Customer Loyalty &amp; Video Rewards
            </span>
            <h1 className="mt-3 font-heading text-4xl text-forest-900 sm:text-5xl md:text-6xl">
              Share Your Farm Story, Earn Rewards
            </h1>
            <p className="mx-auto mt-4 max-w-2xl text-base text-muted-foreground sm:text-lg">
              Capture your real memories at Chawan Farms. Every authentic video you
              share can earn reward points that turn into discount coupons for your
              next rural getaway.
            </p>
          </div>

          {/* 4-Step Process Section */}
          <section className="mb-20">
            <h2 className="mb-10 text-center font-heading text-3xl text-forest-900">
              How the Loop Works
            </h2>

            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {/* Step 1: Share Video */}
              <div className="relative flex flex-col rounded-2xl border border-border/80 bg-card p-6 shadow-sm">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-forest-900/10 text-forest-900">
                  <Film className="h-6 w-6" />
                </div>
                <span className="mt-4 text-xs font-bold uppercase tracking-wider text-laterite-600">
                  Step 1
                </span>
                <h3 className="mt-1 font-heading text-xl text-forest-900">
                  Share Your Video
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  Record real moments during your stay — farm strolls, river dips,
                  open meals, or campfires — and upload via your account dashboard.
                </p>
              </div>

              {/* Step 2: Admin Approves */}
              <div className="relative flex flex-col rounded-2xl border border-border/80 bg-card p-6 shadow-sm">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-forest-900/10 text-forest-900">
                  <ShieldCheck className="h-6 w-6" />
                </div>
                <span className="mt-4 text-xs font-bold uppercase tracking-wider text-laterite-600">
                  Step 2
                </span>
                <h3 className="mt-1 font-heading text-xl text-forest-900">
                  Admin Reviews
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  Our farm team inspects every submission to ensure original
                  content, respectful community guidelines, and genuine guest
                  experiences.
                </p>
              </div>

              {/* Step 3: Earn Points */}
              <div className="relative flex flex-col rounded-2xl border border-border/80 bg-card p-6 shadow-sm">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-forest-900/10 text-forest-900">
                  <Award className="h-6 w-6" />
                </div>
                <span className="mt-4 text-xs font-bold uppercase tracking-wider text-laterite-600">
                  Step 3
                </span>
                <h3 className="mt-1 font-heading text-xl text-forest-900">
                  Earn Reward Points
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  {pointsPerVideo !== null && pointsPerVideo !== undefined ? (
                    <>
                      Earn{" "}
                      <strong className="text-forest-900">
                        {pointsPerVideo} reward points
                      </strong>{" "}
                      credited directly to your ledger upon approval.
                    </>
                  ) : (
                    "Earn points credited directly to your points ledger as soon as your video is verified and approved."
                  )}
                </p>
              </div>

              {/* Step 4: Redeem Coupon */}
              <div className="relative flex flex-col rounded-2xl border border-border/80 bg-card p-6 shadow-sm">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-forest-900/10 text-forest-900">
                  <Ticket className="h-6 w-6" />
                </div>
                <span className="mt-4 text-xs font-bold uppercase tracking-wider text-laterite-600">
                  Step 4
                </span>
                <h3 className="mt-1 font-heading text-xl text-forest-900">
                  Redeem Coupons
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  {minPointsToRedeem !== null && minPointsToRedeem !== undefined ? (
                    <>
                      Convert your points (minimum{" "}
                      <strong className="text-forest-900">
                        {minPointsToRedeem} points
                      </strong>
                      ) into discount coupon codes
                      {couponValidityDays
                        ? ` valid for ${couponValidityDays} days`
                        : ""}{" "}
                      for your next booking.
                    </>
                  ) : (
                    "Convert your accumulated points into discount coupons to apply toward future accommodation and stay bookings."
                  )}
                </p>
              </div>
            </div>
          </section>

          {/* Reward Tiers Section (Only shown if read from active RewardRule) */}
          {hasActiveRule && activeTiers.length > 0 ? (
            <section className="mb-20 rounded-3xl border border-forest-900/10 bg-card p-8 shadow-sm sm:p-12">
              <div className="text-center">
                <span className="text-xs font-semibold uppercase tracking-wider text-laterite-600">
                  Available Tiers
                </span>
                <h2 className="mt-1 font-heading text-3xl text-forest-900">
                  Redemption Tiers
                </h2>
                <p className="mx-auto mt-2 max-w-xl text-sm text-muted-foreground">
                  Current active discount coupon options available for point
                  redemption:
                </p>
              </div>

              <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {activeTiers.map((tier) => {
                  const discountLabel =
                    tier.discountType === "PERCENTAGE"
                      ? `${tier.discountValue}% OFF`
                      : `₹${Math.round(tier.discountValue / 100)} OFF`;

                  return (
                    <div
                      key={tier.id}
                      className="flex flex-col justify-between rounded-2xl border border-border/80 bg-background p-6 shadow-sm"
                    >
                      <div>
                        <div className="flex items-center justify-between">
                          <h3 className="font-heading text-xl text-forest-900">
                            {tier.name}
                          </h3>
                          <span className="rounded-full bg-turmeric-500/15 px-3 py-1 text-xs font-bold text-turmeric-700">
                            {discountLabel}
                          </span>
                        </div>
                        <p className="mt-4 text-sm font-semibold text-forest-700">
                          {tier.pointsCost} Points Required
                        </p>
                        {tier.minBookingPaise ? (
                          <p className="mt-1 text-xs text-muted-foreground">
                            Minimum booking value: ₹
                            {Math.round(tier.minBookingPaise / 100)}
                          </p>
                        ) : null}
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          ) : (
            <section className="mb-20 rounded-3xl border border-border/70 bg-card p-8 text-center shadow-sm sm:p-10">
              <Gift className="mx-auto h-10 w-10 text-forest-700" />
              <h2 className="mt-3 font-heading text-2xl text-forest-900">
                Redemption Tiers &amp; Coupons
              </h2>
              <p className="mx-auto mt-2 max-w-xl text-sm leading-relaxed text-muted-foreground">
                Coupon values and points thresholds are configured in the system.
                Log in to your customer account to check available redemption
                options once your submission is reviewed.
              </p>
            </section>
          )}

          {/* Guidelines & Terms Box */}
          <section className="mb-20 rounded-2xl border border-forest-900/15 bg-gradient-to-br from-forest-900/5 to-clay-100/40 p-8 sm:p-10">
            <h2 className="font-heading text-2xl text-forest-900">
              Submission Guidelines &amp; Community Rules
            </h2>
            <ul className="mt-4 grid gap-3 text-sm text-foreground/90 sm:grid-cols-2">
              <li className="flex items-start gap-2.5">
                <CheckCircle className="mt-0.5 h-4 w-4 shrink-0 text-leaf-500" />
                <span>
                  <strong>Original Farm Content:</strong> Videos must be recorded
                  on-site at Chawan Farms during your visit.
                </span>
              </li>
              <li className="flex items-start gap-2.5">
                <CheckCircle className="mt-0.5 h-4 w-4 shrink-0 text-leaf-500" />
                <span>
                  <strong>Guest Consent:</strong> You must have permission from all
                  persons (especially minors) featured in the video.
                </span>
              </li>
              <li className="flex items-start gap-2.5">
                <CheckCircle className="mt-0.5 h-4 w-4 shrink-0 text-leaf-500" />
                <span>
                  <strong>Admin Verification:</strong> Uploading alone does not award
                  points; every video must be approved by the admin.
                </span>
              </li>
              <li className="flex items-start gap-2.5">
                <CheckCircle className="mt-0.5 h-4 w-4 shrink-0 text-leaf-500" />
                <span>
                  <strong>Fair Use &amp; Duplication:</strong> Duplicate submissions
                  are prevented; only one reward is issued per unique video.
                </span>
              </li>
            </ul>
          </section>

          {/* Action CTAs */}
          <div className="rounded-3xl bg-forest-900 px-6 py-12 text-center text-cream-50 sm:px-12 sm:py-16">
            <Sparkles className="mx-auto h-10 w-10 text-turmeric-500" />
            <h2 className="mt-4 font-heading text-3xl sm:text-4xl">
              Ready to submit your farm video?
            </h2>
            <p className="mx-auto mt-3 max-w-xl text-base text-cream-50/80">
              Sign in to your account to upload your video and check your points
              balance and active coupons.
            </p>
            <div className="mt-8 flex flex-wrap justify-center gap-4">
              <Link
                href="/login?redirect=/account/videos/new"
                className="rounded-full bg-turmeric-500 px-8 py-3 text-sm font-semibold text-ink-900 transition hover:bg-turmeric-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-turmeric-500"
              >
                Log In to Upload Video
              </Link>
              <Link
                href="/signup"
                className="rounded-full border border-cream-50/30 bg-forest-800 px-8 py-3 text-sm font-semibold text-cream-50 transition hover:bg-forest-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cream-50"
              >
                Create an Account
              </Link>
            </div>
          </div>
        </div>
      </main>
      <StickyCtaBar />
      <Footer />
    </>
  );
}
