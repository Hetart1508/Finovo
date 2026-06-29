import { storageKeys } from './storageKeys';

const decodeJwtPayload = (token: string) => {
  try {
    const payload = token.split('.')[1];
    if (!payload) return null;

    const base64 = payload.replace(/-/g, '+').replace(/_/g, '/');
    const json = window.atob(base64.padEnd(base64.length + ((4 - base64.length % 4) % 4), '='));
    return JSON.parse(json);
  } catch {
    return null;
  }
};

export const getSessionExpiresAt = () => {
  const storedExpiresAt = Number(localStorage.getItem(storageKeys.sessionExpiresAt));
  if (Number.isFinite(storedExpiresAt) && storedExpiresAt > 0) {
    return storedExpiresAt;
  }

  const token = localStorage.getItem(storageKeys.token);
  if (!token) return null;

  const payload = decodeJwtPayload(token);
  return typeof payload?.exp === 'number' ? payload.exp * 1000 : null;
};

export const isSessionExpired = () => {
  const expiresAt = getSessionExpiresAt();
  return Boolean(expiresAt && expiresAt <= Date.now());
};

export const hasValidSession = () => {
  const token = localStorage.getItem(storageKeys.token);
  const user = localStorage.getItem(storageKeys.user);
  const expiresAt = getSessionExpiresAt();

  if (!token || !user || !expiresAt || expiresAt <= Date.now()) {
    return false;
  }

  try {
    JSON.parse(user);
    return true;
  } catch {
    return false;
  }
};

export const saveSession = (token: string, user: unknown, expiresAt?: number) => {
  localStorage.setItem(storageKeys.token, token);
  localStorage.setItem(storageKeys.user, JSON.stringify(user));

  if (expiresAt) {
    localStorage.setItem(storageKeys.sessionExpiresAt, String(expiresAt));
    return;
  }

  const payload = decodeJwtPayload(token);
  if (typeof payload?.exp === 'number') {
    localStorage.setItem(storageKeys.sessionExpiresAt, String(payload.exp * 1000));
  }
};

export const clearSession = () => {
  localStorage.removeItem(storageKeys.token);
  localStorage.removeItem(storageKeys.user);
  localStorage.removeItem(storageKeys.sessionExpiresAt);
};
