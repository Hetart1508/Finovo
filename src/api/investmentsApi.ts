import api from '@/src/lib/api';
import { getData } from './http';

export type InvestmentPayload = Record<string, unknown>;

export const investmentsApi = {
  list: () => getData<any[]>(api.get('/investments')),
  summary: () => getData<any>(api.get('/investments/summary')),
  save: (id: number | undefined, payload: InvestmentPayload) =>
    id ? api.put(`/investments/${id}`, payload) : api.post('/investments', payload),
  delete: (id: number) => api.delete(`/investments/${id}`),
};
