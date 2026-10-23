import type { ReactNode } from "react";

export function AccountFrame({ title, description, children }: { title: string; description?: string; children: ReactNode }) {
  return (
    <main className="min-w-0 flex-1 bg-cream-50 px-4 py-6 pb-24 sm:px-8 sm:py-10 lg:px-10 lg:pb-10">
      <div className="mx-auto max-w-6xl">
        <header className="mb-7">
          <p className="text-xs font-semibold tracking-[0.18em] text-laterite-600 uppercase">Chawan Farms</p>
          <h1 className="font-heading mt-2 text-3xl text-forest-900 sm:text-4xl">{title}</h1>
          {description ? <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">{description}</p> : null}
        </header>
        {children}
      </div>
    </main>
  );
}

export function EmptyState({ title, body, action }: { title: string; body: string; action?: ReactNode }) {
  return <div className="rounded-2xl border border-dashed border-border bg-card p-8 text-center"><h2 className="font-heading text-xl text-forest-900">{title}</h2><p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted-foreground">{body}</p>{action ? <div className="mt-5">{action}</div> : null}</div>;
}

export function ErrorState({ retry }: { retry?: string }) {
  return <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-8 text-center"><h2 className="font-heading text-xl text-forest-900">We couldn’t load this page</h2><p className="mt-2 text-sm text-muted-foreground">Please try again. Your account data has not been changed.</p>{retry ? <a className="mt-5 inline-flex min-h-11 items-center rounded-lg bg-forest-700 px-4 text-sm font-medium text-cream-50" href={retry}>Try again</a> : null}</div>;
}

export function StatusChip({ value }: { value: string }) {
  return <span className="inline-flex rounded-full bg-paddy-300/35 px-2.5 py-1 text-xs font-semibold text-forest-900">{value.replaceAll("_", " ")}</span>;
}
