import api from '@/src/lib/api';
import type { AuthSession } from '@/src/types/auth';

export const authApi = {
  googleLogin: (credential: string) => api.post<AuthSession>('/auth/google', { credential }),
  register: (payload: unknown) => api.post('/auth/register', payload),
  verifyRegistrationOtp: (email: string, otp: string) =>
    api.post<AuthSession>('/auth/register/verify-otp', { email, otp }),
  login: (payload: unknown) => api.post<AuthSession>('/auth/login', payload),
  forgotPassword: (email: string) => api.post('/auth/forgot-password', { email }),
  resetPassword: (email: string, otp: string, password: string) =>
    api.post('/auth/reset-password', { email, otp, password }),
};
