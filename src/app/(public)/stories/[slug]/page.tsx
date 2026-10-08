import { PublicContentList } from "@/components/cms/PublicContentList";

export default async function StoryPage({ params }: { params: Promise<{ slug: string }> }) { return <PublicContentList type="post" slug={(await params).slug} />; }
