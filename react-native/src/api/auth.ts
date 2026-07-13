import { api } from '@/api/client';
import type { AuthSession } from '@/types/auth';

export const authApi = {
  async login(email: string, password: string) {
    const response = await api.post<AuthSession>('/auth/login', { email, password });
    return response.data;
  },
  async logout() {
    await api.post('/auth/logout');
  },
};
