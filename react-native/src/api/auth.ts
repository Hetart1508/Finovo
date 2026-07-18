import { api } from '@/api/client';
import type { AuthSession } from '@/types/auth';

export type RegistrationDetails = {
  name: string;
  email: string;
  password: string;
};

type MessageResponse = { message?: string };

export const authApi = {
  async login(email: string, password: string) {
    const response = await api.post<AuthSession>('/auth/login', { email, password });
    return response.data;
  },
  async googleLogin(credential: string) {
    const response = await api.post<AuthSession>('/auth/google', { credential });
    return response.data;
  },
  async register(details: RegistrationDetails) {
    const response = await api.post<MessageResponse>('/auth/register', details);
    return response.data;
  },
  async verifyRegistrationOtp(email: string, otp: string) {
    const response = await api.post<AuthSession>('/auth/register/verify-otp', { email, otp });
    return response.data;
  },
  async forgotPassword(email: string) {
    const response = await api.post<MessageResponse>('/auth/forgot-password', { email });
    return response.data;
  },
  async resetPassword(email: string, otp: string, password: string) {
    const response = await api.post<MessageResponse>('/auth/reset-password', { email, otp, password });
    return response.data;
  },
  async logout() {
    await api.post('/auth/logout');
  },
};
