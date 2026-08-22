import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { safeInternalPath } from '../../routing/safe-internal-path';
import { useAuthStore } from './auth-store';

export function SessionLoader() {
  return (
    <main className="grid min-h-screen place-items-center bg-background px-4">
      <div aria-busy="true" aria-live="polite" className="text-center" role="status">
        <span aria-hidden="true" className="mx-auto block size-8 animate-spin rounded-full border-4 border-primary border-r-transparent" />
        <p className="mt-4 text-sm font-semibold">Validating your session…</p>
      </div>
    </main>
  );
}

export function ProtectedRoute() {
  const status = useAuthStore((state) => state.status);
  const location = useLocation();

  if (status === 'unknown' || status === 'validating') return <SessionLoader />;
  if (status === 'unauthenticated') {
    const returnTo = safeInternalPath(
      `${location.pathname}${location.search}${location.hash}`,
      '/dashboard',
    );
    return <Navigate replace state={{ returnTo }} to="/login" />;
  }
  return <Outlet />;
}

export function GuestOnlyRoute() {
  const status = useAuthStore((state) => state.status);
  const location = useLocation();
  if (status === 'unknown' || status === 'validating') return <SessionLoader />;
  if (status === 'authenticated') {
    const returnTo = location.state && typeof location.state === 'object'
      ? (location.state as Record<string, unknown>).returnTo
      : undefined;
    return <Navigate replace to={safeInternalPath(returnTo, '/dashboard')} />;
  }
  return <Outlet />;
}
