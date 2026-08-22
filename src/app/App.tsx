import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { Skeleton } from '../components/ui/Skeleton';
import { GuestOnlyRoute, ProtectedRoute } from '../features/auth';

const AppShell = lazy(() =>
  import('./AppShell').then((module) => ({ default: module.AppShell })),
);
const LoginRoute = lazy(() => import('../routes/LoginRoute'));
const DashboardRoute = lazy(() => import('../routes/DashboardRoute'));
const BoardRoute = lazy(() => import('../routes/BoardRoute'));
const AnalyticsRoute = lazy(() => import('../routes/AnalyticsRoute'));

function RouteFallback() {
  return (
    <div aria-busy="true" aria-label="Loading page" className="grid gap-4" role="status">
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-28 w-full" />
    </div>
  );
}

export default function App() {
  return (
    <Suspense fallback={<RouteFallback />}>
      <Routes>
        <Route element={<GuestOnlyRoute />}>
          <Route path="/login" element={<LoginRoute />} />
        </Route>
        <Route element={<ProtectedRoute />}>
          <Route element={<AppShell />}>
            <Route path="/dashboard" element={<DashboardRoute />} />
            <Route path="/board" element={<BoardRoute />} />
            <Route path="/analytics" element={<AnalyticsRoute />} />
          </Route>
        </Route>
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </Suspense>
  );
}
