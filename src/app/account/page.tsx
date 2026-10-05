import { requireUser } from "@/server/auth";

export default async function AccountPage() {
  const session = await requireUser();
  return (
    <main className="bg-cream-50 min-h-screen px-6 py-12">
      <div className="mx-auto max-w-4xl">
        <p className="text-laterite-600 text-xs font-semibold tracking-[0.18em] uppercase">Account</p>
        <h1 className="font-heading text-forest-900 mt-2 text-4xl">Welcome, {session.user.name}</h1>
        <p className="text-muted-foreground mt-3">{session.user.email}</p>
      </div>
    </main>
  );
}
