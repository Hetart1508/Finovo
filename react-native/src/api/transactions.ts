import { api } from '@/api/client';
import type { Transaction, TransactionDraft } from '@/types/finance';

export type CreateTransactionPayload = TransactionDraft & {
  wallet_id: number | null;
  idempotency_key: string;
  source_type: 'manual' | 'single_line';
  allowPossibleDuplicate?: boolean;
};

export type ExtractedTransaction = Partial<TransactionDraft>;

type MessageResponse = { message?: string };

export const transactionsApi = {
  async list(walletId: number | null) {
    const response = await api.get<Transaction[]>('/transactions', {
      params: { wallet_id: walletId ?? undefined, limit: 10_000, offset: 0 },
    });
    return response.data;
  },
  async create(payload: CreateTransactionPayload) {
    const response = await api.post<Transaction & MessageResponse>('/transactions', payload);
    return response.data;
  },
  async extract(description: string) {
    const response = await api.post<{ transaction: ExtractedTransaction }>('/transactions/extract', { description });
    return response.data.transaction;
  },
  async update(id: number, payload: TransactionDraft) {
    const response = await api.put<Transaction & MessageResponse>(`/transactions/${id}`, payload);
    return response.data;
  },
  async delete(id: number) {
    const response = await api.delete<MessageResponse & { id: number }>(`/transactions/${id}`);
    return response.data;
  },
};
