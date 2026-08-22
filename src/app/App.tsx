import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';

const LoginRoute = lazy(() => import('../routes/LoginRoute'));
const DashboardRoute = lazy(() => import('../routes/DashboardRoute'));
const BoardRoute = lazy(() => import('../routes/BoardRoute'));
const AnalyticsRoute = lazy(() => import('../routes/AnalyticsRoute'));

function RouteFallback() {
  return (
    <main className="grid min-h-screen place-items-center" aria-busy="true">
      <p className="text-sm text-muted-foreground">Loading SprintDesk…</p>
    </main>
  );
}

export default function App() {
  return (
    <Suspense fallback={<RouteFallback />}>
      <Routes>
        <Route path="/login" element={<LoginRoute />} />
        <Route path="/dashboard" element={<DashboardRoute />} />
        <Route path="/board" element={<BoardRoute />} />
        <Route path="/analytics" element={<AnalyticsRoute />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </Suspense>
  );
}
