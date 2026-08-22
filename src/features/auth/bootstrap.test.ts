import { describe, expect, it, vi } from 'vitest';
import { authService } from '../../services/api-client/auth-service';
import { useAuthStore } from './auth-store';
import { bootstrapAuth } from './bootstrap';
import { refreshTokenStorage } from './refresh-token-storage';

const user = {
  id: '1', username: 'emilys', email: 'emily@example.com', firstName: 'Emily', lastName: 'Johnson', image: '',
};
const tokens = { accessToken: 'access', refreshToken: 'rotated-refresh', accessTokenExpiresAt: 123_000 };

describe('auth bootstrap', () => {
  it('becomes unauthenticated without a persisted refresh token', async () => {
    await bootstrapAuth();
    expect(useAuthStore.getState().status).toBe('unauthenticated');
  });

  it('refreshes, loads the user, and establishes a session', async () => {
    refreshTokenStorage.set('refresh');
    vi.spyOn(authService, 'refresh').mockResolvedValue(tokens);
    vi.spyOn(authService, 'me').mockResolvedValue(user);

    await bootstrapAuth();

    expect(authService.refresh).toHaveBeenCalledWith('refresh');
    expect(authService.me).toHaveBeenCalledWith('access');
    expect(refreshTokenStorage.get()).toBe('rotated-refresh');
    expect(useAuthStore.getState()).toMatchObject({ status: 'authenticated', accessToken: 'access', user });
  });

  it('clears an invalid refresh session', async () => {
    refreshTokenStorage.set('invalid');
    vi.spyOn(authService, 'refresh').mockRejectedValue(new Error('invalid'));
    await bootstrapAuth();
    expect(refreshTokenStorage.get()).toBeNull();
    expect(useAuthStore.getState().status).toBe('unauthenticated');
  });

  it('deduplicates StrictMode-style concurrent bootstrap calls', async () => {
    refreshTokenStorage.set('refresh');
    let resolveRefresh!: (value: typeof tokens) => void;
    vi.spyOn(authService, 'refresh').mockImplementation(() => new Promise((resolve) => { resolveRefresh = resolve; }));
    vi.spyOn(authService, 'me').mockResolvedValue(user);

    const first = bootstrapAuth();
    const second = bootstrapAuth();
    expect(useAuthStore.getState().status).toBe('validating');
    expect(authService.refresh).toHaveBeenCalledTimes(1);
    resolveRefresh(tokens);
    await Promise.all([first, second]);
    expect(authService.me).toHaveBeenCalledTimes(1);
  });
});
