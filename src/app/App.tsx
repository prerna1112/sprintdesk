import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { AppShell } from './AppShell';
import { Skeleton } from '../components/ui/Skeleton';

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
        <Route path="/login" element={<LoginRoute />} />
        <Route element={<AppShell />}>
          <Route path="/dashboard" element={<DashboardRoute />} />
          <Route path="/board" element={<BoardRoute />} />
          <Route path="/analytics" element={<AnalyticsRoute />} />
        </Route>
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </Suspense>
  );
}
