import { refreshTokenStorage, type RefreshTokenStorage } from '../../features/auth/refresh-token-storage';
import { expireAuthSession } from '../../features/auth/session';
import { useAuthStore } from '../../features/auth/auth-store';
import type { AuthTokens } from '../../features/auth/types';
import { authService } from './auth-service';

const REFRESH_WINDOW_MS = 5_000;

interface SessionSnapshot {
  accessToken: string | null;
  accessTokenExpiresAt: number | null;
}

interface AuthenticatedFetchOptions {
  fetchImpl?: typeof fetch;
  getSession: () => SessionSnapshot;
  refresh: (refreshToken: string) => Promise<AuthTokens>;
  updateSession: (tokens: AuthTokens) => void;
  storage: RefreshTokenStorage;
  onUnauthorized: () => void;
  now?: () => number;
}

export class AuthenticatedFetchError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = 'AuthenticatedFetchError';
  }
}

export function createAuthenticatedFetch({
  fetchImpl = fetch,
  getSession,
  refresh,
  updateSession,
  storage,
  onUnauthorized,
  now = Date.now,
}: AuthenticatedFetchOptions): typeof fetch {
  let refreshPromise: Promise<AuthTokens> | null = null;

  async function refreshOnce(): Promise<AuthTokens> {
    if (refreshPromise) return refreshPromise;

    refreshPromise = (async () => {
      const refreshToken = storage.get();
      if (!refreshToken) throw new AuthenticatedFetchError('Your session has expired. Please sign in again.');
      const tokens = await refresh(refreshToken);
      storage.set(tokens.refreshToken);
      updateSession(tokens);
      return tokens;
    })();

    try {
      return await refreshPromise;
    } catch (error) {
      storage.clear();
      onUnauthorized();
      throw new AuthenticatedFetchError('Your session has expired. Please sign in again.', { cause: error });
    } finally {
      refreshPromise = null;
    }
  }

  return async function authenticatedFetch(input, init = {}) {
    if (input instanceof Request && input.bodyUsed) {
      throw new AuthenticatedFetchError('A request whose body has already been read cannot be authenticated or retried.');
    }
    if (typeof ReadableStream !== 'undefined' && init.body instanceof ReadableStream) {
      throw new AuthenticatedFetchError('Streaming request bodies cannot be retried safely.');
    }

    let session = getSession();
    if (!session.accessToken) {
      await refreshOnce();
      session = getSession();
    } else if (session.accessTokenExpiresAt === null
      || session.accessTokenExpiresAt <= now() + REFRESH_WINDOW_MS) {
      await refreshOnce();
      session = getSession();
    }

    if (!session.accessToken) {
      onUnauthorized();
      throw new AuthenticatedFetchError('No authenticated session is available.');
    }

    const originalHeaders = new Headers(input instanceof Request ? input.headers : undefined);
    new Headers(init.headers).forEach((value, key) => originalHeaders.set(key, value));
    originalHeaders.set('Authorization', `Bearer ${session.accessToken}`);

    let request: Request;
    try {
      request = new Request(input, { ...init, headers: originalHeaders });
      request.clone();
    } catch (error) {
      throw new AuthenticatedFetchError('This request body cannot be replayed safely.', { cause: error });
    }

    const tokenUsed = session.accessToken;
    const response = await fetchImpl(request.clone());
    if (response.status !== 401) return response;

    const currentToken = getSession().accessToken;
    if (!currentToken || currentToken === tokenUsed) {
      await refreshOnce();
    }

    const retryToken = getSession().accessToken;
    if (!retryToken) {
      onUnauthorized();
      throw new AuthenticatedFetchError('No authenticated session is available.');
    }
    const retryHeaders = new Headers(request.headers);
    retryHeaders.set('Authorization', `Bearer ${retryToken}`);
    return fetchImpl(new Request(request.clone(), { headers: retryHeaders }));
  };
}

export const authenticatedFetch = createAuthenticatedFetch({
  getSession: () => useAuthStore.getState(),
  refresh: authService.refresh,
  updateSession: (tokens) => useAuthStore.getState().refreshSession(tokens),
  storage: refreshTokenStorage,
  onUnauthorized: expireAuthSession,
});
