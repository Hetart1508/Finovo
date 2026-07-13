import { api } from '@/api/client';
import type { Wallet } from '@/types/finance';

export const walletsApi = {
  async list() {
    const response = await api.get<Wallet[]>('/wallets');
    return response.data;
  },
};
