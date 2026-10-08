import { PublicContentList } from "@/components/cms/PublicContentList";

export default async function ActivityPage({ params }: { params: Promise<{ slug: string }> }) { return <PublicContentList type="activity" slug={(await params).slug} />; }
