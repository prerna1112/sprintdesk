export const AUTH_REFRESH_STORAGE_KEY = 'sprintdesk.auth.refresh.v1';

interface StoredRefreshToken {
  version: 1;
  refreshToken: string;
}

function isStoredRefreshToken(value: unknown): value is StoredRefreshToken {
  if (!value || typeof value !== 'object') return false;
  const record = value as Record<string, unknown>;
  return Object.keys(record).length === 2
    && record.version === 1
    && typeof record.refreshToken === 'string'
    && record.refreshToken.length > 0;
}

export interface RefreshTokenStorage {
  get: () => string | null;
  set: (refreshToken: string) => void;
  clear: () => void;
}

export function createRefreshTokenStorage(
  storage: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>,
): RefreshTokenStorage {
  return {
    get() {
      const value = storage.getItem(AUTH_REFRESH_STORAGE_KEY);
      if (!value) return null;

      try {
        const parsed: unknown = JSON.parse(value);
        if (isStoredRefreshToken(parsed)) return parsed.refreshToken;
      } catch {
        // Invalid persisted data is removed below.
      }

      storage.removeItem(AUTH_REFRESH_STORAGE_KEY);
      return null;
    },
    set(refreshToken) {
      if (!refreshToken) {
        throw new Error('A non-empty refresh token is required');
      }
      const value: StoredRefreshToken = { version: 1, refreshToken };
      storage.setItem(AUTH_REFRESH_STORAGE_KEY, JSON.stringify(value));
    },
    clear() {
      storage.removeItem(AUTH_REFRESH_STORAGE_KEY);
    },
  };
}

export const refreshTokenStorage = createRefreshTokenStorage(window.localStorage);
