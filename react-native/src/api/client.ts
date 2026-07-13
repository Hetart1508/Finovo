import axios from 'axios';
import { Platform } from 'react-native';

import { sessionStorage } from '@/storage/session-storage';

const platformOrigin = Platform.select({
  android: process.env.EXPO_PUBLIC_API_URL_ANDROID,
  ios: process.env.EXPO_PUBLIC_API_URL_IOS,
});
const origin = (
  process.env.EXPO_PUBLIC_API_URL
  || platformOrigin
  || 'http://localhost:3000'
).replace(/\/$/, '');
export const apiBaseUrl = `${origin}/api`;

export const api = axios.create({
  baseURL: apiBaseUrl,
  timeout: 30_000,
  withCredentials: true,
  headers: { Accept: 'application/json' },
});

let onUnauthorized: (() => void) | undefined;

export const registerUnauthorizedHandler = (handler: () => void) => {
  onUnauthorized = handler;
  return () => {
    if (onUnauthorized === handler) onUnauthorized = undefined;
  };
};

api.interceptors.request.use(async (config) => {
  const token = await sessionStorage.getAccessToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const status = error?.response?.status;
    const isAuthRequest = String(error?.config?.url || '').startsWith('/auth/');
    if ((status === 401 || status === 403) && !isAuthRequest) onUnauthorized?.();
    return Promise.reject(error);
  },
);
