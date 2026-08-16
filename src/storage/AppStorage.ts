import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * AppStorage — wraps AsyncStorage for non-sensitive app state
 * (active group, preferences, last sync time, biometric setting).
 * Sensitive tokens go in SecureStorage, NOT here.
 */

const KEY_PREFIX = 'todaymeal_';

function withPrefix(key: string): string {
  return `${KEY_PREFIX}${key}`;
}

export const AppStorage = {
  async getItem(key: string): Promise<string | null> {
    try {
      return await AsyncStorage.getItem(withPrefix(key));
    } catch {
      return null;
    }
  },

  async setItem(key: string, value: string): Promise<void> {
    try {
      await AsyncStorage.setItem(withPrefix(key), value);
    } catch (e) {
      console.warn('AsyncStorage setItem failed:', e);
    }
  },

  async removeItem(key: string): Promise<void> {
    try {
      await AsyncStorage.removeItem(withPrefix(key));
    } catch {
      // ignore
    }
  },

  async getJSON<T>(key: string): Promise<T | null> {
    const raw = await this.getItem(key);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as T;
    } catch {
      return null;
    }
  },

  async setJSON(key: string, value: any): Promise<void> {
    await this.setItem(key, JSON.stringify(value));
  },

  async multiRemove(keys: string[]): Promise<void> {
    try {
      await AsyncStorage.multiRemove(keys.map((k) => withPrefix(k)));
    } catch {
      // ignore
    }
  },

  async clearAll(): Promise<void> {
    try {
      const keys = await AsyncStorage.getAllKeys();
      const appKeys = keys.filter((k) => k.startsWith(KEY_PREFIX));
      await AsyncStorage.multiRemove(appKeys);
    } catch (e) {
      console.warn('AsyncStorage clearAll failed:', e);
    }
  },
};

// Storage keys
export const STORAGE_KEYS = {
  ACTIVE_GROUP_ID: 'active_group_id',
  USER_DATA: 'user_data',
  LAST_SYNC_TIME: 'last_sync_time',
  PUSH_TOKEN: 'push_token',
  GUEST_TOKENS: 'guest_tokens', // array of GuestTokenEntry (non-sensitive metadata)
  ONBOARDING_COMPLETE: 'onboarding_complete',
} as const;
