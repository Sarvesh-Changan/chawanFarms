import type { Metadata } from "next";

import { NoAccess } from "@/components/admin/NoAccess";
import { PageHeader } from "@/components/admin/PageHeader";
import { VideoReviewQueue } from "@/components/admin/rewards/VideoReviewQueue";
import { mediaPolicy } from "@/config/media";
import { VIDEO_REVIEW_SLA_HOURS } from "@/config/moderation";
import { getSession } from "@/server/auth";
import { getStaffPrincipal, requirePermission } from "@/server/authz";
import { listVideoReviewQueue } from "@/server/services/videoReview";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Video Review · Chawan Farms Admin" };

export default async function VideoReviewPage() {
  const session = await getSession();
  const staff = session ? await getStaffPrincipal(session.user.id) : null;
  if (!staff) return <NoAccess title="Staff access required" message="The admin workspace is available to invited staff accounts." />;
  try {
    await requirePermission("rewards.videos.review");
  } catch {
    return <NoAccess title="Video review access required" message="Your staff role does not have permission to review customer videos." />;
  }
  const initial = await listVideoReviewQueue({ page: 1, pageSize: 25, status: "PENDING", duplicatesOnly: false });
  if (!initial.ok) return <NoAccess title="Video queue unavailable" message={initial.error.message} />;
  const policy = mediaPolicy("customer_video");
  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Rewards moderation"
        title="Customer video review"
        description={`Oldest submissions first. Review SLA target: ${VIDEO_REVIEW_SLA_HOURS} hours.`}
      />
      <VideoReviewQueue
        initialData={initial.data}
        limits={{ formats: policy.formats, maxBytes: policy.maxBytes, maxDurationSeconds: policy.maxDurationSeconds ?? null }}
      />
    </div>
  );
}
