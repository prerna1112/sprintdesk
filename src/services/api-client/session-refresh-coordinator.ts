import type { RefreshTokenStorage } from '../../features/auth/refresh-token-storage';
import type { AuthTokens } from '../../features/auth/types';
import { AuthenticatedFetchError, createAbortError, throwIfAborted } from './auth-errors';

export interface RefreshSessionSnapshot {
  accessToken: string | null;
  accessTokenExpiresAt: number | null;
  sessionGeneration: number;
}

interface SessionRefreshCoordinatorOptions {
  getSession: () => RefreshSessionSnapshot;
  refresh: (refreshToken: string) => Promise<AuthTokens>;
  updateSession: (tokens: AuthTokens) => void;
  storage: RefreshTokenStorage;
  onUnauthorized: () => void;
}

export interface SessionRefreshCoordinator {
  refresh: (signal?: AbortSignal) => Promise<AuthTokens>;
}

function sessionChangedError(cause?: unknown): AuthenticatedFetchError {
  return new AuthenticatedFetchError(
    'The session changed while a token refresh was in progress.',
    { cause, code: 'session_changed' },
  );
}

function waitForCaller<T>(promise: Promise<T>, signal: AbortSignal | undefined): Promise<T> {
  if (!signal) return promise;
  if (signal.aborted) return Promise.reject(createAbortError());

  return new Promise<T>((resolve, reject) => {
    const abort = () => {
      signal.removeEventListener('abort', abort);
      reject(createAbortError());
    };
    signal.addEventListener('abort', abort, { once: true });
    promise.then(
      (value) => {
        signal.removeEventListener('abort', abort);
        resolve(value);
      },
      (error: unknown) => {
        signal.removeEventListener('abort', abort);
        reject(error);
      },
    );
  });
}

export function createSessionRefreshCoordinator({
  getSession,
  refresh,
  updateSession,
  storage,
  onUnauthorized,
}: SessionRefreshCoordinatorOptions): SessionRefreshCoordinator {
  let sharedRefresh: Promise<AuthTokens> | null = null;

  function isSameSession(
    expected: RefreshSessionSnapshot,
    expectedRefreshToken: string,
  ): boolean {
    const current = getSession();
    return current.sessionGeneration === expected.sessionGeneration
      && current.accessToken === expected.accessToken
      && storage.get() === expectedRefreshToken;
  }

  function createSharedRefresh(): Promise<AuthTokens> {
    const operation = (async () => {
      const refreshToken = storage.get();
      if (!refreshToken) {
        throw new AuthenticatedFetchError(
          'Your session has expired. Please sign in again.',
          { code: 'session_expired' },
        );
      }

      const sessionAtStart = getSession();
      let tokens: AuthTokens;
      try {
        tokens = await refresh(refreshToken);
      } catch (error) {
        if (!isSameSession(sessionAtStart, refreshToken)) {
          throw sessionChangedError(error);
        }
        throw error;
      }

      if (!isSameSession(sessionAtStart, refreshToken)) {
        throw sessionChangedError();
      }

      storage.set(tokens.refreshToken);
      updateSession(tokens);
      return tokens;
    })().catch((error: unknown) => {
      if (error instanceof AuthenticatedFetchError && error.code === 'session_changed') {
        throw error;
      }

      try {
        onUnauthorized();
      } catch {
        // Session cleanup is best-effort; callers still receive one stable error type.
      }
      throw error instanceof AuthenticatedFetchError
        ? error
        : new AuthenticatedFetchError(
          'Your session has expired. Please sign in again.',
          { cause: error, code: 'session_expired' },
        );
    });

    const normalized = operation.finally(() => {
      if (sharedRefresh === normalized) sharedRefresh = null;
    });
    return normalized;
  }

  return {
    refresh(signal) {
      throwIfAborted(signal);
      sharedRefresh ??= createSharedRefresh();
      return waitForCaller(sharedRefresh, signal);
    },
  };
}
