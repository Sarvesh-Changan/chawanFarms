import Link from "next/link";

import { RemoveFavouriteButton } from "@/components/account/AccountActions";
import { AccountFrame, EmptyState } from "@/components/account/AccountFrame";
import { requireUser } from "@/server/auth";
import { getFavouritesPageData } from "@/server/services/account";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function FavouritesPage() { const session = await requireUser(); const favourites = await getFavouritesPageData(session.user.id); return <AccountFrame title="Favourites" description="Your saved packages, experiences and activities.">{favourites.length === 0 ? <EmptyState title="Nothing saved yet" body="Use the save button on a package, experience or activity to keep it here." /> : <div className="grid gap-3 sm:grid-cols-2">{favourites.map((item) => <article key={`${item.entityType}-${item.entityId}`} className="flex items-center justify-between gap-3 rounded-2xl border border-border/70 bg-card p-5"><div><p className="text-xs font-semibold tracking-[0.16em] text-laterite-600 uppercase">{item.entityType}</p>{item.slug ? <Link href={`/${item.entityType === "package" ? "packages" : `${item.entityType}s`}/${item.slug}`} className="mt-1 block font-heading text-xl text-forest-900 underline-offset-4 hover:underline">{item.label}</Link> : <p className="mt-1 font-heading text-xl text-forest-900">{item.label}</p>}</div><RemoveFavouriteButton entityType={item.entityType as "package" | "experience" | "activity"} entityId={item.entityId} /></article>)}</div>}</AccountFrame>; }
