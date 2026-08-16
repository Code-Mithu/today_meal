import * as SecureStore from 'expo-secure-store';

const CONFIGURED_API_URL = process.env.EXPO_PUBLIC_API_URL?.replace(/\/$/, '');
const DEVELOPMENT_API_URL = 'http://10.0.2.2:8000';
const ACCESS_KEY = 'today-meal.access-token';
const REFRESH_KEY = 'today-meal.refresh-token';

export class ApiError extends Error {
  constructor(message: string, public readonly status: number) {
    super(message);
    this.name = 'ApiError';
  }
}

function getApiUrl() {
  const apiUrl = CONFIGURED_API_URL ?? (__DEV__ ? DEVELOPMENT_API_URL : undefined);
  if (!apiUrl) {
    throw new ApiError('This build is missing its server address. Please install the latest app build.', 0);
  }
  if (!__DEV__ && !apiUrl.startsWith('https://')) {
    throw new ApiError('The app server must use a secure HTTPS connection.', 0);
  }
  return apiUrl;
}

async function fetchApi(path: string, init: RequestInit) {
  try {
    return await fetch(`${getApiUrl()}${path}`, init);
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError('The server could not be reached. Check your internet connection and try again.', 0);
  }
}

async function request<T>(path: string, init: RequestInit, allowRefresh: boolean): Promise<T> {
  const access = await SecureStore.getItemAsync(ACCESS_KEY);
  const response = await fetchApi(path, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(access ? { Authorization: `Bearer ${access}` } : {}), ...init.headers },
  });
  if (response.status === 401 && allowRefresh && await refreshAccessToken()) return request<T>(path, init, false);
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new ApiError(body.message ?? body.detail ?? 'Request failed', response.status);
  }
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

export async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  return request<T>(path, init, true);
}

export async function saveTokens(access: string, refresh: string) {
  await Promise.all([SecureStore.setItemAsync(ACCESS_KEY, access), SecureStore.setItemAsync(REFRESH_KEY, refresh)]);
}

export async function refreshAccessToken() {
  const refresh = await SecureStore.getItemAsync(REFRESH_KEY);
  if (!refresh) return false;
  try {
    const response = await fetchApi('/api/auth/refresh', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ refresh }) });
    if (!response.ok) return false;
    const tokens = await response.json() as { access: string; refresh?: string };
    await SecureStore.setItemAsync(ACCESS_KEY, tokens.access);
    if (tokens.refresh) await SecureStore.setItemAsync(REFRESH_KEY, tokens.refresh);
    return true;
  } catch { return false; }
}

export async function clearTokens() {
  await Promise.all([SecureStore.deleteItemAsync(ACCESS_KEY), SecureStore.deleteItemAsync(REFRESH_KEY)]);
}
