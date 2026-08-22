import { create } from 'zustand';
import type { AuthSession, AuthStatus, AuthTokens, AuthUser } from './types';

interface AuthState {
  status: AuthStatus;
  sessionGeneration: number;
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
  sessionGeneration: 0,
  ...emptySession,
  beginValidation: () => set({ status: 'validating' }),
  setSession: ({ accessToken, accessTokenExpiresAt, user }) =>
    set((state) => ({
      status: 'authenticated',
      sessionGeneration: state.sessionGeneration + 1,
      accessToken,
      accessTokenExpiresAt,
      user,
    })),
  refreshSession: ({ accessToken, accessTokenExpiresAt }) =>
    set((state) => ({
      status: state.user ? 'authenticated' : state.status,
      accessToken,
      accessTokenExpiresAt,
    })),
  clearSession: () => set((state) => ({
    status: 'unauthenticated',
    sessionGeneration: state.sessionGeneration + 1,
    ...emptySession,
  })),
}));

export function resetAuthStore(): void {
  useAuthStore.setState({ status: 'unknown', sessionGeneration: 0, ...emptySession });
}
