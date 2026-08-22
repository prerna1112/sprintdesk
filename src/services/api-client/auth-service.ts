import type { AuthTokens, AuthUser } from '../../features/auth/types';

export const AUTH_TOKEN_LIFETIME_MINUTES = 1;
const FALLBACK_TOKEN_LIFETIME_MS = AUTH_TOKEN_LIFETIME_MINUTES * 60_000;

type AuthErrorCode = 'invalid_credentials' | 'unauthorized' | 'network' | 'invalid_response' | 'server';

export class AuthServiceError extends Error {
  constructor(
    message: string,
    readonly code: AuthErrorCode,
    readonly status?: number,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = 'AuthServiceError';
  }
}

interface DummyJsonUser {
  id: number | string;
  username: string;
  email: string;
  firstName: string;
  lastName: string;
  image: string;
}

interface DummyJsonTokens {
  accessToken: string;
  refreshToken: string;
}

interface AuthServiceOptions {
  baseUrl?: string;
  fetchImpl?: typeof fetch;
  now?: () => number;
}

export interface LoginResult extends AuthTokens {
  user: AuthUser;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object';
}

function parseUser(value: unknown): AuthUser {
  if (!isRecord(value)
    || (typeof value.id !== 'number' && typeof value.id !== 'string')
    || typeof value.username !== 'string'
    || typeof value.email !== 'string'
    || typeof value.firstName !== 'string'
    || typeof value.lastName !== 'string'
    || typeof value.image !== 'string') {
    throw new AuthServiceError('The authentication server returned an invalid user.', 'invalid_response');
  }

  const user = value as unknown as DummyJsonUser;
  return {
    id: String(user.id),
    username: user.username,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    image: user.image,
  };
}

function parseTokens(value: unknown, now: () => number): AuthTokens {
  if (!isRecord(value)
    || typeof value.accessToken !== 'string'
    || !value.accessToken
    || typeof value.refreshToken !== 'string'
    || !value.refreshToken) {
    throw new AuthServiceError('The authentication server returned invalid tokens.', 'invalid_response');
  }

  const tokens = value as unknown as DummyJsonTokens;
  return {
    accessToken: tokens.accessToken,
    refreshToken: tokens.refreshToken,
    accessTokenExpiresAt: getJwtExpiry(tokens.accessToken) ?? now() + FALLBACK_TOKEN_LIFETIME_MS,
  };
}

function decodeBase64Url(value: string): string {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  return atob(normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '='));
}

/** JWT expiry is used only as a client-side refresh timer, never as verification. */
export function getJwtExpiry(token: string): number | null {
  const payload = token.split('.')[1];
  if (!payload) return null;
  try {
    const value: unknown = JSON.parse(decodeBase64Url(payload));
    if (!isRecord(value) || typeof value.exp !== 'number' || !Number.isFinite(value.exp)) {
      return null;
    }
    return value.exp * 1000;
  } catch {
    return null;
  }
}

async function parseResponse(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    if (response.ok) {
      throw new AuthServiceError('The authentication server returned an unreadable response.', 'invalid_response', response.status);
    }
    return null;
  }
}

function responseMessage(value: unknown): string | null {
  return isRecord(value) && typeof value.message === 'string' ? value.message : null;
}

export function createAuthService({
  baseUrl = import.meta.env.VITE_API_BASE_URL || 'https://dummyjson.com',
  fetchImpl,
  now = Date.now,
}: AuthServiceOptions = {}) {
  async function request(path: string, init: RequestInit, action: string): Promise<unknown> {
    let response: Response;
    try {
      response = await (fetchImpl ?? fetch)(`${baseUrl}${path}`, init);
    } catch (error) {
      throw new AuthServiceError(`Unable to ${action}. Check your connection and try again.`, 'network', undefined, { cause: error });
    }

    const body = await parseResponse(response);
    if (!response.ok) {
      const invalidCredentials = path === '/auth/login' && (response.status === 400 || response.status === 401);
      throw new AuthServiceError(
        responseMessage(body) ?? (invalidCredentials ? 'The username or password is incorrect.' : `Unable to ${action}.`),
        invalidCredentials ? 'invalid_credentials' : response.status === 401 ? 'unauthorized' : 'server',
        response.status,
      );
    }
    return body;
  }

  return {
    async login(username: string, password: string): Promise<LoginResult> {
      const body = await request('/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password, expiresInMins: AUTH_TOKEN_LIFETIME_MINUTES }),
      }, 'sign in');
      return { user: parseUser(body), ...parseTokens(body, now) };
    },
    async refresh(refreshToken: string): Promise<AuthTokens> {
      const body = await request('/auth/refresh', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken, expiresInMins: AUTH_TOKEN_LIFETIME_MINUTES }),
      }, 'refresh your session');
      return parseTokens(body, now);
    },
    async me(accessToken: string): Promise<AuthUser> {
      const body = await request('/auth/me', {
        headers: { Authorization: `Bearer ${accessToken}` },
      }, 'validate your session');
      return parseUser(body);
    },
  };
}

export const authService = createAuthService();
