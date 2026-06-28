import api from '@/src/lib/api';
import { getData } from './http';

export type MerchantAlias = {
  id: number;
  vpa: string;
  company_name: string;
};

export const merchantAliasesApi = {
  list: () => getData<MerchantAlias[]>(api.get('/merchant-aliases')),
  delete: (id: number) => api.delete(`/merchant-aliases/${id}`),
  update: (id: number, companyName: string) => api.patch(`/merchant-aliases/${id}`, { company_name: companyName }),
};
