import { authService } from '../../services/api-client/auth-service';
import {
  sessionRefreshCoordinator,
} from '../../services/api-client/authenticated-fetch';
import type { SessionRefreshCoordinator } from '../../services/api-client/session-refresh-coordinator';
import { useAuthStore } from './auth-store';
import { refreshTokenStorage } from './refresh-token-storage';
import { clearAuthSession } from './session';

let bootstrapPromise: Promise<void> | null = null;

export function bootstrapAuth(
  coordinator: SessionRefreshCoordinator = sessionRefreshCoordinator,
): Promise<void> {
  if (bootstrapPromise) return bootstrapPromise;

  bootstrapPromise = (async () => {
    const store = useAuthStore.getState();
    if (store.status === 'authenticated') return;

    try {
      if (!refreshTokenStorage.get()) {
        store.clearSession();
        return;
      }
    } catch {
      clearAuthSession();
      return;
    }

    const generationAtStart = store.sessionGeneration;
    store.beginValidation();
    try {
      let accessToken = useAuthStore.getState().accessToken;
      if (!accessToken) {
        const tokens = await coordinator.refresh();
        accessToken = tokens.accessToken;
      }

      if (useAuthStore.getState().sessionGeneration !== generationAtStart) return;
      const user = await authService.me(accessToken);
      const currentSession = useAuthStore.getState();
      if (currentSession.sessionGeneration !== generationAtStart) return;
      if (!currentSession.accessToken || currentSession.accessTokenExpiresAt === null) {
        throw new Error('Session refresh completed without usable access metadata.');
      }
      useAuthStore.getState().setSession({
        accessToken: currentSession.accessToken,
        accessTokenExpiresAt: currentSession.accessTokenExpiresAt,
        user,
      });
    } catch {
      const current = useAuthStore.getState();
      if (current.sessionGeneration !== generationAtStart
        && (current.status === 'authenticated' || current.status === 'unauthenticated')) return;
      clearAuthSession();
    }
  })();

  void bootstrapPromise.finally(() => {
    bootstrapPromise = null;
  });
  return bootstrapPromise;
}

export function resetAuthBootstrapForTests(): void {
  bootstrapPromise = null;
}
