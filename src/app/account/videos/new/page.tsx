import Link from "next/link";

import { VideoUploader } from "@/components/rewards/VideoUploader";
import { formatMediaBytes, mediaPolicy } from "@/config/media";
import { requireCustomer } from "@/server/auth";

export const dynamic = "force-dynamic";

export default async function NewVideoPage() {
  await requireCustomer();
  const policy = mediaPolicy("customer_video");

  return (
    <main className="bg-cream-50 min-h-screen px-6 py-12">
      <div className="mx-auto max-w-2xl space-y-6">
        <div>
          <Link href="/account" className="text-xs text-muted-foreground underline-offset-4 hover:underline">← Back to Account</Link>
          <p className="text-laterite-600 mt-5 text-xs font-semibold tracking-[0.18em] uppercase">Guest stories</p>
          <h1 className="font-heading text-forest-900 mt-2 text-4xl">Share your Chawan Farms video</h1>
          <p className="text-muted-foreground mt-3 text-sm leading-6">Your video will stay private while our team reviews it. Reward points, if any, are considered only after approval.</p>
        </div>
        <VideoUploader
          acceptedFormats={policy.formats}
          maxBytes={policy.maxBytes}
          maxDurationSeconds={policy.maxDurationSeconds ?? 0}
          formattedMaxBytes={formatMediaBytes(policy.maxBytes)}
        />
      </div>
    </main>
  );
}
