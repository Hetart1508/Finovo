import { apiBaseUrl } from '@/src/lib/api';

export const isAppleMobileDevice = () => {
  const userAgent = navigator.userAgent || '';
  const platform = navigator.platform || '';
  return /iPhone|iPad|iPod/.test(userAgent) || (platform === 'MacIntel' && navigator.maxTouchPoints > 1);
};

export const getGoogleRedirectLoginUri = () => {
  const redirectPath = `${apiBaseUrl.replace(/\/$/, '')}/auth/google/redirect`;
  return new URL(redirectPath, window.location.origin).toString();
};

export const decodeGoogleRedirectPayload = (payload: string) => {
  const normalizedPayload = payload.replace(/-/g, '+').replace(/_/g, '/');
  const paddedPayload = normalizedPayload.padEnd(normalizedPayload.length + ((4 - normalizedPayload.length % 4) % 4), '=');
  const bytes = Uint8Array.from(atob(paddedPayload), (character) => character.charCodeAt(0));
  return JSON.parse(new TextDecoder().decode(bytes));
};
