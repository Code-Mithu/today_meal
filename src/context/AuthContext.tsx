import React, { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import * as SecureStore from 'expo-secure-store';
import { apiFetch, clearSessionCookie } from '@/services/api';

type User = { id: string; name: string; email: string };
type AuthContextValue = {
  user: User | null;
  isLoading: boolean;
  isOfflineSession: boolean;
  signIn(email: string, password: string): Promise<void>;
  signUp(name: string, email: string, password: string): Promise<void>;
  signOut(): Promise<void>;
};

const USER_KEY = 'today-meal.cached-user';
const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isOfflineSession, setOfflineSession] = useState(false);

  useEffect(() => {
    void (async () => {
      const cached = await SecureStore.getItemAsync(USER_KEY);
      if (cached) setUser(JSON.parse(cached));
      try {
        const result = await apiFetch<{ user: User | null }>('/api/auth/get-session');
        if (result.user) {
          setUser(result.user);
          setOfflineSession(false);
          await SecureStore.setItemAsync(USER_KEY, JSON.stringify(result.user));
        } else if (!cached) setUser(null);
      } catch {
        setOfflineSession(Boolean(cached));
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  async function authenticate(path: string, body: object) {
    const result = await apiFetch<{ user: User }>(path, { method: 'POST', body: JSON.stringify(body) });
    setUser(result.user);
    setOfflineSession(false);
    await SecureStore.setItemAsync(USER_KEY, JSON.stringify(result.user));
  }

  const value = useMemo<AuthContextValue>(() => ({
    user,
    isLoading,
    isOfflineSession,
    signIn: (email, password) => authenticate('/api/auth/sign-in/email', { email, password }),
    signUp: (name, email, password) => authenticate('/api/auth/sign-up/email', { name, email, password }),
    signOut: async () => {
      try { await apiFetch('/api/auth/sign-out', { method: 'POST', body: '{}' }); } catch { /* Clear locally regardless. */ }
      await clearSessionCookie();
      await SecureStore.deleteItemAsync(USER_KEY);
      setUser(null);
      setOfflineSession(false);
    },
  }), [user, isLoading, isOfflineSession]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth must be used within AuthProvider');
  return value;
}
