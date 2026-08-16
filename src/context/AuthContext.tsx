import React, { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import * as SecureStore from 'expo-secure-store';
import { apiFetch, clearTokens, saveTokens } from '@/services/api';

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

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isOfflineSession, setOfflineSession] = useState(false);

  useEffect(() => {
    void (async () => {
      const cached = await SecureStore.getItemAsync(USER_KEY);
      if (cached) { setUser(JSON.parse(cached)); setOfflineSession(true); }
      try {
        const result = await apiFetch<{ user: User }>('/api/auth/me');
        setUser(result.user); setOfflineSession(false);
        await SecureStore.setItemAsync(USER_KEY, JSON.stringify(result.user));
      } catch { setOfflineSession(Boolean(cached)); }
      finally { setIsLoading(false); }
    })();
  }, []);

  async function authenticate(path: string, body: object) {
    const result = await apiFetch<AuthResponse>(path, { method: 'POST', body: JSON.stringify(body) });
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
