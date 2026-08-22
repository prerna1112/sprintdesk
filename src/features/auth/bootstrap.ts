import { authService } from '../../services/api-client/auth-service';
import { useAuthStore } from './auth-store';
import { refreshTokenStorage } from './refresh-token-storage';

let bootstrapPromise: Promise<void> | null = null;

export function bootstrapAuth(): Promise<void> {
  if (bootstrapPromise) return bootstrapPromise;

  bootstrapPromise = (async () => {
    const store = useAuthStore.getState();
    if (store.status === 'authenticated') return;

    const refreshToken = refreshTokenStorage.get();
    if (!refreshToken) {
      store.clearSession();
      return;
    }

    const generationAtStart = store.sessionGeneration;
    store.beginValidation();
    try {
      const tokens = await authService.refresh(refreshToken);
      if (useAuthStore.getState().sessionGeneration !== generationAtStart
        || refreshTokenStorage.get() !== refreshToken) return;
      const user = await authService.me(tokens.accessToken);
      if (useAuthStore.getState().sessionGeneration !== generationAtStart
        || refreshTokenStorage.get() !== refreshToken) return;
      refreshTokenStorage.set(tokens.refreshToken);
      useAuthStore.getState().setSession({
        accessToken: tokens.accessToken,
        accessTokenExpiresAt: tokens.accessTokenExpiresAt,
        user,
      });
    } catch {
      if (useAuthStore.getState().sessionGeneration !== generationAtStart
        || refreshTokenStorage.get() !== refreshToken) return;
      refreshTokenStorage.clear();
      useAuthStore.getState().clearSession();
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
