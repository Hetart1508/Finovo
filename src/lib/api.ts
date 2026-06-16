import axios from 'axios';
import { clearSession, hasValidSession } from './session';

const api = axios.create({
  baseURL: '/api',
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
