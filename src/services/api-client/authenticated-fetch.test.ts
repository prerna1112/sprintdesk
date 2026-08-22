import { describe, expect, it, vi } from 'vitest';
import type { RefreshTokenStorage } from '../../features/auth/refresh-token-storage';
import type { AuthTokens } from '../../features/auth/types';
import { AuthenticatedFetchError, createAuthenticatedFetch } from './authenticated-fetch';

function setup(options: { expiresAt?: number; fetchImpl?: typeof fetch } = {}) {
  let session: {
    accessToken: string | null;
    accessTokenExpiresAt: number | null;
    sessionGeneration: number;
  } = {
    accessToken: 'old-access' as string | null,
    accessTokenExpiresAt: options.expiresAt ?? 20_000,
    sessionGeneration: 1,
  };
  let storedToken: string | null = 'old-refresh';
  const storage: RefreshTokenStorage = {
    get: vi.fn(() => storedToken),
    set: vi.fn((value) => { storedToken = value; }),
    clear: vi.fn(() => { storedToken = null; }),
  };
  const tokens: AuthTokens = { accessToken: 'new-access', refreshToken: 'new-refresh', accessTokenExpiresAt: 60_000 };
  const refresh = vi.fn(async () => tokens);
  const updateSession = vi.fn((next: AuthTokens) => {
    session = {
      accessToken: next.accessToken,
      accessTokenExpiresAt: next.accessTokenExpiresAt,
      sessionGeneration: session.sessionGeneration,
    };
  });
  const onUnauthorized = vi.fn(() => storage.clear());
  const fetchImpl = options.fetchImpl ?? vi.fn(async () => new Response(null, { status: 200 }));
  const authenticatedFetch = createAuthenticatedFetch({
    fetchImpl, getSession: () => session, refresh, updateSession, storage, onUnauthorized, now: () => 10_000,
  });
  return {
    authenticatedFetch,
    fetchImpl: fetchImpl as ReturnType<typeof vi.fn>,
    refresh,
    storage,
    onUnauthorized,
    tokens,
    replaceSession: (
      accessToken: string | null,
      accessTokenExpiresAt: number | null,
    ) => {
      session = {
        accessToken,
        accessTokenExpiresAt,
        sessionGeneration: session.sessionGeneration + 1,
      };
    },
  };
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

  it('never replays an old request under a replacement session', async () => {
    let resolveInitial!: (response: Response) => void;
    const fetchImpl = vi.fn(() => new Promise<Response>((resolve) => {
      resolveInitial = resolve;
    }));
    const context = setup({ fetchImpl });

    const request = context.authenticatedFetch('https://api.test/items');
    context.replaceSession('replacement-access', 90_000);
    context.storage.set('replacement-refresh');
    resolveInitial(new Response(null, { status: 401 }));

    const error = await request.catch((reason: unknown) => reason);
    expect(error).toBeInstanceOf(AuthenticatedFetchError);
    expect((error as AuthenticatedFetchError).code).toBe('session_changed');
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(context.refresh).not.toHaveBeenCalled();
    expect(context.storage.get()).toBe('replacement-refresh');
    expect(context.onUnauthorized).not.toHaveBeenCalled();
  });

  it('normalizes one shared refresh failure for every concurrent caller', async () => {
    const context = setup({ expiresAt: 14_000 });
    let rejectRefresh!: (reason: unknown) => void;
    context.refresh.mockImplementation(() => new Promise((_resolve, reject) => {
      rejectRefresh = reject;
    }));

    const first = context.authenticatedFetch('https://api.test/one').catch((error: unknown) => error);
    const second = context.authenticatedFetch('https://api.test/two').catch((error: unknown) => error);
    rejectRefresh(new Error('refresh failed'));
    const [firstError, secondError] = await Promise.all([first, second]);

    expect(firstError).toBeInstanceOf(AuthenticatedFetchError);
    expect(secondError).toBe(firstError);
    expect((firstError as AuthenticatedFetchError).code).toBe('session_expired');
    expect(context.refresh).toHaveBeenCalledTimes(1);
    expect(context.onUnauthorized).toHaveBeenCalledTimes(1);
    expect(context.storage.clear).toHaveBeenCalledTimes(1);
  });

  it('normalizes a superseded shared refresh for every joiner without logout side effects', async () => {
    const context = setup({ expiresAt: 14_000 });
    let resolveRefresh!: (tokens: AuthTokens) => void;
    context.refresh.mockImplementation(() => new Promise((resolve) => {
      resolveRefresh = resolve;
    }));

    const first = context.authenticatedFetch('https://api.test/one').catch((error: unknown) => error);
    const second = context.authenticatedFetch('https://api.test/two').catch((error: unknown) => error);
    context.replaceSession('replacement-access', 90_000);
    context.storage.set('replacement-refresh');
    resolveRefresh(context.tokens);
    const [firstError, secondError] = await Promise.all([first, second]);

    expect(firstError).toBeInstanceOf(AuthenticatedFetchError);
    expect(secondError).toBe(firstError);
    expect((firstError as AuthenticatedFetchError).code).toBe('session_changed');
    expect(context.refresh).toHaveBeenCalledTimes(1);
    expect(context.onUnauthorized).not.toHaveBeenCalled();
    expect(context.storage.get()).toBe('replacement-refresh');
  });

  it('rejects an already-aborted caller before proactive refresh', async () => {
    const context = setup({ expiresAt: 14_000 });
    const controller = new AbortController();
    controller.abort();

    const error = await context.authenticatedFetch(
      'https://api.test/items',
      { signal: controller.signal },
    ).catch((reason: unknown) => reason);

    expect(error).toBeInstanceOf(DOMException);
    expect((error as DOMException).name).toBe('AbortError');
    expect(context.refresh).not.toHaveBeenCalled();
    expect(context.fetchImpl).not.toHaveBeenCalled();
  });

  it('lets an aborted proactive-refresh waiter leave while another joiner completes', async () => {
    const context = setup({ expiresAt: 14_000 });
    const controller = new AbortController();
    let resolveRefresh!: (tokens: AuthTokens) => void;
    context.refresh.mockImplementation(() => new Promise((resolve) => {
      resolveRefresh = resolve;
    }));

    const abortedRequest = context.authenticatedFetch(
      'https://api.test/aborted',
      { signal: controller.signal },
    );
    const completingRequest = context.authenticatedFetch('https://api.test/completes');
    expect(context.refresh).toHaveBeenCalledTimes(1);
    controller.abort();

    const abortError = await abortedRequest.catch((reason: unknown) => reason);
    expect((abortError as DOMException).name).toBe('AbortError');
    resolveRefresh(context.tokens);
    await expect(completingRequest).resolves.toHaveProperty('status', 200);
    expect(context.refresh).toHaveBeenCalledTimes(1);
    expect(context.fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('does not retry when aborted while waiting on a reactive refresh', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response(null, { status: 401 }));
    const context = setup({ fetchImpl });
    const controller = new AbortController();
    let resolveRefresh!: (tokens: AuthTokens) => void;
    context.refresh.mockImplementation(() => new Promise((resolve) => {
      resolveRefresh = resolve;
    }));

    const request = context.authenticatedFetch(
      'https://api.test/items',
      { signal: controller.signal },
    );
    await vi.waitFor(() => expect(context.refresh).toHaveBeenCalledTimes(1));
    controller.abort();

    const error = await request.catch((reason: unknown) => reason);
    expect((error as DOMException).name).toBe('AbortError');
    resolveRefresh(context.tokens);
    await vi.waitFor(() => expect(context.storage.set).toHaveBeenCalledWith('new-refresh'));
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('cannot restore a session when logout happens during refresh', async () => {
    const context = setup({ expiresAt: 14_000 });
    let resolveRefresh!: (tokens: AuthTokens) => void;
    context.refresh.mockImplementation(() => new Promise((resolve) => {
      resolveRefresh = resolve;
    }));

    const request = context.authenticatedFetch('https://api.test/items');
    context.replaceSession(null, null);
    context.storage.clear();
    resolveRefresh(context.tokens);

    await expect(request).rejects.toThrow('session changed');
    expect(context.storage.set).not.toHaveBeenCalled();
    expect(context.storage.get()).toBeNull();
    expect(context.onUnauthorized).not.toHaveBeenCalled();
  });

  it('cannot overwrite a new login when an old refresh completes', async () => {
    const context = setup({ expiresAt: 14_000 });
    let resolveRefresh!: (tokens: AuthTokens) => void;
    context.refresh.mockImplementation(() => new Promise((resolve) => {
      resolveRefresh = resolve;
    }));

    const request = context.authenticatedFetch('https://api.test/items');
    context.replaceSession('new-login-access', 90_000);
    context.storage.set('new-login-refresh');
    resolveRefresh(context.tokens);

    await expect(request).rejects.toThrow('session changed');
    expect(context.storage.get()).toBe('new-login-refresh');
    expect(context.storage.set).toHaveBeenCalledTimes(1);
    expect(context.onUnauthorized).not.toHaveBeenCalled();
  });

  it('does not clear a new login when the superseded refresh rejects', async () => {
    const context = setup({ expiresAt: 14_000 });
    let rejectRefresh!: (reason: unknown) => void;
    context.refresh.mockImplementation(() => new Promise((_resolve, reject) => {
      rejectRefresh = reject;
    }));

    const request = context.authenticatedFetch('https://api.test/items');
    context.replaceSession('new-login-access', 90_000);
    context.storage.set('new-login-refresh');
    rejectRefresh(new Error('old request failed'));

    await expect(request).rejects.toThrow('session changed');
    expect(context.storage.get()).toBe('new-login-refresh');
    expect(context.storage.clear).not.toHaveBeenCalled();
    expect(context.onUnauthorized).not.toHaveBeenCalled();
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
