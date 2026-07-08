import { storageKeys } from './storageKeys';

export const getSessionExpiresAt = () => {
  const storedExpiresAt = Number(localStorage.getItem(storageKeys.sessionExpiresAt));
  if (Number.isFinite(storedExpiresAt) && storedExpiresAt > 0) {
    return storedExpiresAt;
  }

  return null;
};

export const isSessionExpired = () => {
  const expiresAt = getSessionExpiresAt();
  return Boolean(expiresAt && expiresAt <= Date.now());
};

export const hasValidSession = () => {
  const user = localStorage.getItem(storageKeys.user);
  const expiresAt = getSessionExpiresAt();

  if (!user || !expiresAt || expiresAt <= Date.now()) {
    return false;
  }

  try {
    JSON.parse(user);
    return true;
  } catch {
    return false;
  }
};

export const saveSession = (user: unknown, expiresAt?: number | null) => {
  localStorage.setItem(storageKeys.user, JSON.stringify(user));

  if (expiresAt) {
    localStorage.setItem(storageKeys.sessionExpiresAt, String(expiresAt));
  }
};

export const clearSession = () => {
  localStorage.removeItem(storageKeys.user);
  localStorage.removeItem(storageKeys.sessionExpiresAt);
  localStorage.removeItem(storageKeys.selectedWalletId);
};
