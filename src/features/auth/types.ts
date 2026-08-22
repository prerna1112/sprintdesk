export type AuthStatus =
  | 'unknown'
  | 'validating'
  | 'authenticated'
  | 'unauthenticated';

export interface AuthUser {
  id: string;
  username: string;
  email: string;
  firstName: string;
  lastName: string;
  image: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  accessTokenExpiresAt: number;
}

export interface AuthSession extends Omit<AuthTokens, 'refreshToken'> {
  user: AuthUser;
}

export function getAuthUserDisplayName(user: AuthUser): string {
  return [user.firstName, user.lastName].filter(Boolean).join(' ') || user.username;
}
