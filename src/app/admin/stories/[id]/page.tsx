import { notFound } from "next/navigation";

import { NoAccess } from "@/components/admin/NoAccess";
import { PageHeader } from "@/components/admin/PageHeader";
import { StoryEditor } from "@/components/admin/stories/StoryEditor";
import { env } from "@/config/env";
import { getCmsPageStaff } from "@/server/services/cms/page-access";
import { getStoryAdmin } from "@/server/services/cms/stories";

export default async function EditStoryPage({ params }: { params: Promise<{ id: string }> }) {
  const staff = await getCmsPageStaff("cms.read");
  if (!staff) return <NoAccess />;
  const story = await getStoryAdmin((await params).id);
  if (!story) notFound();
  return <section className="space-y-6"><PageHeader title="Edit story" description="Keep story copy, media, publishing and consent state reviewable."/><StoryEditor initial={story} cloudName={env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME ?? ""}/></section>;
}
