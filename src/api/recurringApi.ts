import api from '@/src/lib/api';
import { getData } from './http';

export type RecurringPayload = Record<string, unknown>;

export const recurringApi = {
  list: () => getData<any[]>(api.get('/recurring')),
  upcoming: (days = 365) => getData<any[]>(api.get('/recurring/upcoming', { params: { days } })),
  save: (id: number | undefined, payload: RecurringPayload) =>
    id ? api.patch(`/recurring/${id}`, payload) : api.post('/recurring', payload),
  delete: (id: number) => api.delete(`/recurring/${id}`),
};
