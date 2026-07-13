import axios from 'axios';
import { clearSession } from './session';
import { storageKeys } from './storageKeys';

export const apiBaseUrl = import.meta.env.VITE_API_URL
  ? `${import.meta.env.VITE_API_URL.replace(/\/$/, '')}/api`
  : '/api';

const api = axios.create({
  baseURL: apiBaseUrl,
  withCredentials: true,
});

api.interceptors.request.use((config) => {
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error.response?.status;
    const hasSession = Boolean(localStorage.getItem(storageKeys.user));

    if (status === 401 && hasSession) {
      clearSession();
      window.dispatchEvent(new Event('session-expired'));
    }

    return Promise.reject(error);
  }
);

export default api;
