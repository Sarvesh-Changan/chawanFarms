export default function LeadsLoading() {
  return <div aria-label="Loading lead CRM" className="space-y-6">
    <div className="h-20 rounded-xl border border-border bg-card motion-safe:animate-pulse" />
    <div className="grid gap-3 rounded-xl border border-border bg-card p-4 sm:grid-cols-2 xl:grid-cols-4">{Array.from({ length: 8 }, (_, index) => <div key={index} className="h-11 rounded-lg bg-muted motion-safe:animate-pulse" />)}</div>
    <div className="h-72 rounded-xl border border-border bg-card motion-safe:animate-pulse" />
  </div>;
}
