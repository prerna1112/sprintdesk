import { refreshTokenStorage, type RefreshTokenStorage } from '../../features/auth/refresh-token-storage';
import { expireAuthSession } from '../../features/auth/session';
import { useAuthStore } from '../../features/auth/auth-store';
import type { AuthTokens } from '../../features/auth/types';
import { authService } from './auth-service';
import { AuthenticatedFetchError, throwIfAborted } from './auth-errors';
import {
  createSessionRefreshCoordinator,
  type RefreshSessionSnapshot,
  type SessionRefreshCoordinator,
} from './session-refresh-coordinator';

const REFRESH_WINDOW_MS = 5_000;

interface AuthenticatedFetchOptions {
  fetchImpl?: typeof fetch;
  getSession: () => RefreshSessionSnapshot;
  refresh: (refreshToken: string) => Promise<AuthTokens>;
  updateSession: (tokens: AuthTokens) => void;
  storage: RefreshTokenStorage;
  onUnauthorized: () => void;
  refreshCoordinator?: SessionRefreshCoordinator;
  now?: () => number;
}

export { AuthenticatedFetchError } from './auth-errors';

export function createAuthenticatedFetch({
  fetchImpl,
  getSession,
  refresh,
  updateSession,
  storage,
  onUnauthorized,
  refreshCoordinator,
  now = Date.now,
}: AuthenticatedFetchOptions): typeof fetch {
  const coordinator = refreshCoordinator ?? createSessionRefreshCoordinator({
    getSession,
    refresh,
    updateSession,
    storage,
    onUnauthorized,
  });

  return async function authenticatedFetch(input, init = {}) {
    const signal = init.signal === undefined
      ? input instanceof Request ? input.signal : undefined
      : init.signal ?? undefined;
    throwIfAborted(signal);

    if (input instanceof Request && input.bodyUsed) {
      throw new AuthenticatedFetchError(
        'A request whose body has already been read cannot be authenticated or retried.',
        { code: 'request_not_replayable' },
      );
    }
    if (typeof ReadableStream !== 'undefined' && init.body instanceof ReadableStream) {
      throw new AuthenticatedFetchError(
        'Streaming request bodies cannot be retried safely.',
        { code: 'request_not_replayable' },
      );
    }

    let session = getSession();
    if (!session.accessToken) {
      await coordinator.refresh(signal);
      session = getSession();
    } else if (session.accessTokenExpiresAt === null
      || session.accessTokenExpiresAt <= now() + REFRESH_WINDOW_MS) {
      await coordinator.refresh(signal);
      session = getSession();
    }
    throwIfAborted(signal);

    if (!session.accessToken) {
      onUnauthorized();
      throw new AuthenticatedFetchError(
        'No authenticated session is available.',
        { code: 'no_session' },
      );
    }

    const originalHeaders = new Headers(input instanceof Request ? input.headers : undefined);
    new Headers(init.headers).forEach((value, key) => originalHeaders.set(key, value));
    originalHeaders.set('Authorization', `Bearer ${session.accessToken}`);

    let request: Request;
    try {
      request = new Request(input, { ...init, headers: originalHeaders });
      request.clone();
    } catch (error) {
      throw new AuthenticatedFetchError(
        'This request body cannot be replayed safely.',
        { cause: error, code: 'request_not_replayable' },
      );
    }

    const tokenUsed = session.accessToken;
    const generationUsed = session.sessionGeneration;
    const response = await (fetchImpl ?? fetch)(request.clone());
    if (response.status !== 401) return response;

    throwIfAborted(signal);
    let currentSession = getSession();
    if (currentSession.sessionGeneration !== generationUsed) {
      throw new AuthenticatedFetchError(
        'The session changed before the request could be retried.',
        { code: 'session_changed' },
      );
    }
    const currentToken = currentSession.accessToken;
    if (!currentToken || currentToken === tokenUsed) {
      await coordinator.refresh(signal);
    }

    throwIfAborted(signal);
    currentSession = getSession();
    if (currentSession.sessionGeneration !== generationUsed) {
      throw new AuthenticatedFetchError(
        'The session changed before the request could be retried.',
        { code: 'session_changed' },
      );
    }
    const retryToken = currentSession.accessToken;
    if (!retryToken) {
      onUnauthorized();
      throw new AuthenticatedFetchError(
        'No authenticated session is available.',
        { code: 'no_session' },
      );
    }
    const retryHeaders = new Headers(request.headers);
    retryHeaders.set('Authorization', `Bearer ${retryToken}`);
    return (fetchImpl ?? fetch)(new Request(request.clone(), { headers: retryHeaders }));
  };
}

export const sessionRefreshCoordinator = createSessionRefreshCoordinator({
  getSession: () => useAuthStore.getState(),
  refresh: (refreshToken) => authService.refresh(refreshToken),
  updateSession: (tokens) => useAuthStore.getState().refreshSession(tokens),
  storage: refreshTokenStorage,
  onUnauthorized: expireAuthSession,
});

export const authenticatedFetch = createAuthenticatedFetch({
  getSession: () => useAuthStore.getState(),
  refresh: (refreshToken) => authService.refresh(refreshToken),
  updateSession: (tokens) => useAuthStore.getState().refreshSession(tokens),
  storage: refreshTokenStorage,
  onUnauthorized: expireAuthSession,
  refreshCoordinator: sessionRefreshCoordinator,
});
