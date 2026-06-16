const TOKEN_KEY = 'token';
const USER_KEY = 'user';
const SESSION_EXPIRES_AT_KEY = 'sessionExpiresAt';

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
  const storedExpiresAt = Number(localStorage.getItem(SESSION_EXPIRES_AT_KEY));
  if (Number.isFinite(storedExpiresAt) && storedExpiresAt > 0) {
    return storedExpiresAt;
  }

  const token = localStorage.getItem(TOKEN_KEY);
  if (!token) return null;

  const payload = decodeJwtPayload(token);
  return typeof payload?.exp === 'number' ? payload.exp * 1000 : null;
};

export const isSessionExpired = () => {
  const expiresAt = getSessionExpiresAt();
  return Boolean(expiresAt && expiresAt <= Date.now());
};

export const saveSession = (token: string, user: unknown, expiresAt?: number) => {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));

  if (expiresAt) {
    localStorage.setItem(SESSION_EXPIRES_AT_KEY, String(expiresAt));
    return;
  }

  const payload = decodeJwtPayload(token);
  if (typeof payload?.exp === 'number') {
    localStorage.setItem(SESSION_EXPIRES_AT_KEY, String(payload.exp * 1000));
  }
};

export const clearSession = () => {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
  localStorage.removeItem(SESSION_EXPIRES_AT_KEY);
};
