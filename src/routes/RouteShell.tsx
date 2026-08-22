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
    <main className="grid min-h-screen place-items-center px-6 py-12">
      <section className="w-full max-w-2xl rounded-2xl border bg-surface p-8 shadow-sm">
        <p className="text-sm font-semibold uppercase tracking-widest text-primary">
          {eyebrow}
        </p>
        <h1 className="mt-3 text-3xl font-bold tracking-tight">{title}</h1>
        <p className="mt-3 text-muted-foreground">{description}</p>
        {children}
      </section>
    </main>
  );
}
