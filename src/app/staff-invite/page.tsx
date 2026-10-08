import { z } from "zod";

import { AcceptStaffInviteForm } from "@/components/admin/AdminSecurityControls";
import { getSession } from "@/server/auth";

const querySchema = z.object({ token: z.string().regex(/^[A-Za-z0-9_-]{40,64}$/) }).passthrough();

export default async function StaffInvitePage({ searchParams }: { searchParams: Promise<{ token?: string | string[] }> }) {
  const query = querySchema.safeParse(await searchParams);
  if (!query.success) return <main className="min-h-screen bg-background px-4 py-12"><div className="mx-auto max-w-lg rounded-xl border border-border bg-card p-6"><h1 className="font-heading text-2xl">Invitation unavailable</h1><p className="mt-2 text-sm text-muted-foreground">This invitation link is invalid or has expired.</p></div></main>;
  const session = await getSession();
  return <main className="min-h-screen bg-background px-4 py-12"><AcceptStaffInviteForm token={query.data.token} signedInEmail={session?.user.email} /></main>;
}
