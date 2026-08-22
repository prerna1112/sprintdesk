import type { ReactNode } from 'react';

interface RouteShellProps {
  eyebrow: string;
  title: string;
  description: string;
  children?: ReactNode;
}

export function RouteShell({
  eyebrow,
  title,
  description,
  children,
}: RouteShellProps) {
  return (
    <section aria-labelledby="page-title" className="grid gap-6">
      <header>
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-primary">{eyebrow}</p>
        <h1 className="mt-2 text-2xl font-black tracking-tight sm:text-3xl" id="page-title">{title}</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground sm:text-base">{description}</p>
      </header>
      <div className="rounded-2xl border bg-surface p-5 shadow-sm sm:p-6">
        {children ?? (
          <div className="grid min-h-48 place-items-center text-center">
            <div>
              <div aria-hidden="true" className="mx-auto mb-4 grid size-12 place-items-center rounded-2xl bg-muted text-xl">✦</div>
              <h2 className="font-bold">Your workspace is ready</h2>
              <p className="mt-1 text-sm text-muted-foreground">Feature content arrives in the next implementation slice.</p>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
