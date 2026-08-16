import * as SecureStore from 'expo-secure-store';

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:4000';
const COOKIE_KEY = 'today-meal.session-cookie';

export async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const cookie = await SecureStore.getItemAsync(COOKIE_KEY);
  const response = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(cookie ? { Cookie: cookie } : {}),
      ...init.headers,
    },
  });
  const setCookie = response.headers.get('set-cookie');
  if (setCookie) await SecureStore.setItemAsync(COOKIE_KEY, setCookie.split(';')[0]);
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.error ?? body.message ?? 'Request failed');
  }
  return response.json() as Promise<T>;
}

export async function clearSessionCookie() {
  await SecureStore.deleteItemAsync(COOKIE_KEY);
}
