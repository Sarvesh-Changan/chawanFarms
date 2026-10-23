import { NotificationButtons } from "@/components/account/AccountActions";
import { AccountFrame, EmptyState } from "@/components/account/AccountFrame";
import { requireUser } from "@/server/auth";
import { getNotificationsPageData } from "@/server/services/account";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function NotificationsPage() { const session = await requireUser(); const notifications = await getNotificationsPageData(session.user.id); const unread = notifications.filter((item) => !item.readAt); return <AccountFrame title="Notifications" description="Updates connected to your account and submissions."><div className="mb-5 flex justify-end">{unread.length > 0 ? <NotificationButtons /> : null}</div>{notifications.length === 0 ? <EmptyState title="You are all caught up" body="New account updates will appear here." /> : <div className="grid gap-3">{notifications.map((notification) => <article key={notification.id} className={`rounded-2xl border p-5 ${notification.readAt ? "border-border/70 bg-card" : "border-forest-700/30 bg-forest-700/5"}`}><div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="font-semibold text-forest-900">{notification.title}</h2>{notification.body ? <p className="mt-2 text-sm leading-6 text-muted-foreground">{notification.body}</p> : null}</div>{notification.readAt ? <span className="text-xs text-muted-foreground">Read</span> : <NotificationButtons unreadId={notification.id} />}</div><p className="mt-3 text-xs text-muted-foreground">{new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeZone: "Asia/Kolkata" }).format(notification.createdAt)}</p></article>)}</div>}</AccountFrame>; }
