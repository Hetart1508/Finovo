import axios from 'axios';
import { clearSession, hasValidSession } from './session';

export const apiBaseUrl = import.meta.env.VITE_API_URL
  ? `${import.meta.env.VITE_API_URL.replace(/\/$/, '')}/api`
  : '/api';

const api = axios.create({
  baseURL: apiBaseUrl,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token && hasValidSession()) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error.response?.status;
    const hasSession = Boolean(localStorage.getItem('token'));

    if ((status === 401 || status === 403) && hasSession) {
      clearSession();
      window.dispatchEvent(new Event('session-expired'));
    }

    return Promise.reject(error);
  }
);

export default api;
