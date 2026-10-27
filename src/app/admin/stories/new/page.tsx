import { NoAccess } from "@/components/admin/NoAccess";
import { PageHeader } from "@/components/admin/PageHeader";
import { StoryEditor } from "@/components/admin/stories/StoryEditor";
import { env } from "@/config/env";
import { getCmsPageStaff } from "@/server/services/cms/page-access";

export default async function NewStoryPage() {
  const staff = await getCmsPageStaff("cms.write");
  if (!staff) return <NoAccess />;
  return <section className="space-y-6"><PageHeader title="Create story" description="New Stories start as drafts. Use approved, locally uploaded media."/><StoryEditor initial={null} cloudName={env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME ?? ""}/></section>;
}
