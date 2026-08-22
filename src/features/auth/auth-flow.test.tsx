import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import App from '../../app/App';
import { renderWithProviders } from '../../test/render';
import { authService, AuthServiceError } from '../../services/api-client/auth-service';
import { AUTH_REFRESH_STORAGE_KEY, refreshTokenStorage } from './refresh-token-storage';
import { useAuthStore } from './auth-store';

const user = {
  id: '1', username: 'emilys', email: 'emily@example.com', firstName: 'Emily', lastName: 'Johnson', image: '',
};
const result = { user, accessToken: 'secret-access', refreshToken: 'secret-refresh', accessTokenExpiresAt: Date.now() + 60_000 };

describe('login and logout flow', () => {
  it('validates required credentials', async () => {
    const login = vi.spyOn(authService, 'login');
    const userEventApi = userEvent.setup();
    renderWithProviders(<App />, { route: '/login' });
    await userEventApi.click(await screen.findByRole('button', { name: 'Sign in' }));
    expect(screen.getByText('Enter your username.')).toBeInTheDocument();
    expect(screen.getByText('Enter your password.')).toBeInTheDocument();
    expect(login).not.toHaveBeenCalled();
  });

  it('signs in, stores only the refresh token, and returns safely to the intended route', async () => {
    vi.spyOn(authService, 'login').mockResolvedValue(result);
    const userEventApi = userEvent.setup();
    renderWithProviders(<App />, { route: '/board' });
    await userEventApi.type(await screen.findByLabelText('Username'), 'emilys');
    await userEventApi.type(screen.getByLabelText('Password'), 'emilyspass');
    await userEventApi.click(screen.getByRole('button', { name: 'Sign in' }));

    expect(await screen.findByRole('heading', { name: 'Board' })).toBeInTheDocument();
    expect(useAuthStore.getState().user).toEqual(user);
    expect(localStorage.getItem(AUTH_REFRESH_STORAGE_KEY)).toContain('secret-refresh');
    const persisted = JSON.stringify({ ...localStorage });
    expect(persisted).not.toContain('secret-access');
    expect(persisted).not.toContain('emilyspass');
    expect(persisted).not.toContain('emily@example.com');
  });

  it('renders a descriptive API failure', async () => {
    vi.spyOn(authService, 'login').mockRejectedValue(
      new AuthServiceError('The username or password is incorrect.', 'invalid_credentials', 400),
    );
    const userEventApi = userEvent.setup();
    renderWithProviders(<App />, { route: '/login' });
    await userEventApi.type(await screen.findByLabelText('Username'), 'wrong');
    await userEventApi.type(screen.getByLabelText('Password'), 'wrong');
    await userEventApi.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('incorrect');
  });

  it('logs out, clears auth and query cache, and redirects', async () => {
    useAuthStore.getState().setSession({
      user, accessToken: result.accessToken, accessTokenExpiresAt: result.accessTokenExpiresAt,
    });
    refreshTokenStorage.set(result.refreshToken);
    const userEventApi = userEvent.setup();
    const { queryClient } = renderWithProviders(<App />, { route: '/dashboard' });
    queryClient.setQueryData(['private'], { secret: true });

    await userEventApi.click(await screen.findByRole('button', { name: 'Log out Emily Johnson' }));
    expect(await screen.findByRole('heading', { name: 'Welcome back' })).toBeInTheDocument();
    expect(useAuthStore.getState().status).toBe('unauthenticated');
    expect(refreshTokenStorage.get()).toBeNull();
    await waitFor(() => expect(queryClient.getQueryData(['private'])).toBeUndefined());
  });
});
