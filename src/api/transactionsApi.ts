import api from '@/src/lib/api';
import type { Transaction } from '@/src/types/transaction';
import { getData } from './http';

export type TransactionPayload = Record<string, unknown>;
export type ExtractedTransaction = Omit<Transaction, 'id' | 'bill_url' | 'merchant_name' | 'payee_vpa'>;

export const transactionsApi = {
  list: (params?: { limit?: number; offset?: number; wallet_id?: number }) =>
    getData<Transaction[]>(api.get('/transactions', { params })),
  create: (payload: TransactionPayload) => api.post('/transactions', payload),
  extract: (description: string) =>
    getData<{ transaction: ExtractedTransaction }>(api.post('/transactions/extract', { description })),
  update: (id: number, payload: TransactionPayload) => api.put(`/transactions/${id}`, payload),
  delete: (id: number) => api.delete(`/transactions/${id}`),
};
