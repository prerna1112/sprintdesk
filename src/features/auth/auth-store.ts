import { create } from 'zustand';
import type { AuthSession, AuthStatus, AuthTokens, AuthUser } from './types';

interface AuthState {
  status: AuthStatus;
  accessToken: string | null;
  accessTokenExpiresAt: number | null;
  user: AuthUser | null;
  beginValidation: () => void;
  setSession: (session: AuthSession) => void;
  refreshSession: (tokens: AuthTokens) => void;
  clearSession: () => void;
}

const emptySession = {
  accessToken: null,
  accessTokenExpiresAt: null,
  user: null,
} as const;

export const useAuthStore = create<AuthState>((set) => ({
  status: 'unknown',
  ...emptySession,
  beginValidation: () => set({ status: 'validating' }),
  setSession: ({ accessToken, accessTokenExpiresAt, user }) =>
    set({
      status: 'authenticated',
      accessToken,
      accessTokenExpiresAt,
      user,
    }),
  refreshSession: ({ accessToken, accessTokenExpiresAt }) =>
    set((state) => ({
      status: state.user ? 'authenticated' : state.status,
      accessToken,
      accessTokenExpiresAt,
    })),
  clearSession: () => set({ status: 'unauthenticated', ...emptySession }),
}));

export function resetAuthStore(): void {
  useAuthStore.setState({ status: 'unknown', ...emptySession });
}
