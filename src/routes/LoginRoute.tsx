import { Link } from 'react-router-dom';

export default function LoginRoute() {
  return (
    <main className="grid min-h-screen place-items-center px-4 py-12">
      <section className="w-full max-w-md rounded-2xl border bg-surface p-6 shadow-xl sm:p-8">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-primary">SprintDesk</p>
        <h1 className="mt-3 text-3xl font-black tracking-tight">Welcome back</h1>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">Authentication will be implemented in its dedicated feature slice.</p>
        <Link className="mt-6 inline-flex h-10 items-center rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground shadow-sm" to="/dashboard">
          Preview dashboard
        </Link>
      </section>
    </main>
  );
}
