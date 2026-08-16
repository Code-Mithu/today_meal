import React, { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import * as SecureStore from 'expo-secure-store';
import { ApiError, apiFetch, clearTokens, hasStoredSession, revokeSession, saveTokens, setAuthenticationExpiredHandler } from '@/services/api';

type User = { id: string; name: string; email: string };
type AuthContextValue = {
  user: User | null; isLoading: boolean; isOfflineSession: boolean;
  signIn(email: string, password: string): Promise<void>;
  signUp(name: string, email: string, password: string): Promise<void>;
  signOut(): Promise<void>;
};

type AuthResponse = { user: User; access: string; refresh: string };
const USER_KEY = 'today-meal.cached-user';
const AuthContext = createContext<AuthContextValue | null>(null);

function parseCachedUser(value: string | null): User | null {
  if (!value) return null;
  try {
    const candidate = JSON.parse(value) as Partial<User>;
    return typeof candidate.id === 'string' && typeof candidate.name === 'string' && typeof candidate.email === 'string'
      ? candidate as User
      : null;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isOfflineSession, setOfflineSession] = useState(false);
  const authOperation = useRef(0);

  useEffect(() => setAuthenticationExpiredHandler(() => {
    setUser(null);
    setOfflineSession(false);
    void SecureStore.deleteItemAsync(USER_KEY).catch(() => undefined);
  }), []);

  useEffect(() => {
    const operation = ++authOperation.current;
    void (async () => {
      let storedUser: string | null = null;
      try {
        storedUser = await SecureStore.getItemAsync(USER_KEY);
      } catch {
        // A SecureStore failure must not leave the launch screen spinning forever.
      }
      const cachedUser = parseCachedUser(storedUser);
      if (storedUser && !cachedUser) await SecureStore.deleteItemAsync(USER_KEY).catch(() => undefined);

      try {
        const result = await apiFetch<{ user: User }>('/api/auth/me');
        if (!parseCachedUser(JSON.stringify(result.user))) {
          throw new ApiError('The server returned invalid account information.', 200, 'response');
        }
        if (operation !== authOperation.current) return;
        setUser(result.user);
        setOfflineSession(false);
        await SecureStore.setItemAsync(USER_KEY, JSON.stringify(result.user));
      } catch (error) {
        const canUseOfflineSession = error instanceof ApiError
          && (error.kind === 'network' || error.kind === 'timeout')
          && Boolean(cachedUser)
          && await hasStoredSession();
        if (operation !== authOperation.current) return;
        if (canUseOfflineSession) {
          setUser(cachedUser);
          setOfflineSession(true);
        } else {
          await clearTokens();
          await SecureStore.deleteItemAsync(USER_KEY).catch(() => undefined);
          if (operation !== authOperation.current) return;
          setUser(null);
          setOfflineSession(false);
        }
      } finally {
        if (operation === authOperation.current) setIsLoading(false);
      }
    })();
    return () => { authOperation.current += 1; };
  }, []);

  async function authenticate(path: string, body: object) {
    const operation = ++authOperation.current;
    const result = await apiFetch<AuthResponse>(path, { method: 'POST', body: JSON.stringify(body) }, false);
    if (operation !== authOperation.current) return;
    if (!parseCachedUser(JSON.stringify(result.user))) {
      throw new ApiError('The server returned invalid account information.', 200, 'response');
    }
    await saveTokens(result.access, result.refresh);
    try {
      await SecureStore.setItemAsync(USER_KEY, JSON.stringify(result.user));
    } catch {
      await clearTokens();
      throw new ApiError('The secure session could not be saved on this device.', 0, 'response');
    }
    if (operation !== authOperation.current) return;
    setUser(result.user);
    setOfflineSession(false);
  }

  const value = useMemo<AuthContextValue>(() => ({
    user, isLoading, isOfflineSession,
    signIn: (email, password) => authenticate('/api/auth/login', { email, password }),
    signUp: (name, email, password) => authenticate('/api/auth/signup', { name, email, password }),
    signOut: async () => {
      authOperation.current += 1;
      setUser(null);
      setOfflineSession(false);
      await revokeSession();
      await SecureStore.deleteItemAsync(USER_KEY).catch(() => undefined);
    },
  }), [user, isLoading, isOfflineSession]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth must be used within AuthProvider');
  return value;
}
