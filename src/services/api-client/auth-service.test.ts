import { describe, expect, it, vi } from 'vitest';
import { AUTH_TOKEN_LIFETIME_MINUTES, createAuthService, getJwtExpiry } from './auth-service';

const userResponse = {
  id: 1,
  username: 'emilys',
  email: 'emily@example.com',
  firstName: 'Emily',
  lastName: 'Johnson',
  image: 'avatar.png',
};

describe('auth service', () => {
  it('decodes JWT expiry only as timing metadata and tolerates malformed tokens', () => {
    const token = `header.${btoa(JSON.stringify({ exp: 123 }))}.signature`;
    expect(getJwtExpiry(token)).toBe(123_000);
    expect(getJwtExpiry('not-a-jwt')).toBeNull();
    expect(getJwtExpiry('header.%%%invalid.signature')).toBeNull();
  });

  it('maps login responses and requests a short-lived token', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      ...userResponse, accessToken: 'malformed', refreshToken: 'refresh',
    }), { status: 200, headers: { 'Content-Type': 'application/json' } }));
    const service = createAuthService({ fetchImpl, baseUrl: 'https://api.test', now: () => 1_000 });

    const result = await service.login('emilys', 'password');
    expect(result).toMatchObject({
      user: { ...userResponse, id: '1' },
      accessToken: 'malformed',
      refreshToken: 'refresh',
      accessTokenExpiresAt: 61_000,
    });
    expect(result.user).toEqual({ ...userResponse, id: '1' });
    expect(fetchImpl).toHaveBeenCalledWith('https://api.test/auth/login', expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({ username: 'emilys', password: 'password', expiresInMins: AUTH_TOKEN_LIFETIME_MINUTES }),
    }));
  });

  it('maps API, non-JSON, network, and invalid success responses to typed errors', async () => {
    const api = createAuthService({ fetchImpl: vi.fn().mockResolvedValue(new Response(
      JSON.stringify({ message: 'Invalid credentials' }), { status: 400 },
    )) });
    await expect(api.login('bad', 'bad')).rejects.toMatchObject({
      code: 'invalid_credentials', status: 400, message: 'Invalid credentials',
    });

    const nonJson = createAuthService({ fetchImpl: vi.fn().mockResolvedValue(new Response('gateway down', { status: 502 })) });
    await expect(nonJson.refresh('token')).rejects.toMatchObject({ code: 'server', status: 502 });

    const network = createAuthService({ fetchImpl: vi.fn().mockRejectedValue(new TypeError('offline')) });
    await expect(network.me('token')).rejects.toMatchObject({ code: 'network' });

    const invalid = createAuthService({ fetchImpl: vi.fn().mockResolvedValue(new Response('{}', { status: 200 })) });
    await expect(invalid.me('token')).rejects.toMatchObject({ code: 'invalid_response' });
  });

  it('uses an explicit bearer token for the current-user request', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response(JSON.stringify(userResponse), { status: 200 }));
    const service = createAuthService({ fetchImpl });
    await service.me('access-token');
    expect(fetchImpl).toHaveBeenCalledWith(expect.stringContaining('/auth/me'), expect.objectContaining({
      headers: { Authorization: 'Bearer access-token' },
    }));
  });
});
