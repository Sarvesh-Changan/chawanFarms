import Link from "next/link";

import { NoAccess } from "@/components/admin/NoAccess";
import { PageHeader } from "@/components/admin/PageHeader";
import { StoriesManager, type StoryAdminRow } from "@/components/admin/stories/StoriesManager";
import { Button } from "@/components/ui/button";
import { getCmsPageStaff } from "@/server/services/cms/page-access";
import { listStoriesAdmin } from "@/server/services/cms/stories";

function text(value: unknown): string { return value && typeof value === "object" && !Array.isArray(value) && typeof (value as Record<string, unknown>).en === "string" ? (value as Record<string, string>).en ?? "" : ""; }

export default async function StoriesPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const staff = await getCmsPageStaff("cms.read");
  if (!staff) return <NoAccess />;
  const raw = await searchParams;
  const trash = raw.trash === "1" || (Array.isArray(raw.trash) && raw.trash.includes("1"));
  const result = await listStoriesAdmin({ q: "", status: "ALL", kind: "ALL", trash });
  const rows: StoryAdminRow[] = result.rows.map((row) => ({ id: row.id, slug: row.slug, title: text(row.title) || row.slug, kind: row.kind, status: row.status, sortOrder: row.sortOrder, updatedAt: row.updatedAt.toLocaleDateString("en-IN"), deletedAt: row.deletedAt?.toISOString() ?? null, publishAt: row.publishAt?.toISOString() ?? null, sourceConsent: row.sourceSubmission ? row.sourceSubmission.consentPublish : null }));
  return <section className="space-y-6"><PageHeader title={trash ? "Stories trash" : "Stories"} description="Experiences, editorial stories and consented guest stories share one publishing workflow." actions={<><Button asChild><Link href="/admin/stories/new">Create story</Link></Button><Button asChild variant="outline"><Link href={trash ? "/admin/stories" : "/admin/stories?trash=1"}>{trash ? "Active stories" : "Trash"}</Link></Button></>}/><StoriesManager rows={rows} trash={trash}/></section>;
}
