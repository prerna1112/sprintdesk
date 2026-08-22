import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { useAuthStore } from './auth-store';
import { GuestOnlyRoute, ProtectedRoute } from './route-guards';

function LoginProbe() {
  const location = useLocation();
  return <p>Login return: {String((location.state as { returnTo?: unknown } | null)?.returnTo)}</p>;
}

function GuardRoutes() {
  return (
    <Routes>
      <Route element={<GuestOnlyRoute />}>
        <Route path="/login" element={<LoginProbe />} />
      </Route>
      <Route element={<ProtectedRoute />}>
        <Route path="/dashboard" element={<h1>Dashboard</h1>} />
        <Route path="/board" element={<h1>Board</h1>} />
      </Route>
    </Routes>
  );
}

describe('auth route guards', () => {
  it('shows a full-screen session loader before deciding', () => {
    useAuthStore.getState().beginValidation();
    render(<MemoryRouter initialEntries={['/board']}><GuardRoutes /></MemoryRouter>);
    expect(screen.getByRole('status')).toHaveTextContent('Validating your session');
    expect(screen.queryByRole('heading', { name: 'Board' })).not.toBeInTheDocument();
  });

  it('redirects guests and safely records the intended internal path', async () => {
    useAuthStore.getState().clearSession();
    render(<MemoryRouter initialEntries={['/board?view=mine#top']}><GuardRoutes /></MemoryRouter>);
    expect(await screen.findByText('Login return: /board?view=mine#top')).toBeInTheDocument();
  });

  it('keeps authenticated users out of login', async () => {
    useAuthStore.getState().setSession({
      accessToken: 'access', accessTokenExpiresAt: 1, user: {
        id: '1', username: 'emilys', email: '', firstName: 'Emily', lastName: 'Johnson', image: '',
      },
    });
    render(<MemoryRouter initialEntries={['/login']}><GuardRoutes /></MemoryRouter>);
    expect(await screen.findByRole('heading', { name: 'Dashboard' })).toBeInTheDocument();
  });
});
