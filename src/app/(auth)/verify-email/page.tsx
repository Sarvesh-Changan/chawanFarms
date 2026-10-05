import Link from "next/link";

export default async function VerifyEmailPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const error = typeof params.error === "string" ? params.error : undefined;
  return (
    <main className="bg-cream-50 flex min-h-screen items-center justify-center px-4 py-12">
      <section className="bg-clay-100/70 w-full max-w-md rounded-xl p-8 text-center shadow-xl">
        <p className="text-laterite-600 text-xs font-semibold tracking-[0.18em] uppercase">Chawan Farms</p>
        <h1 className="font-heading text-forest-900 mt-3 text-3xl">{error ? "Verification link unavailable" : "Check your email"}</h1>
        <p className="text-muted-foreground mt-4 text-sm">{error ? "This verification link is invalid or expired. Request a new one from your account sign-in." : "Use the link in your email to verify your address. Verification is required before you can use bookings or rewards."}</p>
        <Link className="text-forest-700 mt-6 inline-block text-sm font-semibold underline underline-offset-4" href="/login">Return to sign in</Link>
      </section>
    </main>
  );
}
