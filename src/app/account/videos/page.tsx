import Link from "next/link";

import { WithdrawVideoButton } from "@/components/account/AccountActions";
import { AccountFrame, EmptyState, StatusChip } from "@/components/account/AccountFrame";
import { Button } from "@/components/ui/button";
import { requireUser } from "@/server/auth";
import { getVideosPageData } from "@/server/services/account";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function VideosPage() { const session = await requireUser(); const videos = await getVideosPageData(session.user.id); return <AccountFrame title="My videos" description="Your submissions remain private while they are reviewed. Only status and rejection feedback are shown here."><div className="mb-5 flex justify-end"><Button asChild><Link href="/account/videos/new">Upload video</Link></Button></div>{videos.length === 0 ? <EmptyState title="No video submissions" body="Share a video from a past visit when you are ready." action={<Button asChild><Link href="/account/videos/new">Upload a video</Link></Button>} /> : <div className="grid gap-4">{videos.map((video) => <article key={video.id} className="rounded-2xl border border-border/70 bg-card p-5"><div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="font-heading text-xl text-forest-900">{video.title || "Untitled video"}</h2><p className="mt-1 text-xs text-muted-foreground">Submitted {video.submittedAt ? new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeZone: "Asia/Kolkata" }).format(video.submittedAt) : "not yet"}</p></div><StatusChip value={video.status} /></div>{video.rejectionReason ? <p className="mt-4 rounded-lg bg-destructive/5 p-3 text-sm text-destructive">Reason: {video.rejectionReason}</p> : null}{video.status === "PENDING" ? <div className="mt-4"><WithdrawVideoButton submissionId={video.id} /></div> : null}</article>)}</div>}</AccountFrame>; }
