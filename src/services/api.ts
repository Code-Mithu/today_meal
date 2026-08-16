import * as SecureStore from 'expo-secure-store';

const CONFIGURED_API_URL = process.env.EXPO_PUBLIC_API_URL?.trim().replace(/\/+$/, '');
const DEVELOPMENT_API_URL = 'http://10.0.2.2:8000';
const REQUEST_TIMEOUT_MS = 15_000;
const ACCESS_KEY = 'today-meal.access-token';
const REFRESH_KEY = 'today-meal.refresh-token';

type ApiErrorKind = 'configuration' | 'network' | 'timeout' | 'authentication' | 'server' | 'response';

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly kind: ApiErrorKind,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

function getApiUrl() {
  const apiUrl = CONFIGURED_API_URL ?? (__DEV__ ? DEVELOPMENT_API_URL : undefined);
  if (!apiUrl) {
    throw new ApiError('This build is missing its server address. Please install the latest app build.', 0, 'configuration');
  }
  if (!/^https?:\/\//i.test(apiUrl)) {
    throw new ApiError('The configured app server address is invalid.', 0, 'configuration');
  }
  if (!__DEV__ && !apiUrl.startsWith('https://')) {
    throw new ApiError('The app server must use a secure HTTPS connection.', 0, 'configuration');
  }
  return apiUrl;
}

async function fetchApi(path: string, init: RequestInit) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    return await fetch(`${getApiUrl()}${path}`, { ...init, signal: controller.signal });
  } catch (error) {
    if (error instanceof ApiError) throw error;
    if (error instanceof Error && error.name === 'AbortError') {
      throw new ApiError('The server took too long to respond. Please try again.', 0, 'timeout');
    }
    throw new ApiError('The server could not be reached. Check your internet connection and try again.', 0, 'network');
  } finally {
    clearTimeout(timeout);
  }
}

async function errorFromResponse(response: Response) {
  const body = await response.json().catch(() => null) as { message?: string; detail?: string } | null;
  const fallback = response.status >= 500
    ? 'The server is temporarily unavailable. Please try again.'
    : 'The request could not be completed.';
  const kind: ApiErrorKind = response.status === 401 ? 'authentication' : response.status >= 500 ? 'server' : 'response';
  return new ApiError(body?.message ?? body?.detail ?? fallback, response.status, kind);
}

async function parseResponse<T>(response: Response): Promise<T> {
  if (response.status === 204) return undefined as T;
  try {
    return await response.json() as T;
  } catch {
    throw new ApiError('The server returned an unreadable response. Please try again.', response.status, 'response');
  }
}

async function request<T>(path: string, init: RequestInit, allowRefresh: boolean): Promise<T> {
  const access = await SecureStore.getItemAsync(ACCESS_KEY);
  const response = await fetchApi(path, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(access ? { Authorization: `Bearer ${access}` } : {}), ...init.headers },
  });
  if (response.status === 401 && allowRefresh) {
    if (await refreshAccessToken()) return request<T>(path, init, false);
    await clearTokens();
  }
  if (!response.ok) throw await errorFromResponse(response);
  return parseResponse<T>(response);
}

export async function apiFetch<T>(path: string, init: RequestInit = {}, allowRefresh = true): Promise<T> {
  return request<T>(path, init, allowRefresh);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

let credentialVersion = 0;
let refreshPromise: Promise<boolean> | null = null;

export async function saveTokens(access: string, refresh: string) {
  if (!isNonEmptyString(access) || !isNonEmptyString(refresh)) {
    throw new ApiError('The server returned an invalid session. Please sign in again.', 0, 'response');
  }

  const versionAtStart = ++credentialVersion;
  try {
    await Promise.all([
      SecureStore.setItemAsync(ACCESS_KEY, access),
      SecureStore.setItemAsync(REFRESH_KEY, refresh),
    ]);
    if (credentialVersion !== versionAtStart) {
      await clearTokens();
      throw new ApiError('The sign-in attempt was cancelled.', 0, 'authentication');
    }
  } catch (error) {
    await clearTokens();
    if (error instanceof ApiError) throw error;
    throw new ApiError('The secure session could not be saved on this device.', 0, 'response');
  }
}

export async function hasStoredSession() {
  try {
    return isNonEmptyString(await SecureStore.getItemAsync(REFRESH_KEY));
  } catch {
    return false;
  }
}

async function performTokenRefresh(versionAtStart: number) {
  let refresh: string | null;
  try {
    refresh = await SecureStore.getItemAsync(REFRESH_KEY);
  } catch {
    await clearTokens();
    return false;
  }
  if (!isNonEmptyString(refresh)) return false;

  const response = await fetchApi('/api/auth/refresh', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refresh }),
  });
  if (!response.ok) {
    if (response.status === 400 || response.status === 401) await clearTokens();
    return false;
  }

  const tokens = await parseResponse<{ access?: unknown; refresh?: unknown }>(response);
  if (!isNonEmptyString(tokens.access)) {
    await clearTokens();
    throw new ApiError('The server returned an invalid session. Please sign in again.', response.status, 'response');
  }

  // A logout or newer login happened while this request was in flight.
  if (credentialVersion !== versionAtStart) return false;

  try {
    await SecureStore.setItemAsync(ACCESS_KEY, tokens.access);
    if (isNonEmptyString(tokens.refresh)) await SecureStore.setItemAsync(REFRESH_KEY, tokens.refresh);
  } catch {
    await clearTokens();
    return false;
  }
  return true;
}

export async function refreshAccessToken() {
  if (!refreshPromise) {
    const versionAtStart = credentialVersion;
    refreshPromise = performTokenRefresh(versionAtStart).finally(() => { refreshPromise = null; });
  }
  return refreshPromise;
}

export async function clearTokens() {
  credentialVersion += 1;
  await Promise.allSettled([
    SecureStore.deleteItemAsync(ACCESS_KEY),
    SecureStore.deleteItemAsync(REFRESH_KEY),
  ]);
}

export async function revokeSession() {
  credentialVersion += 1;
  let refresh: string | null = null;
  try {
    refresh = await SecureStore.getItemAsync(REFRESH_KEY);
    if (isNonEmptyString(refresh)) {
      await fetchApi('/api/auth/logout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh }),
      });
    }
  } catch {
    // Local logout must succeed even when the device or server is offline.
  } finally {
    await clearTokens();
  }
}
