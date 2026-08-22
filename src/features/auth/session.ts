import type { QueryClient } from '@tanstack/react-query';
import { refreshTokenStorage } from './refresh-token-storage';
import { useAuthStore } from './auth-store';

type UnauthorizedHandler = () => void;

let unauthorizedHandler: UnauthorizedHandler = () => undefined;

export function setUnauthorizedHandler(handler: UnauthorizedHandler): () => void {
  unauthorizedHandler = handler;
  return () => {
    if (unauthorizedHandler === handler) unauthorizedHandler = () => undefined;
  };
}

export function clearAuthSession(): void {
  try {
    refreshTokenStorage.clear();
  } catch {
    // Browser storage can be unavailable; memory invalidation must still win.
  } finally {
    useAuthStore.getState().clearSession();
  }
}

export function expireAuthSession(): void {
  clearAuthSession();
  unauthorizedHandler();
}

export function logout(queryClient: QueryClient): void {
  try {
    clearAuthSession();
  } finally {
    queryClient.clear();
  }
}
