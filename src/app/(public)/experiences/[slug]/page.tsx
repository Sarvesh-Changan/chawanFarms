import { redirect } from "next/navigation";

import { getPublicStorySlugForExperience } from "@/server/services/public-content";

export default async function LegacyExperienceRedirect({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const story = await getPublicStorySlugForExperience(slug);
  redirect(story ? `/stories/${story.slug}` : "/stories");
}
