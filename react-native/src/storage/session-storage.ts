import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

import type { AuthSession } from '@/types/auth';

const sessionKey = 'finovo.mobile.session';

const webStorage = {
  get: () => typeof localStorage === 'undefined' ? null : localStorage.getItem(sessionKey),
  set: (value: string) => typeof localStorage === 'undefined' ? undefined : localStorage.setItem(sessionKey, value),
  remove: () => typeof localStorage === 'undefined' ? undefined : localStorage.removeItem(sessionKey),
};

export const sessionStorage = {
  async get(): Promise<AuthSession | null> {
    const raw = Platform.OS === 'web' ? webStorage.get() : await SecureStore.getItemAsync(sessionKey);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as AuthSession;
    } catch {
      await sessionStorage.clear();
      return null;
    }
  },

  async save(session: AuthSession) {
    const raw = JSON.stringify(session);
    if (Platform.OS === 'web') webStorage.set(raw);
    else await SecureStore.setItemAsync(sessionKey, raw);
  },

  async clear() {
    if (Platform.OS === 'web') webStorage.remove();
    else await SecureStore.deleteItemAsync(sessionKey);
  },

  async getAccessToken() {
    return (await sessionStorage.get())?.accessToken ?? null;
  },
};
