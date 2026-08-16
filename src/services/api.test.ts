import { beforeEach, describe, expect, it, vi } from 'vitest';

const store = new Map<string, string>();

vi.mock('expo-secure-store', () => ({
  getItemAsync: vi.fn(async (key: string) => store.get(key) ?? null),
  setItemAsync: vi.fn(async (key: string, value: string) => { store.set(key, value); }),
  deleteItemAsync: vi.fn(async (key: string) => { store.delete(key); }),
}));

const ACCESS_KEY = 'today-meal.access-token';
const REFRESH_KEY = 'today-meal.refresh-token';

describe('mobile API authentication', () => {
  beforeEach(() => {
    store.clear();
    vi.restoreAllMocks();
    vi.stubGlobal('__DEV__', false);
    process.env.EXPO_PUBLIC_API_URL = 'https://api.example.test';
  });

  it('saves and completely clears a session', async () => {
    const { clearTokens, hasStoredSession, saveTokens } = await import('./api');
    await saveTokens('access-token', 'refresh-token');
    expect(await hasStoredSession()).toBe(true);
    await clearTokens();
    expect(store.size).toBe(0);
    expect(await hasStoredSession()).toBe(false);
  });

  it('refreshes an expired access token and retries the request', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ detail: 'expired' }), { status: 401 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ access: 'new-access', refresh: 'new-refresh' }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ user: { id: '1', name: 'Owner', email: 'owner@example.com' } }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    const { apiFetch, saveTokens } = await import('./api');
    await saveTokens('old-access', 'old-refresh');

    const result = await apiFetch<{ user: { id: string } }>('/api/auth/me');

    expect(result.user.id).toBe('1');
    expect(store.get(ACCESS_KEY)).toBe('new-access');
    expect(store.get(REFRESH_KEY)).toBe('new-refresh');
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('coalesces concurrent refresh requests', async () => {
    let refreshCalls = 0;
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      if (url.endsWith('/api/auth/refresh')) {
        refreshCalls += 1;
        await new Promise((resolve) => setTimeout(resolve, 5));
        return new Response(JSON.stringify({ access: 'new-access' }), { status: 200 });
      }
      const authorization = store.get(ACCESS_KEY);
      return authorization === 'new-access'
        ? new Response(JSON.stringify({ ok: true }), { status: 200 })
        : new Response(JSON.stringify({ detail: 'expired' }), { status: 401 });
    }));
    const { apiFetch, saveTokens } = await import('./api');
    await saveTokens('old-access', 'refresh-token');

    await Promise.all([apiFetch('/api/one'), apiFetch('/api/two')]);

    expect(refreshCalls).toBe(1);
  });

  it('clears stale credentials when refresh is rejected', async () => {
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ detail: 'expired' }), { status: 401 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ detail: 'invalid refresh' }), { status: 401 })));
    const { ApiError, apiFetch, saveTokens } = await import('./api');
    await saveTokens('old-access', 'invalid-refresh');

    await expect(apiFetch('/api/auth/me')).rejects.toBeInstanceOf(ApiError);
    expect(store.size).toBe(0);
  });

  it('clears local credentials when server logout is offline', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Network request failed')));
    const { hasStoredSession, revokeSession, saveTokens } = await import('./api');
    await saveTokens('access-token', 'refresh-token');

    await revokeSession();

    expect(await hasStoredSession()).toBe(false);
    expect(store.size).toBe(0);
  });

  it('reports network failures without deleting a potentially valid offline session', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Network request failed')));
    const { ApiError, apiFetch, saveTokens } = await import('./api');
    await saveTokens('access-token', 'refresh-token');

    await expect(apiFetch('/api/auth/me')).rejects.toMatchObject({ kind: 'network' } satisfies Partial<InstanceType<typeof ApiError>>);
    expect(store.get(REFRESH_KEY)).toBe('refresh-token');
  });

  it('does not attempt token refresh when the device has no session', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ detail: 'Authentication credentials were not provided.' }), { status: 401 }),
    );
    vi.stubGlobal('fetch', fetchMock);
    const { apiFetch } = await import('./api');

    await expect(apiFetch('/api/auth/me')).rejects.toMatchObject({ status: 401, kind: 'authentication' });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('notifies the app when an authenticated session can no longer refresh', async () => {
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ detail: 'expired' }), { status: 401 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ detail: 'invalid refresh' }), { status: 401 })));
    const { apiFetch, saveTokens, setAuthenticationExpiredHandler } = await import('./api');
    const expired = vi.fn();
    const unsubscribe = setAuthenticationExpiredHandler(expired);
    await saveTokens('old-access', 'invalid-refresh');

    await expect(apiFetch('/api/auth/me')).rejects.toMatchObject({ status: 401 });

    expect(expired).toHaveBeenCalledOnce();
    expect(store.size).toBe(0);
    unsubscribe();
  });

  it('rejects malformed login tokens instead of persisting them', async () => {
    const { ApiError, saveTokens } = await import('./api');
    await expect(saveTokens('', 'refresh-token')).rejects.toBeInstanceOf(ApiError);
    expect(store.size).toBe(0);
  });
});
