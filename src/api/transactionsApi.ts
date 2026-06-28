import api from '@/src/lib/api';
import { getData } from './http';

export type TransactionPayload = Record<string, unknown>;

export const transactionsApi = {
  list: (params?: { limit?: number; offset?: number }) =>
    getData<any[]>(api.get('/transactions', { params })),
  create: (payload: TransactionPayload) => api.post('/transactions', payload),
  update: (id: number, payload: TransactionPayload) => api.put(`/transactions/${id}`, payload),
  delete: (id: number) => api.delete(`/transactions/${id}`),
};
