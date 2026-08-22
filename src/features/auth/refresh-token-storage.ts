export const AUTH_REFRESH_STORAGE_KEY = 'sprintdesk.auth.refresh.v1';

interface StoredRefreshToken {
  version: 1;
  refreshToken: string;
}

export type RefreshTokenStorageOperation = 'read' | 'write' | 'clear';

export class RefreshTokenStorageError extends Error {
  constructor(
    readonly operation: RefreshTokenStorageOperation,
    options?: ErrorOptions,
  ) {
    super(`Unable to ${operation} the persisted refresh token.`, options);
    this.name = 'RefreshTokenStorageError';
  }
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
      let value: string | null;
      try {
        value = storage.getItem(AUTH_REFRESH_STORAGE_KEY);
      } catch (error) {
        throw new RefreshTokenStorageError('read', { cause: error });
      }
      if (!value) return null;

      try {
        const parsed: unknown = JSON.parse(value);
        if (isStoredRefreshToken(parsed)) return parsed.refreshToken;
      } catch {
        // Invalid persisted data is removed below.
      }

      try {
        storage.removeItem(AUTH_REFRESH_STORAGE_KEY);
      } catch (error) {
        throw new RefreshTokenStorageError('clear', { cause: error });
      }
      return null;
    },
    set(refreshToken) {
      if (!refreshToken) {
        throw new Error('A non-empty refresh token is required');
      }
      const value: StoredRefreshToken = { version: 1, refreshToken };
      try {
        storage.setItem(AUTH_REFRESH_STORAGE_KEY, JSON.stringify(value));
      } catch (error) {
        throw new RefreshTokenStorageError('write', { cause: error });
      }
    },
    clear() {
      try {
        storage.removeItem(AUTH_REFRESH_STORAGE_KEY);
      } catch (error) {
        throw new RefreshTokenStorageError('clear', { cause: error });
      }
    },
  };
}

export const refreshTokenStorage = createRefreshTokenStorage({
  getItem: (key) => window.localStorage.getItem(key),
  setItem: (key, value) => window.localStorage.setItem(key, value),
  removeItem: (key) => window.localStorage.removeItem(key),
});
