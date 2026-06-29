import api from '@/src/lib/api';
import type { Investment, InvestmentSummary } from '@/src/types/investment';
import { getData } from './http';

export type InvestmentPayload = Record<string, unknown>;

export const investmentsApi = {
  list: () => getData<Investment[]>(api.get('/investments')),
  summary: () => getData<InvestmentSummary>(api.get('/investments/summary')),
  save: (id: number | undefined, payload: InvestmentPayload) =>
    id ? api.put(`/investments/${id}`, payload) : api.post('/investments', payload),
  delete: (id: number) => api.delete(`/investments/${id}`),
};
