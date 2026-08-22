import { describe, expect, it, vi } from 'vitest';
import type { RefreshTokenStorage } from '../../features/auth/refresh-token-storage';
import type { AuthTokens } from '../../features/auth/types';
import { AuthenticatedFetchError, createAuthenticatedFetch } from './authenticated-fetch';

function setup(options: { expiresAt?: number; fetchImpl?: typeof fetch } = {}) {
  let session = { accessToken: 'old-access' as string | null, accessTokenExpiresAt: options.expiresAt ?? 20_000 };
  let storedToken: string | null = 'old-refresh';
  const storage: RefreshTokenStorage = {
    get: vi.fn(() => storedToken),
    set: vi.fn((value) => { storedToken = value; }),
    clear: vi.fn(() => { storedToken = null; }),
  };
  const tokens: AuthTokens = { accessToken: 'new-access', refreshToken: 'new-refresh', accessTokenExpiresAt: 60_000 };
  const refresh = vi.fn(async () => tokens);
  const updateSession = vi.fn((next: AuthTokens) => {
    session = { accessToken: next.accessToken, accessTokenExpiresAt: next.accessTokenExpiresAt };
  });
  const onUnauthorized = vi.fn();
  const fetchImpl = options.fetchImpl ?? vi.fn(async () => new Response(null, { status: 200 }));
  const authenticatedFetch = createAuthenticatedFetch({
    fetchImpl, getSession: () => session, refresh, updateSession, storage, onUnauthorized, now: () => 10_000,
  });
  return { authenticatedFetch, fetchImpl: fetchImpl as ReturnType<typeof vi.fn>, refresh, storage, onUnauthorized, tokens };
}

describe('authenticatedFetch', () => {
  it('attaches bearer auth and preserves request options without mutating them', async () => {
    const { authenticatedFetch, fetchImpl } = setup();
    const controller = new AbortController();
    const init: RequestInit = {
      method: 'POST', body: JSON.stringify({ value: 1 }), signal: controller.signal,
      headers: { 'X-Request-ID': 'request-1' },
    };
    await authenticatedFetch('https://api.test/items', init);

    const request = fetchImpl.mock.calls[0]?.[0] as Request;
    expect(request.method).toBe('POST');
    expect(request.headers.get('X-Request-ID')).toBe('request-1');
    expect(request.headers.get('Authorization')).toBe('Bearer old-access');
    controller.abort();
    expect(request.signal.aborted).toBe(true);
    await expect(request.clone().text()).resolves.toBe('{"value":1}');
    expect(init.headers).toEqual({ 'X-Request-ID': 'request-1' });
  });

  it('proactively refreshes an expiring token', async () => {
    const { authenticatedFetch, fetchImpl, refresh } = setup({ expiresAt: 14_000 });
    await authenticatedFetch('https://api.test/items');
    expect(refresh).toHaveBeenCalledWith('old-refresh');
    const request = fetchImpl.mock.calls[0]?.[0] as Request;
    expect(request.headers.get('Authorization')).toBe('Bearer new-access');
  });

  it('refreshes reactively on 401, retries once, and does not loop', async () => {
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce(new Response(null, { status: 401 }))
      .mockResolvedValueOnce(new Response(null, { status: 401 }));
    const { authenticatedFetch, refresh } = setup({ fetchImpl });
    const response = await authenticatedFetch('https://api.test/items');
    expect(response.status).toBe(401);
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect((fetchImpl.mock.calls[1]?.[0] as Request).headers.get('Authorization')).toBe('Bearer new-access');
  });

  it('shares one refresh across concurrent 401 responses', async () => {
    const fetchImpl = vi.fn(async (request: RequestInfo | URL) => {
      const token = (request as Request).headers.get('Authorization');
      return new Response(null, { status: token === 'Bearer old-access' ? 401 : 200 });
    });
    const { authenticatedFetch, refresh } = setup({ fetchImpl });
    const [first, second] = await Promise.all([
      authenticatedFetch('https://api.test/one'),
      authenticatedFetch('https://api.test/two'),
    ]);
    expect([first.status, second.status]).toEqual([200, 200]);
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it('clears and reports unauthorized when refresh fails', async () => {
    const context = setup({ expiresAt: 14_000 });
    context.refresh.mockRejectedValue(new Error('invalid refresh'));
    await expect(context.authenticatedFetch('https://api.test/items')).rejects.toBeInstanceOf(AuthenticatedFetchError);
    expect(context.storage.clear).toHaveBeenCalledTimes(1);
    expect(context.onUnauthorized).toHaveBeenCalledTimes(1);
    expect(context.fetchImpl).not.toHaveBeenCalled();
  });

  it('rejects unsupported non-replayable bodies before sending', async () => {
    const { authenticatedFetch, fetchImpl } = setup();
    const body = new ReadableStream();
    await expect(authenticatedFetch('https://api.test/items', { method: 'POST', body })).rejects.toThrow('Streaming request bodies');
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});
