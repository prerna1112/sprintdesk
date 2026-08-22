import { QueryClient } from '@tanstack/react-query';
import { describe, expect, it, vi } from 'vitest';
import { useAuthStore } from './auth-store';
import { logout } from './session';
import {
  AUTH_REFRESH_STORAGE_KEY,
  createRefreshTokenStorage,
  RefreshTokenStorageError,
} from './refresh-token-storage';

describe('refreshTokenStorage', () => {
  it('stores only a versioned refresh token and clears it', () => {
    const storage = createRefreshTokenStorage(localStorage);
    storage.set('refresh-token');

    expect(JSON.parse(localStorage.getItem(AUTH_REFRESH_STORAGE_KEY) ?? '')).toEqual({
      version: 1,
      refreshToken: 'refresh-token',
    });
    expect(storage.get()).toBe('refresh-token');

    storage.clear();
    expect(localStorage.getItem(AUTH_REFRESH_STORAGE_KEY)).toBeNull();
  });

  it.each([
    'not-json',
    JSON.stringify({ version: 2, refreshToken: 'token' }),
    JSON.stringify({ version: 1, refreshToken: '' }),
    JSON.stringify({ version: 1, refreshToken: 123 }),
    JSON.stringify({ version: 1, refreshToken: 'refresh', accessToken: 'must-not-be-here' }),
  ])('rejects and removes invalid persisted data', (value) => {
    localStorage.setItem(AUTH_REFRESH_STORAGE_KEY, value);
    const storage = createRefreshTokenStorage(localStorage);

    expect(storage.get()).toBeNull();
    expect(localStorage.getItem(AUTH_REFRESH_STORAGE_KEY)).toBeNull();
  });

  it.each([
    ['read', 'getItem'],
    ['write', 'setItem'],
    ['clear', 'removeItem'],
  ] as const)('maps a throwing %s operation to a typed storage error', (operation, method) => {
    const throwingStorage = {
      getItem: vi.fn(() => method === 'getItem' ? (() => { throw new Error('blocked'); })() : null),
      setItem: vi.fn(() => {
        if (method === 'setItem') throw new Error('blocked');
      }),
      removeItem: vi.fn(() => {
        if (method === 'removeItem') throw new Error('blocked');
      }),
    };
    const storage = createRefreshTokenStorage(throwingStorage);

    let thrown: unknown;
    try {
      if (operation === 'read') storage.get();
      else if (operation === 'write') storage.set('refresh');
      else storage.clear();
    } catch (error) {
      thrown = error;
    }
    expect(thrown).toBeInstanceOf(RefreshTokenStorageError);
    expect((thrown as RefreshTokenStorageError).operation).toBe(operation);
  });

  it('still clears memory and query data when persisted-token removal throws', () => {
    const queryClient = new QueryClient();
    queryClient.setQueryData(['private'], { secret: true });
    useAuthStore.getState().setSession({
      accessToken: 'access',
      accessTokenExpiresAt: Date.now() + 60_000,
      user: {
        id: '1', username: 'emilys', email: '', firstName: 'Emily', lastName: 'Johnson', image: '',
      },
    });
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
      throw new Error('storage unavailable');
    });

    expect(() => logout(queryClient)).not.toThrow();
    expect(useAuthStore.getState()).toMatchObject({
      status: 'unauthenticated', accessToken: null, user: null,
    });
    expect(queryClient.getQueryData(['private'])).toBeUndefined();
  });
});
