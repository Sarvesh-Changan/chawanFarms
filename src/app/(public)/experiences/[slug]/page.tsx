import { PublicContentList } from "@/components/cms/PublicContentList";

export default async function ExperiencePage({ params }: { params: Promise<{ slug: string }> }) { return <PublicContentList type="experience" slug={(await params).slug} />; }
