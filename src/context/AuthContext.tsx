import React, { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import * as SecureStore from 'expo-secure-store';
import { ApiError, apiFetch, clearTokens, saveTokens } from '@/services/api';

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

  useEffect(() => {
    void (async () => {
      const storedUser = await SecureStore.getItemAsync(USER_KEY);
      const cachedUser = parseCachedUser(storedUser);
      if (storedUser && !cachedUser) await SecureStore.deleteItemAsync(USER_KEY);

      try {
        const result = await apiFetch<{ user: User }>('/api/auth/me');
        setUser(result.user);
        setOfflineSession(false);
        await SecureStore.setItemAsync(USER_KEY, JSON.stringify(result.user));
      } catch (error) {
        const canUseOfflineSession = error instanceof ApiError
          && (error.kind === 'network' || error.kind === 'timeout')
          && Boolean(cachedUser);
        if (canUseOfflineSession) {
          setUser(cachedUser);
          setOfflineSession(true);
        } else {
          await clearTokens();
          await SecureStore.deleteItemAsync(USER_KEY);
          setUser(null);
          setOfflineSession(false);
        }
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  async function authenticate(path: string, body: object) {
    const result = await apiFetch<AuthResponse>(path, { method: 'POST', body: JSON.stringify(body) }, false);
    await saveTokens(result.access, result.refresh);
    await SecureStore.setItemAsync(USER_KEY, JSON.stringify(result.user));
    setUser(result.user); setOfflineSession(false);
  }

  const value = useMemo<AuthContextValue>(() => ({
    user, isLoading, isOfflineSession,
    signIn: (email, password) => authenticate('/api/auth/login', { email, password }),
    signUp: (name, email, password) => authenticate('/api/auth/signup', { name, email, password }),
    signOut: async () => { await clearTokens(); await SecureStore.deleteItemAsync(USER_KEY); setUser(null); setOfflineSession(false); },
  }), [user, isLoading, isOfflineSession]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth must be used within AuthProvider');
  return value;
}
