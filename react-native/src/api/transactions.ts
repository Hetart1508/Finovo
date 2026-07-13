import { api } from '@/api/client';
import type { Transaction } from '@/types/finance';

export const transactionsApi = {
  async list(walletId: number | null) {
    const response = await api.get<Transaction[]>('/transactions', {
      params: { wallet_id: walletId ?? undefined, limit: 10_000, offset: 0 },
    });
    return response.data;
  },
};
