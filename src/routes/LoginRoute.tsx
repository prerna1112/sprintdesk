import { useState, type FormEvent } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Button, Input, useToast } from '../components/ui';
import { useLogin } from '../features/auth';
import { AuthServiceError } from '../services/api-client/auth-service';
import { safeInternalPath } from '../routing/safe-internal-path';

function getReturnPath(state: unknown): string {
  if (!state || typeof state !== 'object') return '/dashboard';
  return safeInternalPath((state as Record<string, unknown>).returnTo, '/dashboard');
}

export default function LoginRoute() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const login = useLogin();
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  const usernameError = submitted && !username.trim() ? 'Enter your username.' : undefined;
  const passwordError = submitted && !password ? 'Enter your password.' : undefined;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitted(true);
    if (!username.trim() || !password) return;

    try {
      await login.mutateAsync({ username: username.trim(), password });
      toast({ title: 'Welcome back', description: 'You are signed in.', variant: 'success' });
      navigate(getReturnPath(location.state), { replace: true });
    } catch {
      // The mutation error is rendered next to the form.
    }
  }

  const apiError = login.error instanceof AuthServiceError
    ? login.error.message
    : login.error
      ? 'Sign in failed. Please try again.'
      : null;

  return (
    <main className="grid min-h-screen place-items-center px-4 py-12">
      <section className="w-full max-w-md rounded-2xl border bg-surface p-6 shadow-xl sm:p-8">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-primary">SprintDesk</p>
        <h1 className="mt-3 text-3xl font-black tracking-tight">Welcome back</h1>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">Sign in to continue to your team workspace.</p>
        <form className="mt-6 grid gap-4" noValidate onSubmit={handleSubmit}>
          <Input
            autoComplete="username"
            disabled={login.isPending}
            error={usernameError}
            label="Username"
            onChange={(event) => setUsername(event.target.value)}
            value={username}
          />
          <Input
            autoComplete="current-password"
            disabled={login.isPending}
            error={passwordError}
            label="Password"
            onChange={(event) => setPassword(event.target.value)}
            type="password"
            value={password}
          />
          {apiError ? (
            <p className="rounded-lg bg-danger/10 px-3 py-2 text-sm font-medium text-danger" role="alert">
              {apiError}
            </p>
          ) : null}
          <Button className="mt-1 w-full" loading={login.isPending} size="lg" type="submit">
            {login.isPending ? 'Signing in…' : 'Sign in'}
          </Button>
        </form>
        <aside className="mt-6 rounded-xl bg-muted p-4 text-sm" aria-label="Demo credentials">
          <p className="font-semibold">Try the demo account</p>
          <p className="mt-1 text-muted-foreground">
            Username <code className="font-semibold text-foreground">emilys</code> · Password{' '}
            <code className="font-semibold text-foreground">emilyspass</code>
          </p>
          <p className="mt-2 text-xs text-muted-foreground">Credentials are shown for demonstration only and are never stored.</p>
        </aside>
      </section>
    </main>
  );
}
