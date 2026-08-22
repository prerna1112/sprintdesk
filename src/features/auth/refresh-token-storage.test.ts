import { describe, expect, it } from 'vitest';
import { AUTH_REFRESH_STORAGE_KEY, createRefreshTokenStorage } from './refresh-token-storage';

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
});
